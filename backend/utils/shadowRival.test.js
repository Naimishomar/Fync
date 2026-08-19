// Run: TZ=UTC node utils/shadowRival.test.js
//
// Shadow Rival is anonymous, so nobody can eyeball a wrong pairing or a wrong
// leader — these checks are the only thing standing between the feature and
// silently comparing two strangers from different years.
import assert from 'node:assert/strict';
import {
  currentSeason, snapshot, progress, totalProgress, leaderOf, pairUp, seasonState,
  eligibilityFilter, REMATCH_BUDGET,
} from './shadowRival.js';

// ── seasons reveal at the boundary, never mid-semester ──────────────────────
const spring = currentSeason(new Date(Date.UTC(2026, 2, 15)));
assert.equal(spring.season, '2026-SPRING');
assert.equal(spring.revealAt.toISOString(), '2026-07-01T00:00:00.000Z');

const fall = currentSeason(new Date(Date.UTC(2026, 10, 2)));
assert.equal(fall.season, '2026-FALL');
assert.equal(fall.revealAt.toISOString(), '2027-01-01T00:00:00.000Z');

// ── progress is a delta off the pairing snapshot, and never negative ────────
const start = snapshot({ codingStats: { totalSolved: 100 }, githubStats: { totalCommits: 40 }, streakCount: 3 });
assert.deepEqual(start, { solved: 100, commits: 40, streak: 3 });

const later = snapshot({ codingStats: { totalSolved: 130 }, githubStats: { totalCommits: 55 }, streakCount: 0 });
const p = progress(start, later);
// A broken streak must read as 0 gained, not -3 — a scraped counter that goes
// down (profile reset, deleted repos) would otherwise show negative bars.
assert.deepEqual(p, { solved: 30, commits: 15, streak: 0 });
assert.equal(totalProgress(p), 45);

assert.deepEqual(snapshot({}), { solved: 0, commits: 0, streak: 0 }, 'a user with nothing linked is all zeros, not NaN');

// ── leader is best-of-three, and a 1-1-1 split leaves the lead alone ────────
const A = { solved: 10, commits: 5, streak: 4 };
const B = { solved: 2, commits: 9, streak: 1 };
assert.equal(leaderOf(A, B, null), 'a', 'wins solved and streak');
assert.equal(leaderOf(B, A, null), 'b');

const tieSplit = leaderOf({ solved: 9, commits: 1, streak: 5 }, { solved: 1, commits: 9, streak: 5 }, 'b');
assert.equal(tieSplit, 'b', 'a 1-1-1 split must not flip the lead, or both sides get pinged nightly');

assert.equal(leaderOf({ solved: 0, commits: 0, streak: 0 }, { solved: 0, commits: 0, streak: 0 }, null), null,
  'two idle users have no leader');

// ── pairing crosses colleges but never years, and matches on strength ───────
const u = (id, college, year, major, solved) => ({
  _id: id, college, year, major, codingStats: { totalSolved: solved }, githubStats: {}, streakCount: 0,
});
const pairs = pairUp([
  u('p1', 'NIT', '3', 'CSE', 500),
  u('p2', 'NIT', '3', 'CSE', 10),
  u('p3', 'IIT', '3', 'ECE', 12),   // other college, other branch — still matchable
  u('p4', 'BITS', '3', 'MECH', 480),
  u('p5', 'NIT', '2', 'CSE', 50),   // different year, no partner
]);
const asIds = pairs.map(([x, y]) => [x._id, y._id].sort().join('+')).sort();
assert.deepEqual(asIds, ['p1+p4', 'p2+p3'], 'pair the two beginners and the two veterans, across colleges');
assert.ok(!JSON.stringify(pairs).includes('p5'), 'a year with one user leaves them unpaired');

const odd = pairUp([u('q1', 'NIT', '2', 'CSE', 1), u('q2', 'IIT', '2', 'ECE', 2), u('q3', 'BITS', '2', 'CSE', 3)]);
assert.equal(odd.length, 1, 'an odd year cohort leaves exactly one user for the next run');

// ── the avoid list keeps a rematch from handing back the same person ────────
const withAvoid = (id, year, solved, avoid = []) => ({
  _id: id, year, codingStats: { totalSolved: solved }, githubStats: {}, streakCount: 0,
  shadowRival: { avoid },
});

// r1 and r2 are the closest pair by strength, but they just rerolled each other.
const rerolled = pairUp([
  withAvoid('r1', '3', 10, ['r2']),
  withAvoid('r2', '3', 12, ['r1']),
  withAvoid('r3', '3', 14),
  withAvoid('r4', '3', 16),
]).map(([x, y]) => [x._id, y._id].sort().join('+')).sort();
assert.deepEqual(rerolled, ['r1+r3', 'r2+r4'], 'an excluded neighbour is skipped, not re-paired');

// One-sided exclusion is enough: whoever opted out or rerolled, both are spared.
const oneSided = pairUp([
  withAvoid('s1', '3', 10),
  withAvoid('s2', '3', 12, ['s1']),
  withAvoid('s3', '3', 14),
]).map(([x, y]) => [x._id, y._id].sort().join('+'));
assert.ok(!oneSided.includes('s1+s2'), 'an exclusion recorded on either side must hold');

// A user everybody avoids is left unpaired rather than force-matched.
const shunned = pairUp([
  withAvoid('t1', '3', 10, ['t2', 't3']),
  withAvoid('t2', '3', 12),
  withAvoid('t3', '3', 14),
]).map(([x, y]) => [x._id, y._id].sort().join('+'));
assert.deepEqual(shunned, ['t2+t3'], 'no acceptable partner means no pair, not a bad pair');

// ── opting out removes a user from the pool ─────────────────────────────────
assert.deepEqual(
  eligibilityFilter(new Date())['shadowRival.optOut'], { $ne: true },
  'opted-out users must never be handed a new rival'
);

// ── rematch budget and exclusions expire with the season ────────────────────
const spent = { shadowRival: { season: '2026-SPRING', rematchesUsed: 1, avoid: ['x'] } };
assert.deepEqual(seasonState(spent, '2026-SPRING'), { rematchesUsed: 1, avoid: ['x'] });
assert.deepEqual(
  seasonState(spent, '2026-FALL'), { rematchesUsed: 0, avoid: [] },
  'a new season restores the budget without a cleanup job'
);
assert.deepEqual(seasonState({}, '2026-FALL'), { rematchesUsed: 0, avoid: [] }, 'a user who never played starts clean');
assert.ok(REMATCH_BUDGET >= 1, 'there must be at least one reroll, or the button is a lie');

console.log('✅ shadowRival: all checks passed');
