// Run: node models/community/communityPost.model.test.js
//
// Hot ranking is the whole difference between a Reddit feed and a "new posts"
// list. It is also the easiest thing to get subtly wrong and never notice, since
// a broken formula still produces *an* ordering.
import assert from 'node:assert/strict';
import { hotScore } from './communityPost.model.js';

const at = (iso) => new Date(iso);
const T0 = at('2026-08-19T12:00:00Z');
const hoursBefore = (h) => new Date(T0.getTime() - h * 3600 * 1000);

// ── score raises rank, age lowers it ────────────────────────────────────────
assert.ok(hotScore(100, T0) > hotScore(10, T0), 'more upvotes ranks higher at equal age');
assert.ok(hotScore(10, T0) > hotScore(10, hoursBefore(24)), 'the newer of two equal posts ranks higher');

// ── votes are logarithmic: the 10th vote is worth as much as the next 90 ────
const gain1to10 = hotScore(10, T0) - hotScore(1, T0);
const gain10to100 = hotScore(100, T0) - hotScore(10, T0);
assert.ok(Math.abs(gain1to10 - gain10to100) < 1e-6, 'each order of magnitude must be worth the same');

// ── 12.5h of age is worth exactly one order of magnitude of votes ───────────
// This is the property that stops the front page freezing on whatever went viral
// once: 45000 seconds is the exchange rate between age and 10x the score.
assert.ok(
  Math.abs(hotScore(10, T0) - hotScore(100, hoursBefore(12.5))) < 1e-6,
  'a fresh 10-vote post and a 12.5h-old 100-vote post must tie exactly'
);
assert.ok(hotScore(100, hoursBefore(12)) > hotScore(10, T0), 'younger than 12.5h, the 100-vote post still wins');
assert.ok(hotScore(10, T0) > hotScore(100, hoursBefore(13)), 'older than 12.5h, the fresh post takes over');

// ── downvoted posts sink below undecided ones of the same age ───────────────
assert.ok(hotScore(0, T0) > hotScore(-5, T0), 'a downvoted post ranks below an unvoted one');
assert.ok(hotScore(2, T0) > hotScore(0, T0), 'upvotes lift a post above an unvoted one');

// ── the -1/0/+1 band is flat, exactly as on Reddit ──────────────────────────
// log10(max(|s|,1)) is 0 for all three, so a single vote either way moves
// nothing and brand-new posts are ordered purely by recency. Removing the
// max(...,1) clamp would send a 0-score post to -Infinity instead.
assert.equal(hotScore(1, T0), hotScore(0, T0), 'the first upvote changes nothing');
assert.equal(hotScore(-1, T0), hotScore(0, T0), 'the first downvote costs nothing');
assert.ok(Number.isFinite(hotScore(0, T0)), 'a zero score must never produce -Infinity');

// ── ordering a real feed ────────────────────────────────────────────────────
const feed = [
  { id: 'viral-yesterday', s: 400, t: hoursBefore(26) },
  { id: 'hot-now', s: 25, t: hoursBefore(1) },
  { id: 'dead-new', s: 0, t: hoursBefore(0.5) },
  { id: 'controversial', s: -8, t: hoursBefore(2) },
].map((p) => ({ ...p, hot: hotScore(p.s, p.t) }))
 .sort((a, b) => b.hot - a.hot)
 .map((p) => p.id);
// 400 votes is 2.6 orders of magnitude; 26h of age costs 2.08. Yesterday's
// viral post therefore still outranks a 30-minute-old post nobody voted on —
// and both sit above the downvoted one.
assert.deepEqual(feed, ['hot-now', 'viral-yesterday', 'dead-new', 'controversial']);

console.log('✅ communityPost hot ranking: all checks passed');
