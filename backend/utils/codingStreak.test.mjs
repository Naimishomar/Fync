import assert from 'node:assert/strict';

/**
 * The gate that decides whether a sync counts as activity. This is the piece
 * that is easy to get wrong: the sync runs every few minutes regardless of what
 * the student did, so an unconditional call keeps dead streaks alive forever.
 */
const shouldCountAsActivity = (previous, total) =>
  previous !== null && previous !== undefined && total > previous;

// First sync ever: record the baseline, award nothing. Otherwise every new user
// gets a streak for problems they solved before signing up.
assert.equal(shouldCountAsActivity(null, 500), false);
assert.equal(shouldCountAsActivity(undefined, 500), false);

// Sync with no new solves — the common case, several times an hour.
assert.equal(shouldCountAsActivity(120, 120), false);

// Actually solved something.
assert.equal(shouldCountAsActivity(120, 121), true);

// Count went down (profile reset, unlinked account): not activity, and must not
// throw the snapshot out of step.
assert.equal(shouldCountAsActivity(120, 90), false);

// Zero is a real baseline, not "unset" — a brand new LeetCode account at 0 that
// solves its first problem must count.
assert.equal(shouldCountAsActivity(0, 1), true);

console.log('coding streak gate: all assertions passed');
