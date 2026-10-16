import assert from 'node:assert/strict';
import { removeFromQueue } from './quizQueue.js';

// Minimal list-backed Redis stand-in with the LPUSH/RPOP/LRANGE/LREM semantics.
class FakeRedis {
  constructor() { this.lists = new Map(); }
  l(k) { if (!this.lists.has(k)) this.lists.set(k, []); return this.lists.get(k); }
  async lPush(k, v) { return this.l(k).unshift(v); }
  async rPop(k) { return this.l(k).pop() ?? null; }
  async lRange(k) { return [...this.l(k)]; }
  async lRem(k, _count, v) {
    const before = this.l(k).length;
    this.lists.set(k, this.l(k).filter(x => x !== v));
    return before - this.l(k).length;
  }
}

const redis = new FakeRedis();
const Q = 'queue:DSA';
const a = JSON.stringify({ userId: 'A', socketId: 'sA', name: 'a' });
const b = JSON.stringify({ userId: 'B', socketId: 'sB', name: 'b' });
await redis.lPush(Q, a);
await redis.lPush(Q, b);

// Cancel removes only this socket's entry; the matcher then can't pop it.
assert.equal(await removeFromQueue(redis, Q, 'sA'), 1);
assert.deepEqual(await redis.lRange(Q), [b]);
assert.equal(await redis.rPop(Q), b);
assert.equal(await redis.rPop(Q), null);

// No-op when absent, when queue empty/missing, or with no queue/socket.
assert.equal(await removeFromQueue(redis, Q, 'sA'), 0);
assert.equal(await removeFromQueue(redis, 'queue:nope', 'sA'), 0);
assert.equal(await removeFromQueue(redis, undefined, 'sA'), 0);
assert.equal(await removeFromQueue(redis, Q, undefined), 0);

console.log('quizQueue tests passed');
