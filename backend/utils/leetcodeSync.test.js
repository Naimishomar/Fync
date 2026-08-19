// Run: node utils/leetcodeSync.test.js
//
// The whole point of this module is that a LeetCode username is fetched at most
// once per cooldown window no matter how many callers ask at once. These checks
// pin the two pieces that guarantee it: the worker pool never exceeds its size,
// and freshness is decided from a timestamp, not from hope.
import assert from 'node:assert/strict';
import { runPool, isFresh, COOLDOWN_SECONDS } from './leetcodeSync.js';

// ── the pool never runs more than `size` tasks at once ──────────────────────
let inFlight = 0, peak = 0;
const order = [];
await runPool([1, 2, 3, 4, 5, 6, 7], 2, async (n) => {
  inFlight++; peak = Math.max(peak, inFlight);
  await new Promise((r) => setTimeout(r, 5));
  order.push(n);
  inFlight--;
});
assert.equal(peak, 2, 'concurrency cap is the rate limit — exceeding it is the bug this replaced');
assert.equal(order.length, 7, 'every item must run exactly once');
assert.deepEqual([...order].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);

// ── one task throwing must not strand the rest of the batch ─────────────────
const done = [];
await runPool([1, 2, 3], 2, async (n) => {
  if (n === 2) throw new Error('LeetCode 503');
  done.push(n);
});
assert.deepEqual(done.sort(), [1, 3], 'a failed user must not abort the sweep');

// ── an empty batch must not hang on zero workers ────────────────────────────
await runPool([], 4, async () => { throw new Error('never called'); });

// ── freshness ───────────────────────────────────────────────────────────────
const now = new Date('2026-08-19T12:00:00Z');
assert.equal(isFresh(null, now), false, 'a never-synced user is always stale');
assert.equal(isFresh(undefined, now), false);
assert.equal(isFresh(new Date('2026-08-19T11:59:00Z'), now), true, 'synced 1 min ago — still fresh');
assert.equal(isFresh(new Date('2026-08-19T11:40:00Z'), now), false, 'synced 20 min ago — stale');
assert.equal(
  isFresh(new Date(now.getTime() - COOLDOWN_SECONDS * 1000), now), false,
  'exactly one window old counts as stale, so the queue can never stall'
);

console.log('✅ leetcodeSync: all checks passed');

// The module pulls in the shared Redis client, which retries forever and keeps
// the event loop alive. Nothing here needs a graceful shutdown.
process.exit(0);
