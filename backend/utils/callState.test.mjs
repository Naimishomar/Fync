import assert from 'node:assert/strict';
import fs from 'node:fs';

/*
 * Exercises callState against an in-memory Redis stand-in that honours the
 * exact NX/EX semantics the atomic claim depends on. The point is the race:
 * two callers must not both win the same idle user.
 */
class FakeRedis {
  constructor() { this.store = new Map(); }
  async set(k, v, opts = {}) {
    if (opts.NX && this.store.has(k)) return null;
    this.store.set(k, { v: String(v), ttl: opts.EX ?? null });
    return 'OK';
  }
  async get(k) { return this.store.has(k) ? this.store.get(k).v : null; }
  async del(k) { return this.store.delete(k) ? 1 : 0; }
  async expire(k, ttl) { if (!this.store.has(k)) return 0; this.store.get(k).ttl = ttl; return 1; }
  async mGet(keys) { return keys.map(k => (this.store.has(k) ? this.store.get(k).v : null)); }
}

const redis = new FakeRedis();
// Swap the redis import for the fake, then load the module from a data URL so
// the real implementation runs untouched.
const src = fs.readFileSync(new URL('./callState.js', import.meta.url), 'utf8')
  .replace(/^import redisClient from '\.\/redis\.js';$/m,
           'const redisClient = globalThis.__fakeRedis;');
globalThis.__fakeRedis = redis;
const mod = await import('data:text/javascript,' + encodeURIComponent(src));
const { claimCall, confirmCall, releaseIfPeer, endCall, getPeer, filterBusy,
        RINGING_TTL_SECONDS, CONNECTED_TTL_SECONDS } = mod;

const A = 'userA', B = 'userB', C = 'userC';

// A rings B: both sides reserved, both on the short ringing lease.
assert.deepEqual(await claimCall(A, B), { ok: true });
assert.equal(await getPeer(A), B);
assert.equal(await getPeer(B), A);
assert.equal(redis.store.get('call:busy:userB').ttl, RINGING_TTL_SECONDS);

// THE RACE: C rings B while B is engaged. Must be refused, and must NOT
// disturb the existing A<->B pairing.
assert.deepEqual(await claimCall(C, B), { ok: false, busy: 'callee' });
assert.equal(await getPeer(B), A, 'losing caller corrupted the existing call');
assert.equal(await getPeer(C), null, 'losing caller left itself marked busy');

// A is already engaged, so A cannot start a second call either.
assert.deepEqual(await claimCall(A, C), { ok: false, busy: 'caller' });
// ...and C must be released, not stranded by the failed attempt.
assert.equal(await getPeer(C), null, 'callee stranded after caller-busy failure');

// Answering upgrades both to the long lease.
await confirmCall(A, B);
assert.equal(redis.store.get('call:busy:userA').ttl, CONNECTED_TTL_SECONDS);
assert.equal(redis.store.get('call:busy:userB').ttl, CONNECTED_TTL_SECONDS);

// Busy lookup is one round trip and reports both parties.
const busy = await filterBusy([A, B, C]);
assert.ok(busy.has(A) && busy.has(B) && !busy.has(C));

// Hanging up frees both.
assert.equal(await endCall(A), B);
assert.equal(await getPeer(A), null);
assert.equal(await getPeer(B), null);

// A stale "end" from a previous call must not tear down a newer one.
assert.deepEqual(await claimCall(B, C), { ok: true });
assert.equal(await releaseIfPeer(B, A), false, 'stale release killed a live call');
assert.equal(await getPeer(B), C, 'live call was torn down by a stale event');

// Self-calls are refused.
assert.deepEqual(await claimCall(A, A), { ok: false, busy: 'callee' });

console.log('callState self-check passed (claim race, stale release, TTL upgrade)');
