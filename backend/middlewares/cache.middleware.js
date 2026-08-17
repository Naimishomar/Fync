import redisClient from '../utils/redis.js';
import { trackCacheHit, trackCacheMiss } from './monitoring.middleware.js';

const CACHE_PREFIX = 'fync_cache:';
const GEN_PREFIX = 'fync_gen:';
const LOCK_PREFIX = 'fync_lock:';

// How long a stale entry stays physically in Redis after it stops being fresh.
// Serving stale for a few seconds while one request rebuilds is what stops a
// popular key's expiry from sending every online user to MongoDB at once.
const STALE_GRACE_SECONDS = 30;
const REBUILD_LOCK_MS = 5000;
const MISS_WAIT_MS = 60;

// ── INVALIDATION ────────────────────────────────────────────────────────────
// Previously this SCANned the whole Redis keyspace per call — every post, like
// and comment walked all the auth, rate-limit and presence keys too, and gave up
// after 1000 matches, so invalidation was both slow and incomplete.
//
// Instead each tag has a generation counter that is part of every cache key
// derived from it. Invalidating is one INCR: old keys instantly become
// unreachable and fall out on their own TTL. O(1) regardless of how many users
// have the route cached.
export const clearCache = async (tag) => {
  if (!tag) return;
  try {
    await redisClient.incr(GEN_PREFIX + tag);
  } catch (error) {
    console.error('Redis cache invalidation error:', error.message);
  }
};

export const clearCacheTags = async (tags = []) => {
  await Promise.all(tags.filter(Boolean).map(clearCache));
};

const readGenerations = async (tags) => {
  if (tags.length === 0) return '0';
  const values = await redisClient.mGet(tags.map((t) => GEN_PREFIX + t));
  return values.map((v) => v || '0').join('.');
};

// ── CACHING ─────────────────────────────────────────────────────────────────
// Routes that serve identical bytes to everyone share one entry; everything else
// is keyed per user. Getting this wrong leaks one user's data to another, so the
// route must say which it is rather than the middleware guessing from the URL.
export const cacheMiddleware = (duration, options = {}) => {
  const { tags = [], shared = false } = options;
  const resolveTags = typeof tags === 'function' ? tags : () => tags;

  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    let key;
    try {
      const requestTags = resolveTags(req).filter(Boolean);
      const generation = await readGenerations(requestTags);
      const scope = shared ? 'shared' : req.user?.id || 'guest';
      key = `${CACHE_PREFIX}${scope}:${req.originalUrl}:g${generation}`;

      const setHeaders = () => {
        res.set(
          'Cache-Control',
          shared
            ? `public, s-maxage=${duration}, max-age=${Math.floor(duration / 2)}`
            : // Per-user payloads must never be `public`: a CDN or shared proxy
              // would hand one user's response to the next.
              `private, max-age=${Math.floor(duration / 2)}`
        );
        res.set('Vary', shared ? 'Origin' : 'Authorization, Origin');
      };

      const cached = await redisClient.get(key);
      if (cached) {
        const entry = JSON.parse(cached);
        const isFresh = Date.now() < entry.freshUntil;

        if (isFresh) {
          trackCacheHit(res);
          setHeaders();
          return res.status(200).json(entry.body);
        }

        // Stale. One request goes on to rebuild it; everyone else keeps getting
        // the slightly old copy instead of piling onto the database.
        const won = await redisClient.set(LOCK_PREFIX + key, '1', { NX: true, PX: REBUILD_LOCK_MS });
        if (!won) {
          trackCacheHit(res);
          setHeaders();
          return res.status(200).json(entry.body);
        }
      } else {
        // Cold key. Let one request through; hold the rest briefly and retry once
        // so a burst on an uncached route becomes one query, not thousands.
        const won = await redisClient.set(LOCK_PREFIX + key, '1', { NX: true, PX: REBUILD_LOCK_MS });
        if (!won) {
          await new Promise((resolve) => setTimeout(resolve, MISS_WAIT_MS));
          const retry = await redisClient.get(key);
          if (retry) {
            trackCacheHit(res);
            setHeaders();
            return res.status(200).json(JSON.parse(retry).body);
          }
        }
      }

      trackCacheMiss(res);

      const originalJson = res.json;
      res.json = (body) => {
        // res.json(null) must not throw here; it should just skip caching.
        if (res.statusCode === 200 && body && body.success) {
          setHeaders();
          const entry = JSON.stringify({ body, freshUntil: Date.now() + duration * 1000 });
          redisClient
            .setEx(key, duration + STALE_GRACE_SECONDS, entry)
            .catch((err) => console.error('Redis cache save error:', err.message));
        }
        redisClient.del(LOCK_PREFIX + key).catch(() => {});
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      // Redis being down must never take the API with it — fall through to the
      // controller and serve uncached.
      console.error('Redis cache middleware error:', error.message);
      if (key) redisClient.del(LOCK_PREFIX + key).catch(() => {});
      next();
    }
  };
};
