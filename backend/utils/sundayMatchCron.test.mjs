// Cross-college pass: two people alone in their colleges still get matched.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('fync_sunday'));
const { default: User } = await import('../models/user.model.js');
const { default: Profile } = await import('../models/couple/sundayMatchProfile.model.js');
const { default: SundayMatch } = await import('../models/couple/sundayMatch.model.js');
const { runSundayMatch, ALL_INDIA } = await import('./sundayMatchCron.js');

const mk = async (n, college) => {
  const u = await User.collection.insertOne({ name: n, username: n, email: `${n}@x.in`, college, user_access: 'user', gender: 'Male' });
  await Profile.create({ user: u.insertedId, college, optedIn: true, intent: 'friendship', interests: [], vibes: [], ageConfirmedAt: new Date() });
  return u.insertedId;
};
const a = await mk('a', 'KIET');
const b = await mk('b', 'IIT Delhi');
await mk('c', 'KIET'); // c and a pair inside KIET; b is alone and has nobody left nationally

const now = Date.now();
assert.equal(await runSundayMatch(now), 1, 'KIET pair only; b has no leftover partner');
assert.equal(await SundayMatch.countDocuments({ college: ALL_INDIA }), 0);

const d = await mk('d', 'NIT Trichy');
await SundayMatch.deleteMany({});
await Profile.updateMany({}, { $set: { priority: false } });
assert.equal(await runSundayMatch(now), 2, 'KIET pair + cross-college pair of b and d');
const cross = await SundayMatch.findOne({ college: ALL_INDIA }).lean();
assert.deepEqual([String(cross.a), String(cross.b)].sort(), [String(b), String(d)].sort());
assert.equal(await runSundayMatch(now), 0, 're-run is a no-op');

await mongoose.disconnect();
await mem.stop();
console.log('sunday match cron tests passed');
process.exit(0);
