// Auth hardening: email proof, OTP lockout, refresh revocation, private fields,
// account deletion cascade.
//
// Run (local redis on 6379): node controllers/auth.controller.test.mjs
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_auth_ctl'));

const { default: redisClient, redisReady } = await import('../utils/redis.js');
await redisReady;
const { default: User } = await import('../models/user.model.js');
const { default: OTP } = await import('../models/otp.model.js');
const { default: Post } = await import('../models/post.model.js');
const { default: Comment } = await import('../models/comment.model.js');
const { default: Notification } = await import('../models/notification.model.js');
const ctl = await import('./auth.controller.js');
const { generateRefreshToken } = await import('../utils/token.js');
const { default: Report } = await import('../models/report.model.js');
const { default: jwt } = await import('jsonwebtoken');
const { default: bcrypt } = await import('bcrypt');

const call = (fn, { user, params = {}, body = {}, query = {} } = {}) =>
  new Promise((resolve) => {
    const res = { statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { resolve({ status: res.statusCode, body: b }); return res; };
    Promise.resolve(fn({ user, params, body, query, headers: {} }, res)).catch((e) => resolve({ threw: e.message }));
  });

let n = 0;
const mkUser = async () => {
  n++;
  const u = await User.create({
    name: `U${n}`, username: `authtest${n}`, email: `authtest${n}@test.dev`, mobileNumber: `91000000${n}`,
    password: 'hash', college: 'C', year: 2, major: 'CSE', gender: 'Other', dob: new Date('2004-01-01'),
    refreshToken: 'stored',
  });
  return { doc: u, ctx: { id: String(u._id), _id: u._id } };
};

const failures = [];
const check = async (name, fn) => {
  try { await fn(); console.log(`  ok    ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL  ${name}: ${e.message}`); }
};

await check('login/OTP limiter keys by account + address', async () => {
  const { identifierIpKey } = await import('../middlewares/rateLimit.middleware.js');
  assert.equal(identifierIpKey({ ip: '10.0.0.1', body: { email: ' A@B.dev ' } }), '10.0.0.1:a@b.dev');
  assert.equal(identifierIpKey({ ip: '10.0.0.1' }), '10.0.0.1:');
});

await check('email proof binds to the email', () => {
  const t = ctl.signEmailProof('a@x.dev');
  assert.equal(ctl.checkEmailProof(t, 'A@x.dev '), null);
  assert.ok(ctl.checkEmailProof(t, 'b@x.dev'));
  assert.ok(ctl.checkEmailProof('garbage', 'a@x.dev'));
});

await check('missing proof allowed by default, refused when flag is false', () => {
  assert.equal(ctl.checkEmailProof(undefined, 'a@x.dev'), null);
  process.env.ALLOW_UNVERIFIED_REGISTER = 'false';
  assert.ok(ctl.checkEmailProof(undefined, 'a@x.dev'));
  delete process.env.ALLOW_UNVERIFIED_REGISTER;
});

await check('register refuses a proof for another email', async () => {
  const r = await call(ctl.register, { body: {
    email: 'x@y.dev', username: 'x', mobileNumber: '1', password: 'p', name: 'n', dob: '2000-01-01',
    college: 'c', year: 1, gender: 'Male', major: 'm', verificationToken: ctl.signEmailProof('other@y.dev'),
  } });
  assert.equal(r.status, 403);
});

await check('verify OTP returns a proof; 5 wrong codes lock the email', async () => {
  const email = 'lock@test.dev';
  await redisClient.del(`otp_fail:${email}`);
  await OTP.create({ email, otp: '123456', purpose: 'register' });
  for (let i = 0; i < 5; i++) {
    const r = await call(ctl.verifyEmailOTP, { body: { email, otp: '000000' } });
    assert.equal(r.status, 400);
  }
  const locked = await call(ctl.verifyEmailOTP, { body: { email, otp: '123456' } });
  assert.equal(locked.status, 400);
  assert.match(locked.body.message, /Too many/);
  await redisClient.del(`otp_fail:${email}`);
  const ok = await call(ctl.verifyEmailOTP, { body: { email: 'LOCK@test.dev', otp: '123456' } });
  assert.equal(ok.status, 200);
  assert.equal(ctl.checkEmailProof(ok.body.verificationToken, email), null);
});

await check('password and refreshToken are never selected by default', async () => {
  const { doc } = await mkUser();
  const plain = await User.findById(doc._id).lean();
  assert.equal(plain.password, undefined);
  assert.equal(plain.refreshToken, undefined);
});

await check('refresh token must match the stored one', async () => {
  const { doc } = await mkUser();
  const token = generateRefreshToken(doc._id);
  assert.equal((await call(ctl.refreshToken, { body: { refreshToken: token } })).status, 401);
  await User.updateOne({ _id: doc._id }, { refreshToken: token });
  assert.equal((await call(ctl.refreshToken, { body: { refreshToken: token } })).status, 200);
});

await check('alumni stay signed in on several devices; a password reset ends them', async () => {
  const { doc } = await mkUser();
  await User.updateOne({ _id: doc._id }, { user_access: 'alumni' });
  await redisClient.del(`refresh_epoch:${doc._id}`);
  const older = jwt.sign({ id: doc._id, iat: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  // stored token is 'stored', not this one: other devices must still refresh
  assert.equal((await call(ctl.refreshToken, { body: { refreshToken: older } })).status, 200);
  await OTP.create({ email: doc.email, otp: await bcrypt.hash('111111', 10), purpose: 'reset-password' });
  await redisClient.del(`otp_fail:${doc.email}`);
  const r = await call(ctl.verifyResetPassword, { body: { email: doc.email, otp: '111111', password: 'newpass' } });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal((await call(ctl.refreshToken, { body: { refreshToken: older } })).status, 401);
  await redisClient.del(`refresh_epoch:${doc._id}`);
});

await check('followers list and public profile hide private fields', async () => {
  const a = await mkUser(); const b = await mkUser();
  await call(ctl.followUser, { user: a.ctx, params: { id: b.ctx.id } });
  const f = await call(ctl.getFollowers, { params: { id: b.ctx.id } });
  const row = f.body.followers[0];
  assert.equal(row.username, a.doc.username);
  for (const k of ['email', 'mobileNumber', 'refreshToken', 'password', 'dob', 'fcmTokens']) assert.equal(row[k], undefined, k);
  const other = await call(ctl.getUserProfile, { user: a.ctx, params: { id: b.ctx.id } });
  assert.equal(other.body.user.email, undefined);
  assert.equal(other.body.user.username, b.doc.username);
  const own = await call(ctl.getUserProfile, { user: b.ctx, params: { id: b.ctx.id } });
  assert.equal(own.body.user.email, b.doc.email);
});

await check('DELETE /user/me needs confirm and removes the user and their data', async () => {
  const a = await mkUser(); const b = await mkUser();
  await call(ctl.followUser, { user: a.ctx, params: { id: b.ctx.id } });
  await call(ctl.followUser, { user: b.ctx, params: { id: a.ctx.id } });
  const post = await Post.create({ description: 'x', user: a.doc._id, college: 'C', likes: 0 });
  const bPost = await Post.create({ description: 'y', user: b.doc._id, college: 'C', likes: 0 });
  await Comment.create({ text: 'on own', commentor: b.doc._id, post: post._id, postType: 'Post' });
  await Comment.create({ text: 'mine', commentor: a.doc._id, post: bPost._id, postType: 'Post' });

  assert.equal((await call(ctl.deleteAccount, { user: a.ctx, body: {} })).status, 400);
  const r = await call(ctl.deleteAccount, { user: a.ctx, body: { confirm: 'DELETE' } });
  assert.equal(r.status, 200, JSON.stringify(r));

  assert.equal(await User.countDocuments({ _id: a.doc._id }), 0);
  assert.equal(await Post.countDocuments({ user: a.doc._id }), 0);
  assert.equal(await Comment.countDocuments({ $or: [{ commentor: a.doc._id }, { post: post._id }] }), 0);
  assert.equal(await Notification.countDocuments({ $or: [{ sender: a.doc._id }, { recipient: a.doc._id }] }), 0);
  const bAfter = await User.findById(b.doc._id).lean();
  assert.equal(bAfter.followers.length, 0);
  assert.equal(bAfter.following.length, 0);
  assert.equal(await Post.countDocuments({ _id: bPost._id }), 1);
});

await check('self-delete removes reports the user filed, keeps reports against them', async () => {
  const a = await mkUser(); const b = await mkUser();
  await Report.create({ reporter: a.doc._id, targetType: 'user', targetUser: b.doc._id, reason: 'spam' });
  await Report.create({ reporter: b.doc._id, targetType: 'user', targetUser: a.doc._id, reason: 'spam' });
  const r = await call(ctl.deleteAccount, { user: a.ctx, body: { confirm: 'DELETE' } });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(await Report.countDocuments({ reporter: a.doc._id }), 0);
  assert.equal(await Report.countDocuments({ targetUser: a.doc._id }), 1);
});

await mongoose.disconnect();
await mongod.stop();
await redisClient.quit();
if (failures.length) { console.log(`\n${failures.length} failed`); process.exit(1); }
console.log('\nauth controller: all passed');
