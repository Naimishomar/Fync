/**
 * The Discover feed: endless technical content, stored nowhere.
 *
 * Items are fetched live and held only in the Redis response cache the route
 * applies. There is no collection, no migration and no growth — the cost of
 * serving a million items is the same as serving ten.
 */
import { collectDiscoverItems, rankItems } from "../utils/discoverSources.js";
import redisClient from "../utils/redis.js";

const CACHE_KEY = "discover:ranked:v1";
const CACHE_TTL_SECONDS = 900;

/**
 * The ranked list, shared by every user.
 *
 * This is the whole storage story: one Redis string, a few hundred KB, expiring
 * every fifteen minutes. Nothing is written to Mongo.
 */
async function getRankedCached() {
  try {
    const hit = await redisClient.get(CACHE_KEY);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    // A cache read failure means a slow request, never a failed one.
    console.error("Discover cache read failed:", err.message);
  }

  const ranked = rankItems(await collectDiscoverItems());
  try {
    await redisClient.setEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(ranked));
  } catch (err) {
    console.error("Discover cache write failed:", err.message);
  }
  return ranked;
}

const MAX_LIMIT = 30;

export const getDiscoverFeed = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? "15", 10) || 15, MAX_LIMIT);
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
    const ranked = await getRankedCached();
    const fresh = seen.size ? ranked.filter((i) => !seen.has(i.id)) : ranked;

    // Running out is the normal case for a feed with a bounded upstream, not an
    // error. Falling back to the full list means the user keeps scrolling
    // instead of hitting a wall; the client resets its history when it sees this.
    const recycled = fresh.length === 0 && ranked.length > 0;
    const pool = recycled ? ranked : fresh;

    const page = pool.slice(cursor, cursor + limit);

    return res.status(200).json({
      success: true,
      items: page,
      nextCursor: cursor + page.length,
      hasMore: cursor + page.length < pool.length,
      total: pool.length,
      recycled,
    });
  } catch (error) {
    console.error("Discover feed failed:", error?.message);
    // Upstream being down is not this service's fault, so it says so.
    return res.status(502).json({ success: false, message: "Could not reach the content sources." });
  }
};
