import assert from 'node:assert/strict';
import { buildActivitySeries, ACTIVITY_DAYS } from './activity.controller.js';

const s = buildActivitySeries({ '2026-03-12': 3, '2026-03-01': 1, '2025-01-01': 9 }, '2026-03-12');
assert.equal(s.length, ACTIVITY_DAYS);
assert.deepEqual(s.at(-1), { date: '2026-03-12', count: 3 }, 'newest last');
assert.equal(s[0].date, '2025-11-21', '112 days inclusive');
assert.equal(s.find((d) => d.date === '2026-03-01').count, 1);
assert.equal(s.reduce((a, d) => a + d.count, 0), 4, 'out-of-range days dropped, rest zero-filled');
assert.equal(new Set(s.map((d) => d.date)).size, ACTIVITY_DAYS, 'no duplicate days');
// Leap-year February rolls over correctly.
assert.deepEqual(buildActivitySeries({}, '2028-03-01', 3).map((d) => d.date), ['2028-02-28', '2028-02-29', '2028-03-01']);
console.log('activity series tests passed');
process.exit(0);
