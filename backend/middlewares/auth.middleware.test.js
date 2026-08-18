// Run with a local redis on 127.0.0.1:6379:
//   redis-server --daemonize yes && node middlewares/auth.middleware.test.js
//
// Covers the parts of the cached auth path that can silently break: that the
// second request is served from Redis without touching Mongo, that _id survives
// the JSON round-trip as an ObjectId, that a ban is enforced, and that an expired
// token is reported as such rather than as a generic failure.
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test-secret';

import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import redisClient, { redisReady } from '../utils/redis.js';
import { authMiddleware, authCacheKey } from './auth.middleware.js';

const USER_ID = new mongoose.Types.ObjectId();

let dbHits = 0;
const stubUser = (doc) => {
  User.findById = () => ({
    select: () => ({
      lean: async () => {
        dbHits++;
        return doc;
      },
    }),
  });
};

const run = async (token) => {
  const req = { headers: { authorization: `Bearer ${token}` } };
  let statusCode = 200;
  let body = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  let nextErr;
  let nexted = false;
  await authMiddleware(req, res, (err) => { nexted = true; nextErr = err; });
  return { req, statusCode, body, nexted, nextErr };
};

// Wait for the handshake: offline commands now reject rather than queue.
await redisReady;
await redisClient.del(authCacheKey(String(USER_ID)));

// ── happy path, twice: second call must be a cache hit ──────────────────────
stubUser({ _id: USER_ID, name: 'Ada', skills: ['js'], user_access: 'user', isBanned: false });
const token = jwt.sign({ id: String(USER_ID) }, process.env.JWT_SECRET, { expiresIn: '1h' });

const first = await run(token);
assert.equal(first.nexted, true, 'valid token should pass through');
assert.equal(first.nextErr, undefined);
assert.equal(dbHits, 1, 'first request loads from Mongo');

const second = await run(token);
assert.equal(second.nexted, true);
assert.equal(dbHits, 1, 'second request must be served from Redis, not Mongo');
assert.ok(second.req.user._id instanceof mongoose.Types.ObjectId, '_id must stay an ObjectId through the cache');
assert.equal(second.req.user.id, String(USER_ID));
assert.deepEqual(second.req.user.skills, ['js']);

// ── ban is enforced ────────────────────────────────────────────────────────
await redisClient.del(authCacheKey(String(USER_ID)));
stubUser({ _id: USER_ID, name: 'Ada', user_access: 'user', isBanned: true });
const banned = await run(token);
assert.equal(banned.statusCode, 403, 'banned user must be rejected');
assert.equal(banned.body.isBanned, true);

// ── expired token is distinguishable from a malformed one ──────────────────
const expired = jwt.sign({ id: String(USER_ID) }, process.env.JWT_SECRET, { expiresIn: -10 });
const expiredResult = await run(expired);
assert.equal(expiredResult.statusCode, 401);
assert.equal(expiredResult.body.expired, true, 'client needs to know to refresh, not to log out');

const garbage = await run('not-a-jwt');
assert.equal(garbage.statusCode, 401);
assert.equal(garbage.body.expired, false);

await redisClient.del(authCacheKey(String(USER_ID)));
await redisClient.quit();
console.log('auth.middleware: all checks passed ✅');
