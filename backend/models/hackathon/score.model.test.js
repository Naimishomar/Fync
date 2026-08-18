// node models/hackathon/score.model.test.js  — no DB needed.
import assert from 'node:assert/strict';
import Score, { weightedTotal } from './score.model.js';

// Weighted average, not a plain mean: weightage must actually weigh.
assert.equal(weightedTotal([{ score: 10, weightage: 3 }, { score: 2, weightage: 1 }]), 8);
assert.equal(weightedTotal([{ score: 5, weightage: 1 }]), 5);
// Degenerate inputs must be 0, never NaN — NaN poisons the whole leaderboard sort.
assert.equal(weightedTotal([]), 0);
assert.equal(weightedTotal(undefined), 0);
assert.equal(weightedTotal([{ score: 7, weightage: 0 }]), 0);

// submitScore upserts via findOneAndUpdate; without this hook totalScore is
// never written and every project ranks 0.
const hooks = Score.schema.s.hooks._pres.get('findOneAndUpdate') || [];
assert.ok(hooks.length > 0, 'findOneAndUpdate pre-hook missing — totalScore will not be computed on upsert');

console.log('score.model tests passed ✅');
