import assert from 'node:assert/strict';
import { pickNudge } from './streakNudge.js';
import { lastSevenKeys } from './weeklyRecap.js';

const me = { streakCount: 10 };
// Closest live streak above mine wins; dead and lower ones are ignored.
const n = pickNudge(me, [
  { name: 'Far', streakCount: 40, alive: true },
  { name: 'Aman', streakCount: 12, alive: true },
  { name: 'Dead', streakCount: 11, alive: false },
  { name: 'Low', streakCount: 3, alive: true },
]);
assert.match(n.title, /^Aman is on a 12 day streak/);
assert.match(n.body, /Yours is 10 days/);
// Nobody ahead: plain at-risk nudge, singular day.
assert.match(pickNudge({ streakCount: 1 }, [{ name: 'Low', streakCount: 1, alive: true }]).title, /Your 1 day streak ends/);
assert.match(pickNudge({ streakCount: 5 }).title, /^Your 5 day streak ends/);

assert.deepEqual(lastSevenKeys('2026-03-02'), ['2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
console.log('streak nudge + recap tests passed');
process.exit(0);
