import mongoose from 'mongoose';
import redisClient from './redis.js';
import Shorts from '../models/shorts.model.js';

// Views are a counter that nothing reads back synchronously, so they do not
// need a database write per event. They accumulate in one Redis hash and are
// folded into Mongo periodically: a short watched 500 times between two flushes
// costs 500 cheap HINCRBYs and exactly one Mongo update, instead of 500.
//
// Cost of that: `views` in Mongo trails reality by up to FLUSH_INTERVAL_MS.
// Nothing in the app reads it back inside that window, and adding the pending
// count to feed responses would put a Redis round trip on every feed fetch —
// which is the opposite of the point.

export const PENDING_KEY = 'shorts:views:pending';
// Counts are moved here before being written to Mongo, so a flush that dies
// mid-way leaves them recoverable instead of dropped.
const STAGING_KEY = 'shorts:views:flushing';

const FLUSH_INTERVAL_MS = 30_000;
export const MAX_VIEW_BATCH = 100;

// `ids` is user input; an unparseable ObjectId throws inside bulkWrite and
// would take the whole batch with it.
export const normaliseIds = (ids) =>
  [...new Set((Array.isArray(ids) ? ids : []).filter((id) => mongoose.isValidObjectId(id)))]
    .slice(0, MAX_VIEW_BATCH);

// Write straight to Mongo. Used when Redis is unavailable, so a Redis outage
// degrades to the old behaviour rather than silently dropping views.
export const incrementViewsInMongo = async (counts) => {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (!entries.length) return 0;

  await Shorts.bulkWrite(
    entries.map(([id, n]) => ({
      updateOne: { filter: { _id: id }, update: { $inc: { views: n } } },
    })),
    // A short deleted since the view was recorded must not abort the rest.
    { ordered: false }
  );
  return entries.length;
};

// Record a batch of views. One Redis round trip for the whole batch.
export const recordViews = async (ids) => {
  const valid = normaliseIds(ids);
  if (!valid.length) return 0;

  if (redisClient.isReady) {
    try {
      const multi = redisClient.multi();
      for (const id of valid) multi.hIncrBy(PENDING_KEY, id, 1);
      await multi.exec();
      return valid.length;
    } catch (err) {
      console.error('Short view buffer failed, writing through to Mongo:', err.message);
    }
  }

  return incrementViewsInMongo(Object.fromEntries(valid.map((id) => [id, 1])));
};

// Apply one staged hash to Mongo, then drop it. If the write throws, the key is
// deliberately left in place so the next tick retries it.
const drain = async (key) => {
  const hash = await redisClient.hGetAll(key);
  const counts = {};
  for (const [id, n] of Object.entries(hash ?? {})) {
    const parsed = Number(n);
    if (mongoose.isValidObjectId(id) && Number.isFinite(parsed) && parsed > 0) counts[id] = parsed;
  }

  if (!Object.keys(counts).length) {
    await redisClient.del(key);
    return 0;
  }

  await incrementViewsInMongo(counts);
  await redisClient.del(key);
  return Object.keys(counts).length;
};

export const flushShortViews = async () => {
  if (!redisClient.isReady) return 0;

  // Recover anything a previous flush left staged. This must succeed before the
  // rename below, which would otherwise overwrite — and lose — those counts.
  try {
    await drain(STAGING_KEY);
  } catch (err) {
    console.error('Short view flush: staged batch still failing, retrying next tick:', err.message);
    return 0;
  }

  try {
    // Atomically claim the pending counts: writers carry on against a fresh
    // PENDING_KEY while this batch is written.
    await redisClient.rename(PENDING_KEY, STAGING_KEY);
  } catch (err) {
    if (/no such key/i.test(err.message)) return 0; // nothing buffered
    throw err;
  }

  return drain(STAGING_KEY);
};

let timer = null;

export const initShortViewsFlush = () => {
  if (timer) return;
  timer = setInterval(() => {
    flushShortViews().catch((err) => console.error('Short view flush error:', err.message));
  }, FLUSH_INTERVAL_MS);
  timer.unref();
  console.log(`👁️  Short view flusher started (every ${FLUSH_INTERVAL_MS / 1000}s)`);
};

export const stopShortViewsFlush = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
