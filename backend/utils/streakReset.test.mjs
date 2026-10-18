// Lapsed streaks are zeroed by the nightly sweep, live ones are kept.
//
// Run: node utils/streakReset.test.mjs
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('fync_streak'));

const { default: User } = await import('../models/user.model.js');
const { resetLapsedStreaks } = await import('./streak.js');

// 2026-10-18 10:00 IST
const now = new Date('2026-10-18T04:30:00.000Z');
const at = (iso) => new Date(iso);
const docs = {
  today: { streakCount: 5, lastPostDate: at('2026-10-18T01:00:00.000Z') },           // 06:30 IST today
  yesterday: { streakCount: 3, lastPostDate: at('2026-10-16T19:00:00.000Z') },       // 00:30 IST 17th
  lapsed: { streakCount: 7, lastPostDate: at('2026-10-16T18:00:00.000Z') },          // 23:30 IST 16th
  never: { streakCount: 2, lastPostDate: null },
};
const ids = {};
for (const [k, v] of Object.entries(docs)) {
  ids[k] = (await User.collection.insertOne({ ...v, email: `${k}@x.y`, username: k })).insertedId;
}

const n = await resetLapsedStreaks(now);
const get = async (k) => (await User.collection.findOne({ _id: ids[k] })).streakCount;
assert.equal(n, 2);
assert.equal(await get('today'), 5);
assert.equal(await get('yesterday'), 3, 'posted yesterday IST: still alive');
assert.equal(await get('lapsed'), 0, 'last post the day before yesterday IST: reset');
assert.equal(await get('never'), 0);

await mongoose.disconnect();
await mem.stop();
console.log('streakReset tests passed');
