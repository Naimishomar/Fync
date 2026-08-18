// Batched short views: one request must apply a whole session's worth of views,
// and bad input must not be able to discard a good batch.
//
// Run: node scripts/shortsViews.test.js
import 'dotenv/config.js';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET ||= 'shorts-views-test-secret';
const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_shorts_views'));

const { default: User } = await import('../models/user.model.js');
const { default: Shorts } = await import('../models/shorts.model.js');
const { default: redisClient } = await import('../utils/redis.js');
const { redisReady } = await import('../utils/redis.js');
const { flushShortViews, PENDING_KEY } = await import('../utils/shortViews.js');

await redisReady;
const REDIS = redisClient.isReady;
console.log(REDIS ? 'redis: live — buffered path under test' : 'redis: offline — write-through path under test');
if (REDIS) await redisClient.del(PENDING_KEY);

const user = await User.create({
  name: 'Viewer', username: 'viewer', email: 'viewer@test.dev', mobileNumber: '9000000001',
  password: 'x', dob: new Date('2003-01-01'), college: 'Test', year: '3', gender: 'Other', major: 'CSE',
});
const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

const shorts = await Shorts.create(
  [1, 2, 3].map((n) => ({ video: `v${n}.mp4`, title: `Short ${n}`, user: user._id }))
);
const ids = shorts.map((s) => s._id.toString());

const app = express();
app.use(express.json());
app.use('/shorts', (await import('../routes/short.route.js')).default);
const server = app.listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

const post = async (path, body) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const viewsOf = async (id) => (await Shorts.findById(id).select('views').lean()).views;
// The handler answers before recording, so let the background work land — then
// fold the Redis buffer into Mongo, since that is where the assertions look.
const settle = async () => {
  await new Promise((r) => setTimeout(r, 150));
  if (REDIS) await flushShortViews();
};

// ── one request, many shorts ────────────────────────────────────────────────
let r = await post('/shorts/views', { ids });
assert.equal(r.status, 200);
assert.equal(r.json.accepted, 3);
await settle();
for (const id of ids) assert.equal(await viewsOf(id), 1, 'every id in the batch is counted');

// ── a garbage id must not discard the rest of the batch ─────────────────────
r = await post('/shorts/views', { ids: ['not-an-objectid', ids[0]] });
assert.equal(r.status, 200);
await settle();
assert.equal(await viewsOf(ids[0]), 2, 'valid ids still applied alongside an invalid one');

// ── an id that is well-formed but gone must not drop the batch either ───────
const missing = new mongoose.Types.ObjectId().toString();
await post('/shorts/views', { ids: [missing, ids[1]] });
await settle();
assert.equal(await viewsOf(ids[1]), 2, 'a deleted short does not abort the bulkWrite');

// ── duplicates inside one batch count once ──────────────────────────────────
await post('/shorts/views', { ids: [ids[2], ids[2], ids[2]] });
await settle();
assert.equal(await viewsOf(ids[2]), 2, 'duplicate ids in a batch are collapsed');

// ── input validation ────────────────────────────────────────────────────────
assert.equal((await post('/shorts/views', { ids: [] })).status, 400);
assert.equal((await post('/shorts/views', {})).status, 400);
assert.equal((await post('/shorts/views', { ids: 'nope' })).status, 400);

// ── the legacy single-id route still works ──────────────────────────────────
await post(`/shorts/views/${ids[0]}`);
await settle();
assert.equal(await viewsOf(ids[0]), 3, 'legacy per-short route still increments');


// ── the buffer must collapse repeat views into one Mongo write ─────────────
if (REDIS) {
  await redisClient.del(PENDING_KEY);
  const before = await viewsOf(ids[0]);

  // Five separate batches, same short: five Redis increments, no Mongo writes yet.
  for (let i = 0; i < 5; i++) await post('/shorts/views', { ids: [ids[0]] });
  await new Promise((r) => setTimeout(r, 200));

  assert.equal(await viewsOf(ids[0]), before, 'buffered views must not hit Mongo before a flush');
  assert.equal(
    Number(await redisClient.hGet(PENDING_KEY, ids[0])), 5,
    'all five views accumulate in the Redis buffer'
  );

  const touched = await flushShortViews();
  assert.equal(touched, 1, 'five views collapse into a single Mongo document update');
  assert.equal(await viewsOf(ids[0]), before + 5, 'no views lost in the collapse');
  assert.equal(await redisClient.exists(PENDING_KEY), 0, 'buffer cleared after a successful flush');

  // ── a flush with nothing buffered is a no-op, not an error ───────────────
  assert.equal(await flushShortViews(), 0, 'flushing an empty buffer is harmless');

  // ── counts staged by a flush that died must be recovered, not lost ───────
  const before2 = await viewsOf(ids[1]);
  await post('/shorts/views', { ids: [ids[1]] });
  await new Promise((r) => setTimeout(r, 150));
  // Simulate a process dying after the rename but before the Mongo write.
  await redisClient.rename(PENDING_KEY, 'shorts:views:flushing');
  assert.equal(await redisClient.exists(PENDING_KEY), 0);

  await flushShortViews();
  assert.equal(await viewsOf(ids[1]), before2 + 1, 'a stranded staged batch is recovered on the next flush');
  assert.equal(await redisClient.exists('shorts:views:flushing'), 0, 'staging key cleared after recovery');
}

console.log('shorts view batching: all checks passed ✅');
server.close();
await mongoose.disconnect();
await mongod.stop();
process.exit(0);
