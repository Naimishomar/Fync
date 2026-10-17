import assert from 'node:assert/strict';
import { popNightPartner, takeReportSlot } from './safety.controller.js';
import redisClient, { redisReady } from '../utils/redis.js';

// Same list-backed Redis stand-in as utils/quizQueue.test.mjs, plus RPUSH/INCR.
class FakeRedis {
  constructor() { this.lists = new Map(); this.counters = new Map(); this.ttl = new Map(); }
  l(k) { if (!this.lists.has(k)) this.lists.set(k, []); return this.lists.get(k); }
  async lPush(k, v) { return this.l(k).unshift(v); }
  async rPush(k, v) { return this.l(k).push(...[].concat(v)); }
  async rPop(k) { return this.l(k).pop() ?? null; }
  async incr(k) { const n = (this.counters.get(k) ?? 0) + 1; this.counters.set(k, n); return n; }
  async expire(k, s) { this.ttl.set(k, s); return true; }
}

const Q = 'queue:night_1v1';
const entry = (userId) => JSON.stringify({ userId, socketId: `s${userId}` });
const alive = async (o) => (o.userId === 'DEAD' ? null : { id: `s${o.userId}` });
const blockedPairs = new Set(['A|B', 'B|A']);
const isBlocked = async (a, b) => blockedPairs.has(`${a}|${b}`);

// A and B blocked each other. A searches: B is skipped, DEAD dropped, C matched.
{
  const redis = new FakeRedis();
  await redis.lPush(Q, entry('B'));
  await redis.lPush(Q, entry('DEAD'));
  await redis.lPush(Q, entry('C'));
  // rPop order is B, DEAD, C.
  const found = await popNightPartner(redis, Q, 'A', { isAlive: alive, isBlocked });
  assert.equal(found.opponent.userId, 'C');
  // B was put back, at the pop end, so it is still first in line; DEAD is gone.
  assert.deepEqual(redis.l(Q), [entry('B')]);
}

// Only blocked candidates: nobody is matched, and none of them lose their place.
{
  const redis = new FakeRedis();
  blockedPairs.add('A|D');
  await redis.lPush(Q, entry('B'));
  await redis.lPush(Q, entry('D'));
  assert.equal(await popNightPartner(redis, Q, 'A', { isAlive: alive, isBlocked }), null);
  assert.deepEqual(redis.l(Q), [entry('D'), entry('B')]);
}

// A's own stale entry is dropped, not matched with itself.
{
  const redis = new FakeRedis();
  await redis.lPush(Q, entry('A'));
  assert.equal(await popNightPartner(redis, Q, 'A', { isAlive: alive, isBlocked }), null);
  assert.deepEqual(redis.l(Q), []);
}

// Report rate limit: `limit` reports per window, then refused; window TTL set once.
{
  const redis = new FakeRedis();
  for (let i = 0; i < 3; i++) assert.equal(await takeReportSlot(redis, 'U', 3), true);
  assert.equal(await takeReportSlot(redis, 'U', 3), false);
  assert.equal(await takeReportSlot(redis, 'V', 3), true);
  assert.equal(redis.ttl.get('safety:reports:U'), 3600);
}

// Importing the controller opens the shared Redis client; close it so node exits.
await redisReady;
if (redisClient.isOpen) await redisClient.quit();
console.log('safety tests passed');
