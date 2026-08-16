import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
console.log("🌐 Axios Base URL:", BACKEND_URL);
axios.defaults.baseURL = BACKEND_URL;

// Axios auto-detects the correct adapter for each platform:
// - Web: XMLHttpRequest (native)
// - React Native/Expo: polyfilled XMLHttpRequest (via react-native-get-random-values etc.)
// No manual adapter needed.

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
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedEntry;
  } catch (e) {
    return null;
  }
}

async function writeCache(key: string, data: any) {
  try {
    const entry: CachedEntry = { data, timestamp: Date.now() };
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

  if (isGet && !skipCache) {
    const key = cacheKeyFor(config);
    if (key) {
      const entry = await readCache(key);
      if (entry) {
        const ageSeconds = (Date.now() - entry.timestamp) / 1000;
        if (ageSeconds <= getTTL(url)) {
          // Fresh — serve instantly, zero server hit
          return {
            data: entry.data,
            status: 200,
            statusText: "OK",
            headers: { "x-cache-hit": "true" },
            config,
            request: {},
          } as AxiosResponse;
        }
        // Stale — drop it and fetch fresh data
        await AsyncStorage.removeItem(key).catch(() => {});
      }
    }
  }

  try {
    const response = await defaultAdapter(config);
    if (isGet && response.status === 200 && !skipCache) {
      const key = cacheKeyFor(config);
      if (key) await writeCache(key, response.data);
    }
    return response;
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

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    // Ignore invalidation failures
  }
}

axios.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("accessToken");
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

        axios.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return axios(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
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