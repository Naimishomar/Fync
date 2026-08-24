import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import the xhr adapter directly for React Native/Expo
// @ts-ignore - no declaration file for internal axios module
import xhrAdapter from "axios/lib/adapters/xhr.js";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
console.log("🌐 Axios Base URL:", BACKEND_URL);
axios.defaults.baseURL = BACKEND_URL;

// Explicitly use the xhr adapter function (not string) to avoid auto-detection issues in Expo
axios.defaults.adapter = xhrAdapter;

const CACHE_PREFIX = "fync_cache_";
const LEGACY_PREFIX = "cache_";

// ── Route-aware TTLs (seconds) ────────────────────────────────────────────────
// GET responses are served instantly from AsyncStorage while fresh, so the app
// hits the server only when data goes stale or the user makes a change.
const ROUTE_TTL: { [prefix: string]: number } = {
  "/entertainment": 3600, // 1 hour (static-ish media listings)
  "/marketplace": 300, // 5 min
  "/gigs": 300, // 5 min
  "/subscription/status": 120, // 2 min
  "/post/feed": 60, // 1 min
  "/shorts": 60, // 1 min
  "/user/profile": 60, // 1 min
};
const DEFAULT_TTL = 120; // 2 min default

// Realtime-critical routes are NEVER cached client-side. These screens are driven
// by socket events (leaderboard ticks, scoring, winners, announcements), so a
// stale AsyncStorage hit would hide live updates. Serving them from the server
// keeps the whole hackathon flow reactive at socket speed.
const NO_CACHE_PREFIXES = [
  "/hackathons",
  "/teams",
  "/submissions",
  "/announcements",
  "/scores",
  "/hackathon-leaderboard",
];

function isNoCacheUrl(url: string): boolean {
  return NO_CACHE_PREFIXES.some((p) => url.startsWith(p));
}

interface CachedEntry {
  data: any;
  timestamp: number;
}

// ── L1: in-process cache ──────────────────────────────────────────────────────
// AsyncStorage is SQLite behind the bridge: a read is an async hop plus a
// JSON.parse of the whole payload, which is tens of milliseconds for a feed.
// This Map is the same entry in JS heap — a hit costs a property lookup.
// AsyncStorage stays underneath as the cold-start/durable tier.
const memCache = new Map<string, CachedEntry>();

// Bounded so a long session cannot grow the heap without limit. Insertion order
// is eviction order, which is FIFO rather than LRU.
// ponytail: FIFO eviction, switch to LRU if hit rate drops on long sessions.
const MEM_CACHE_MAX = 300;

// How long past its TTL an entry may still be handed to the caller while a
// fresh copy is fetched behind it. This is what turns a stale read from a
// network round-trip into a 0ms one. Beyond this the request blocks on the
// network, so data can never be arbitrarily old.
const SWR_GRACE_SECONDS = 600;

// One revalidation per key at a time; without this, ten screens mounting on the
// same stale key fire ten identical requests.
const inFlight = new Map<string, Promise<any>>();

// ── Auth token, held in memory ────────────────────────────────────────────────
// This used to be an `AsyncStorage.getItem` on EVERY request — a bridge
// round-trip in front of every call the app makes, cache hits included.
let authToken: string | null = null;
let authTokenLoaded = false;

/** Keep the in-memory copy in step with AsyncStorage. Call on login, logout and
 *  token refresh; passing null clears it. */
export const setAuthToken = (token: string | null) => {
  authToken = token;
  authTokenLoaded = true;
};

const getAuthToken = async (): Promise<string | null> => {
  if (authTokenLoaded) return authToken;
  authToken = await AsyncStorage.getItem("accessToken");
  authTokenLoaded = true;
  return authToken;
};

function getTTL(url: string): number {
  for (const [prefix, ttl] of Object.entries(ROUTE_TTL)) {
    if (url.startsWith(prefix)) return ttl;
  }
  return DEFAULT_TTL;
}

function cacheKeyFor(config: AxiosRequestConfig): string | null {
  if (!config.url) return null;
  try {
    const fullUrl = axios.getUri(config);
    return `${CACHE_PREFIX}${fullUrl}`;
  } catch (e) {
    return null;
  }
}

function isSkipCache(config: AxiosRequestConfig): boolean {
  return config.params?.noCache === true || isNoCacheUrl(config.url || "");
}

async function readCache(key: string): Promise<CachedEntry | null> {
  const hot = memCache.get(key);
  if (hot) return hot;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedEntry;
    rememberInMemory(key, entry);
    return entry;
  } catch (e) {
    return null;
  }
}

function rememberInMemory(key: string, entry: CachedEntry) {
  if (memCache.size >= MEM_CACHE_MAX && !memCache.has(key)) {
    const oldest = memCache.keys().next().value;
    if (oldest !== undefined) memCache.delete(oldest);
  }
  memCache.set(key, entry);
}

function forgetInMemory(predicate: (key: string) => boolean) {
  for (const key of Array.from(memCache.keys())) {
    if (predicate(key)) memCache.delete(key);
  }
}

async function writeCache(key: string, data: any) {
  const entry: CachedEntry = { data, timestamp: Date.now() };
  rememberInMemory(key, entry);
  try {
    // Not awaited by the caller's critical path: the L1 entry above is already
    // live, and persisting is only for the next cold start.
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    // Storage full or unavailable — never block a request for caching
  }
}

// ── Read-through cache adapter ────────────────────────────────────────────────
// Fresh GETs resolve instantly from AsyncStorage (~0ms, no network round-trip).
// Stale GETs and mutations always hit the server. On network failure we fall
// back to the last cached payload so screens never flash empty.
const defaultAdapter = axios.defaults.adapter as any;

axios.defaults.adapter = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
  const method = (config.method || "get").toLowerCase();
  const url = config.url || "";
  const isGet = method === "get";
  const skipCache = isSkipCache(config);

  const cacheKey = isGet && !skipCache ? cacheKeyFor(config) : null;

  const hit = (data: any, stale: boolean): AxiosResponse =>
    ({
      data,
      status: 200,
      statusText: "OK",
      headers: stale
        ? { "x-cache-hit": "true", "x-cache-state": "stale" }
        : { "x-cache-hit": "true", "x-cache-state": "fresh" },
      config,
      request: {},
    } as AxiosResponse);

  /** Fetch and store, deduplicated per key so N callers cause one request. */
  const fetchAndStore = (key: string | null): Promise<AxiosResponse> => {
    if (!key) return defaultAdapter(config);
    const existing = inFlight.get(key);
    if (existing) return existing;
    const promise = (async () => {
      try {
        const response = await defaultAdapter(config);
        if (response.status === 200) await writeCache(key, response.data);
        return response;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, promise);
    return promise;
  };

  if (cacheKey) {
    const entry = await readCache(cacheKey);
    if (entry) {
      const ageSeconds = (Date.now() - entry.timestamp) / 1000;
      if (ageSeconds <= getTTL(url)) {
        // Fresh — serve from memory, no network, no storage read.
        return hit(entry.data, false);
      }
      if (ageSeconds <= getTTL(url) + SWR_GRACE_SECONDS) {
        // Stale but not old. Hand back what we have now and refresh behind it,
        // so the user waits 0ms instead of a round-trip. Past the grace window
        // we fall through and block on the network rather than show stale data.
        fetchAndStore(cacheKey).catch(() => {});
        return hit(entry.data, true);
      }
      memCache.delete(cacheKey);
      await AsyncStorage.removeItem(cacheKey).catch(() => {});
    }
  }

  try {
    return await fetchAndStore(cacheKey);
  } catch (error) {
    // Network/offline fallback: serve last cached payload if we have one
    if (isGet && !skipCache) {
      const key = cacheKeyFor(config);
      if (key) {
        const entry = await readCache(key);
        if (entry) {
          return {
            data: entry.data,
            status: 200,
            statusText: "OK (cached)",
            headers: { "x-cache-hit": "true", "x-stale": "true" },
            config,
            request: {},
          } as AxiosResponse;
        }
      }
    }
    throw error;
  }
};

// ── Invalidation: hit the server only when the user actually changes data ─────
async function invalidateCacheFor(mutatedUrl: string) {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(
      (k) => k.startsWith(CACHE_PREFIX) || k.startsWith(LEGACY_PREFIX)
    );
    if (cacheKeys.length === 0) return;

    // First path segment of the mutated URL, e.g. "/post" from "/post/like/:id"
    const parts = mutatedUrl.split("/").filter(Boolean);
    const segment = parts.length > 0 ? `/${parts[0]}` : mutatedUrl;

    // Cross-cutting relationships: a change under one section invalidates feeds
    // and the cached profile too (e.g. liking a post changes feed + score).
    const related = new Set<string>([segment]);
    if (segment === "/post" || segment === "/shorts") {
      related.add("/post/feed");
      related.add("/shorts");
      related.add("/user");
    }
    if (segment === "/user") {
      related.add("/post/feed");
      related.add("/shorts");
    }

    const toRemove: string[] = [];
    for (const key of cacheKeys) {
      const cachedUrl = key.startsWith(CACHE_PREFIX)
        ? key.slice(CACHE_PREFIX.length)
        : key.slice(LEGACY_PREFIX.length);
      for (const seg of related) {
        if (cachedUrl === seg || cachedUrl.startsWith(`${seg}/`)) {
          toRemove.push(key);
          break;
        }
      }
    }

    forgetInMemory((key) => toRemove.includes(key));

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    // Ignore invalidation failures
  }
}

axios.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => {
    const method = (response.config.method || "get").toLowerCase();
    if (method !== "get" && response.status >= 200 && response.status < 300) {
      invalidateCacheFor(response.config.url || "");
    }
    return response;
  },
  async (error: any) => {
    const originalRequest = error.config;

    const isAuthRoute =
      originalRequest?.url?.includes("/user/login") ||
      originalRequest?.url?.includes("/user/refresh-token");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) {
          return Promise.reject(error);
        }

        const res = await axios.post("/user/refresh-token", {
          refreshToken,
        });

        const newAccessToken = res.data.token;

        await AsyncStorage.setItem("accessToken", newAccessToken);
        setAuthToken(newAccessToken);

        axios.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return axios(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
        setAuthToken(null);
        return Promise.reject(refreshError);
      }
    }

    console.log("❌ Axios Error:", error.message, error.config?.url);
    if (error.response) {
      console.log("❌ Error Data:", error.response.data);
    }
    return Promise.reject(error);
  }
);

// ── Cache housekeeping ────────────────────────────────────────────────────────
// Migrate legacy "cache_*" keys and cap total entries so AsyncStorage never
// grows unbounded. Runs on boot and every few minutes.
const migrateAndLimitCache = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const legacy = allKeys.filter((k) => k.startsWith(LEGACY_PREFIX));
    if (legacy.length > 0) {
      await AsyncStorage.multiRemove(legacy);
    }

    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    const MAX_CACHE_KEYS = 150;
    if (cacheKeys.length > MAX_CACHE_KEYS) {
      const toRemove = cacheKeys.slice(0, cacheKeys.length - MAX_CACHE_KEYS);
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    console.log("Cache cleanup error", e);
  }
};

setTimeout(migrateAndLimitCache, 3000);
setInterval(migrateAndLimitCache, 5 * 60 * 1000);

export default axios;