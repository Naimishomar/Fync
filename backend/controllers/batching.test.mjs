// Per-row lookups replaced with one batched query: the results must match what
// the old per-item code returned.
//
// Run: node controllers/batching.test.mjs (needs dummy R2_* env, see package.json test)
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('fync_batching'));

const { default: User } = await import('../models/user.model.js');
const { default: Opportunity } = await import('../models/opportunity.model.js');
const { default: Application } = await import('../models/application.model.js');
const { default: Notification } = await import('../models/notification.model.js');
const { getOpportunities, getRecruiterPosts } = await import('./opportunity.controller.js');
const { sendMessage } = await import('./mentorshipChat.controller.js');

const call = async (fn, req) => {
  const o = {};
  await fn(req, { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } });
  return o;
};

const recruiter = new mongoose.Types.ObjectId();
const student = new mongoose.Types.ObjectId();
const { insertedIds } = await Opportunity.collection.insertMany([0, 1, 2].map((i) => ({
  title: `t${i}`, company: 'c', isActive: true, postedBy: recruiter, createdAt: new Date(Date.now() - i * 1000),
})));
const [o0, o1, o2] = Object.values(insertedIds);
await Application.collection.insertMany([
  { opportunity: o1, candidate: student, recruiter },
  { opportunity: o1, candidate: new mongoose.Types.ObjectId(), recruiter },
  { opportunity: o2, candidate: new mongoose.Types.ObjectId(), recruiter },
]);

// ── hasApplied: one $in instead of exists() per card ────────────────────────
const list = await call(getOpportunities, { query: {}, user: { id: String(student) } });
assert.equal(list.code, 200);
const applied = Object.fromEntries(list.body.data.map((o) => [String(o._id), o.hasApplied]));
assert.deepEqual(applied, { [o0]: false, [o1]: true, [o2]: false });

// ── applicationCount: one $group instead of countDocuments per post ─────────
const posts = await call(getRecruiterPosts, { user: { id: String(recruiter) } });
const counts = Object.fromEntries(posts.body.data.map((p) => [String(p._id), p.applicationCount]));
assert.deepEqual(counts, { [o0]: 0, [o1]: 2, [o2]: 1 });

// ── @mentions: one lookup, one insertMany, self and unknown names skipped ───
await User.collection.insertMany([
  { username: 'me', email: 'me@x' }, { username: 'ann', email: 'ann@x' }, { username: 'bob', email: 'bob@x' },
]);
const byName = Object.fromEntries((await User.find({}).lean()).map((u) => [u.username, u]));
const { me, ann, bob } = byName;
const sent = await call(sendMessage, {
  body: { message: 'hi @ann @bob @ann @me @ghost' },
  user: { id: String(me._id), college: 'X' },
});
assert.equal(sent.code, 201, JSON.stringify(sent.body));
const notified = (await Notification.find({ type: 'tag' }).lean()).map((n) => String(n.recipient)).sort();
assert.deepEqual(notified, [String(ann._id), String(bob._id)].sort(), 'each mentioned user once, never the sender');

await mongoose.disconnect();
await mem.stop();
console.log('batching tests passed');
