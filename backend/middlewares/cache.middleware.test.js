// Run with a local redis on 127.0.0.1:6379:
//   node middlewares/cache.middleware.test.js
//
// The old cache layer invalidated by SCANning the keyspace for a substring, and
// several call sites passed a pattern that never matched their route's URL — so
// writes appeared to clear the cache and didn't. These checks pin the behaviour
// that replaced it: a tag bump must make the next read miss, one user's entry
// must never be served to another, and a burst of concurrent misses must reach
// the handler once rather than once per request.
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import redisClient from '../utils/redis.js';
import { cacheMiddleware, clearCacheTags } from './cache.middleware.js';

let handlerCalls = 0;
let payload = 'v1';

const app = express();
// Pretend auth: ?u=<id> stands in for the authenticated user.
app.use((req, res, next) => {
  req.user = { id: req.query.u || 'anon' };
  next();
});
app.get('/thing/:id', cacheMiddleware(60, { tags: (req) => [`thing:${req.params.id}`] }), (req, res) => {
  handlerCalls++;
  res.json({ success: true, value: payload, forUser: req.user.id });
});

const server = http.createServer(app).listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const get = async (path) => (await fetch(`${base}${path}`)).json();

// Start from a clean slate so a previous run cannot mask a failure.
// node-redis v5's scanIterator yields *batches* of keys, not single keys.
for await (const batch of redisClient.scanIterator({ MATCH: 'fync_*', COUNT: 500 })) {
  if (batch.length) await redisClient.del(batch);
}

// ── a repeat read is served from cache ──────────────────────────────────────
assert.equal((await get('/thing/1?u=alice')).value, 'v1');
assert.equal(handlerCalls, 1);
await get('/thing/1?u=alice');
assert.equal(handlerCalls, 1, 'second read must be a cache hit');

// ── a write invalidates it ──────────────────────────────────────────────────
payload = 'v2';
await clearCacheTags(['thing:1']);
assert.equal((await get('/thing/1?u=alice')).value, 'v2', 'edit must be visible immediately after invalidation');
assert.equal(handlerCalls, 2);

// ── invalidation is scoped to the tag, not the whole cache ──────────────────
await get('/thing/2?u=alice');
const callsBefore = handlerCalls;
await clearCacheTags(['thing:1']);
await get('/thing/2?u=alice');
assert.equal(handlerCalls, callsBefore, 'busting thing:1 must not evict thing:2');

// ── private entries are per user ────────────────────────────────────────────
const bob = await get('/thing/2?u=bob');
assert.equal(bob.forUser, 'bob', "alice's cached response must never be served to bob");

// ── a concurrent burst on a cold key collapses to one handler call ──────────
await clearCacheTags(['thing:3']);
const before = handlerCalls;
await Promise.all(Array.from({ length: 25 }, () => get('/thing/3?u=alice')));
const rebuilds = handlerCalls - before;
assert.ok(rebuilds <= 2, `expected the stampede lock to collapse 25 misses, got ${rebuilds} handler calls`);

server.close();
await redisClient.quit();
console.log('cache.middleware: all checks passed ✅');
