import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('arena_progress'));

const User = (await import('../../models/user.model.js')).default;
const Problem = (await import('../../models/coding/problem.model.js')).default;
const CodingSubmission = (await import('../../models/coding/codingSubmission.model.js')).default;
const { getArenaProgress } = await import('./progress.controller.js');

const call = async (userId) => {
  const out = {};
  await getArenaProgress(
    { user: { id: String(userId) }, query: {} },
    { status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } },
  );
  return out.body?.progress;
};

// Inserted below validation: this exercises the progress query, not the user
// schema, and the required profile fields are noise here.
let seq = 0;
const mkUser = async (over = {}) => {
  const _id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id, name: 'x', username: `u${seq++}`, email: `${_id}@e.com`,
    mobileNumber: `9${String(seq).padStart(9, '0')}`,
    codingRating: 1200, contestHistory: [], ...over,
  });
  return { _id };
};

const easy = await Problem.create({ title: 'e', description: 'd', difficulty: 'Easy', points: 100, testCases: [{ input: '1', expectedOutput: '1' }] });
const hard = await Problem.create({ title: 'h', description: 'd', difficulty: 'Hard', points: 300, testCases: [{ input: '1', expectedOutput: '1' }] });

// A fresh account: no contests played, so no rank — the alternative is showing
// everyone rank 1 because they all sit on the starting rating.
const fresh = await mkUser({ codingStats: { totalSolved: 410 } });
{
  const p = await call(fresh._id);
  assert.equal(p.rank, null);
  assert.equal(p.rating, 1200);
  assert.equal(p.contestsPlayed, 0);
  assert.equal(p.solved, 0);
  // The external profile-sync number stays available, just not as `solved`.
  assert.equal(p.externalSolved, 410);
}

// Solves are counted in this arena, distinct per problem.
await CodingSubmission.create([
  { user: fresh._id, problem: easy._id, code: 'x', language: 'python', languageId: 71, status: 'Accepted' },
  { user: fresh._id, problem: easy._id, code: 'y', language: 'python', languageId: 71, status: 'Accepted' },
  { user: fresh._id, problem: hard._id, code: 'z', language: 'python', languageId: 71, status: 'Wrong Answer' },
]);
{
  const p = await call(fresh._id);
  assert.equal(p.solved, 1);
  assert.equal(p.attempted, 2);
  assert.equal(p.unsolved, 1);
  assert.equal(p.byDifficulty.Easy, 1);
  assert.equal(p.externalSolved, 410, 'external count must not be overwritten by arena solves');
}

// Rank is one plus the number of students rated strictly higher.
const contest = new mongoose.Types.ObjectId();
const played = (rating) => mkUser({ codingRating: rating, contestHistory: [{ contest, rank: 1, ratingChange: 0 }] });

const top = await played(1500);
const mid = await played(1300);
const tiedA = await played(1250);
const tiedB = await played(1250);

assert.equal((await call(top._id)).rank, 1);
assert.equal((await call(mid._id)).rank, 2);
// Equal ratings share a rank rather than being ordered arbitrarily.
assert.equal((await call(tiedA._id)).rank, 3);
assert.equal((await call(tiedB._id)).rank, 3);

// A banned account does not push everyone below it down a place.
await mkUser({ codingRating: 9000, isBanned: true, contestHistory: [{ contest }] });
assert.equal((await call(top._id)).rank, 1);

console.log('arenaProgress: ok');
await mongoose.disconnect();
await mem.stop();
