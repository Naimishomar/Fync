/**
 * The Discover feed: endless technical video, stored nowhere.
 *
 * Two stages on purpose. Finding candidates is cheap and shared, so it is done
 * once and cached for everyone. Resolving a playable stream costs one HTTP call
 * per video, so it happens only for the handful of videos actually being sent —
 * resolving the whole pool would take minutes and most of it would never be
 * watched.
 */
import { collectVideoCandidates, resolvePlayable } from "../utils/discoverSources.js";
import redisClient from "../utils/redis.js";

const CACHE_KEY = "discover:videos:v2";
const CACHE_TTL_SECONDS = 1800;
const STREAM_TTL_SECONDS = 3600;
const MAX_LIMIT = 20;

/**
 * Resolved stream URLs, cached per video.
 *
 * The pool is ranked identically for everyone, so the first page every user
 * sees is the same handful of videos. Without this, each of them pays the same
 * ~1.2s of detail calls to rediscover URLs that have not changed. PeerTube
 * serves HLS from static paths rather than signed URLs, so caching them is safe.
 */
async function resolveCached(candidates) {
  if (!candidates.length) return [];

  let cached = [];
  try {
    cached = await redisClient.mGet(candidates.map((v) => `discover:stream:${v.id}`));
  } catch (err) {
    console.error("Stream cache read failed:", err.message);
    cached = [];
  }

  const hits = [];
  const misses = [];
  candidates.forEach((v, i) => {
    const raw = cached[i];
    if (raw) {
      try { hits.push({ ...v, streamUrl: JSON.parse(raw), uuid: undefined, instance: undefined }); return; }
      catch { /* fall through to a fresh resolve */ }
    }
    misses.push(v);
  });

  const resolved = await resolvePlayable(misses);
  for (const v of resolved) {
    // Best effort: a failed write costs a slower request next time, nothing more.
    redisClient
      .setEx(`discover:stream:${v.id}`, STREAM_TTL_SECONDS, JSON.stringify(v.streamUrl))
      .catch(() => {});
  }

  // Preserve pool order: the ranking is the product, and cache hits must not
  // float to the top just because they were quicker to fetch.
  const byId = new Map([...hits, ...resolved].map((v) => [v.id, v]));
  return candidates.map((v) => byId.get(v.id)).filter(Boolean);
}

/**
 * The candidate pool, shared by every user.
 *
 * This is the whole storage story: one Redis string, expiring every half hour.
 * Nothing is written to Mongo.
 */
async function getPoolCached() {
  try {
    const hit = await redisClient.get(CACHE_KEY);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    // A cache read failure means a slow request, never a failed one.
    console.error("Discover cache read failed:", err.message);
  }

  const pool = await collectVideoCandidates();
  try {
    await redisClient.setEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(pool));
  } catch (err) {
    console.error("Discover cache write failed:", err.message);
  }
  return pool;
}

export const getDiscoverFeed = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? "10", 10) || 10, MAX_LIMIT);
  const cursor = Math.max(parseInt(req.query.cursor ?? "0", 10) || 0, 0);

  // The client sends what it has already been shown. This is the only "memory"
  // in the system: with no database, the device holds the history.
  const seen = new Set(
    String(req.query.seen ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  try {
    const pool = await getPoolCached();
    const fresh = seen.size ? pool.filter((v) => !seen.has(v.id)) : pool;

    // Running out is the normal case for a bounded upstream, not an error.
    // Falling back to the full pool means the user keeps scrolling instead of
    // hitting a wall; the client is told so it can clear its history.
    const recycled = fresh.length === 0 && pool.length > 0;
    const usable = recycled ? pool : fresh;

    // Over-fetch slightly: some candidates will fail to resolve a stream, and a
    // short page is better handled here than as a gap in the feed.
    const slice = usable.slice(cursor, cursor + limit + 4);
    const items = (await resolveCached(slice)).slice(0, limit);

    // Advance past everything examined, not just what resolved — otherwise the
    // dead entries are retried on every request and the cursor stalls.
    const consumed = Math.min(slice.length, limit + 4);

    return res.status(200).json({
      success: true,
      items,
      nextCursor: cursor + consumed,
      hasMore: cursor + consumed < usable.length,
      total: usable.length,
      recycled,
    });
  } catch (error) {
    console.error("Discover feed failed:", error?.message);
    // Upstream being down is not this service's fault, so it says so.
    return res.status(502).json({ success: false, message: "Could not reach the video sources." });
  }
};
