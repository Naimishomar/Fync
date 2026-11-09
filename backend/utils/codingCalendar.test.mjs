import assert from 'node:assert/strict';
import { mergeCounts, computeStreaks } from './codingCalendar.js';

assert.deepEqual(mergeCounts([{ '2026-11-08': 2 }, { '2026-11-08': 1, '2026-11-07': 3 }, {}]), { '2026-11-08': 3, '2026-11-07': 3 });

// Today empty: streak still counts back from yesterday.
const c = { '2026-11-08': 1, '2026-11-07': 4, '2026-11-06': 1, '2026-11-03': 1, '2026-11-02': 1 };
assert.deepEqual(computeStreaks(c, '2026-11-09'), { current: 3, best: 3 });
assert.deepEqual(computeStreaks({ ...c, '2026-11-09': 1 }, '2026-11-09'), { current: 4, best: 4 });
// Gap of two days breaks it; best survives.
assert.deepEqual(computeStreaks({ '2026-11-01': 1, '2026-10-31': 1 }, '2026-11-09'), { current: 0, best: 2 });
// Month and year boundaries.
assert.deepEqual(computeStreaks({ '2026-01-01': 1, '2025-12-31': 1, '2025-12-30': 1 }, '2026-01-01'), { current: 3, best: 3 });
assert.deepEqual(computeStreaks({}, '2026-11-09'), { current: 0, best: 0 });
console.log('coding calendar tests passed');
process.exit(0);
