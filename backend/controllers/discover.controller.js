/**
 * The Discover feed: Creative Commons technical video from YouTube.
 *
 * This exists so the shorts feed never runs dry in the early days, when few
 * students have posted. Students' own shorts come first and are served from
 * /shorts/smart; the client falls through to here only once those are
 * exhausted.
 *
 * Nothing is stored. Playback happens in YouTube's own player, so no video is
 * downloaded, proxied or written to our database — the only state is a Redis
 * string holding search results, and it expires.
 */
import { collectYouTubeCandidates, youtubeConfigured } from "../utils/youtubeSource.js";
import redisClient from "../utils/redis.js";

const CACHE_KEY = "discover:youtube:v1";
// Eight hours, not minutes: a refresh costs roughly 1,820 of the free tier's
// 10,000 daily quota units (18 searches at 100 each, plus about 16 language
// lookups at 1). Three refreshes a day is ~5,500, leaving real headroom. This
// is a spend decision rather than a freshness one — the pool is Creative
// Commons back-catalogue, so nothing in it goes stale in eight hours.
const CACHE_TTL_SECONDS = 28800;
// A partial pool is worth reusing for a few minutes so a quota wall does not
// hammer the API, but not for eight hours.
const DEGRADED_TTL_SECONDS = 900;
const MAX_LIMIT = 20;

/**
 * The candidate pool, shared by every user.
 *
 * Cached hard because it costs quota, not time. A cache failure degrades to a
 * slower request rather than a failed one.
 */
async function getPool() {
  if (!youtubeConfigured()) return [];

  try {
    const hit = await redisClient.get(CACHE_KEY);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    console.error("Discover cache read failed:", err.message);
  }

  const { items, degraded } = await collectYouTubeCandidates();
  if (!items.length) return [];

  try {
    await redisClient.setEx(
      CACHE_KEY,
      degraded ? DEGRADED_TTL_SECONDS : CACHE_TTL_SECONDS,
      JSON.stringify(items),
    );
  } catch (err) {
    console.error("Discover cache write failed:", err.message);
  }
  return items;
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
    const pool = await getPool();

    if (!pool.length) {
      // An empty pool is a configuration state, not a failure. Saying so plainly
      // beats a 502 that looks like an outage when the API key is simply absent.
      return res.status(200).json({
        success: true,
        items: [],
        nextCursor: cursor,
        hasMore: false,
        total: 0,
        recycled: false,
        configured: youtubeConfigured(),
      });
    }

    const fresh = seen.size ? pool.filter((v) => !seen.has(v.id)) : pool;

    // Running out is the normal case for a bounded pool, not an error. Falling
    // back to the whole pool keeps the user scrolling instead of hitting a wall;
    // the client is told so it can clear its history.
    const recycled = fresh.length === 0;
    const usable = recycled ? pool : fresh;
    const items = usable.slice(cursor, cursor + limit);

    return res.status(200).json({
      success: true,
      items,
      nextCursor: cursor + items.length,
      hasMore: cursor + items.length < usable.length,
      total: usable.length,
      recycled,
      configured: true,
    });
  } catch (error) {
    console.error("Discover feed failed:", error?.message);
    return res.status(502).json({ success: false, message: "Could not reach YouTube." });
  }
};
