// Run: node utils/r2Upload.test.mjs (needs dummy R2_* env, see package.json test)
import assert from 'node:assert/strict';
import { mapLimit } from './r2Upload.js';

let inFlight = 0, peak = 0;
const seen = [];
await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
  inFlight++; peak = Math.max(peak, inFlight);
  await new Promise((r) => setTimeout(r, 5));
  seen.push(n); inFlight--;
});
assert.equal(peak, 2, 'at most two encodes in flight');
assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5]);
await mapLimit([], 2, async () => { throw new Error('never'); });
await assert.rejects(mapLimit([1, 2], 2, async (n) => { if (n === 2) throw new Error('R2 down'); }), /R2 down/,
  'a failed upload must surface so the middleware answers 500');
console.log('r2Upload mapLimit tests passed');
