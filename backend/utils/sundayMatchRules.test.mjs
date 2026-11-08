// Run: node utils/sundayMatchRules.test.mjs
import assert from 'node:assert/strict';
import { pairUp, pairKey, score, compatible, profileError, nextSundayAt } from './sundayMatchRules.js';

const P = (id, o = {}) => ({ id, intent: 'friendship', interestedIn: null, gender: 'Male', interests: ['music'], vibes: [0, 0, 0], priority: false, ...o });

// Scoring: shared interests x2 + same vibe answers.
assert.equal(score(P('a', { interests: ['music', 'gaming'] }), P('b', { interests: ['gaming', 'music'], vibes: [0, 1, 0] })), 6);

// Intent must match; dating respects both sides' interest.
assert.equal(compatible(P('a'), P('b', { intent: 'dating' })), false);
const m = (o) => P('m', { intent: 'dating', gender: 'Male', interestedIn: 'women', ...o });
const f = (o) => P('f', { intent: 'dating', gender: 'Female', interestedIn: 'men', ...o });
assert.equal(compatible(m(), f()), true);
assert.equal(compatible(m(), f({ interestedIn: 'women' })), false, 'one-sided interest is not enough');
assert.equal(compatible(m({ interestedIn: 'everyone' }), P('o', { intent: 'dating', gender: 'Other', interestedIn: 'everyone' })), true);
assert.equal(compatible(m(), P('o', { intent: 'dating', gender: 'Other', interestedIn: 'everyone' })), false);

// Best score wins, one match each, odd one out unmatched.
const ps = [P('a', { interests: ['coding'] }), P('b', { interests: ['coding'] }), P('c', { interests: ['art'] })];
let r = pairUp(ps, new Set(), '2026-11-08');
assert.equal(r.pairs.length, 1);
assert.equal(pairKey(r.pairs[0].a, r.pairs[0].b), 'a|b');
assert.deepEqual(r.pairs[0].sharedInterests, ['coding']);
assert.deepEqual(r.unmatched, ['c']);

// Excluded pairs (blocks / recent) are never paired.
r = pairUp(ps, new Set([pairKey('b', 'a')]), '2026-11-08');
assert.ok(r.pairs.every((p) => pairKey(p.a, p.b) !== 'a|b'));
assert.equal(r.pairs.length, 1);

// Priority person always gets a partner when one exists.
r = pairUp([P('x'), P('y'), P('z', { priority: true })], new Set(), 'w');
assert.ok(!r.unmatched.includes('z'));

// Deterministic.
assert.deepEqual(pairUp(ps, new Set(), 'k'), pairUp([...ps].reverse(), new Set(), 'k'));

// Profile validation.
const user = { college: 'IIT D', gender: 'Male', dob: '2000-01-01' };
const ok = { intent: 'dating', interestedIn: 'women', interests: ['music'], vibes: [0, 1, 2], ageConfirmed: true };
assert.equal(profileError(ok, user), null);
assert.match(profileError({ ...ok, ageConfirmed: false }, user), /18/);
assert.match(profileError(ok, { ...user, dob: '2015-01-01' }), /18\+/);
assert.match(profileError(ok, { ...user, college: '' }), /college/);
assert.match(profileError({ ...ok, interests: Array(9).fill('music') }, user), /interests/);
assert.match(profileError({ ...ok, interests: ['nope'] }, user), /interests/);
assert.match(profileError({ ...ok, vibes: [0, 9, 0] }, user), /vibe/);
assert.match(profileError({ ...ok, interestedIn: 'x' }, user), /interested/);

// Next Sunday 19:00 IST (13:30 UTC). 2026-11-08 is a Sunday.
assert.equal(nextSundayAt(new Date('2026-11-08T10:00:00Z')).toISOString(), '2026-11-08T13:30:00.000Z');
assert.equal(nextSundayAt(new Date('2026-11-08T13:30:00Z')).toISOString(), '2026-11-15T13:30:00.000Z');
assert.equal(nextSundayAt(new Date('2026-11-11T00:00:00Z')).toISOString(), '2026-11-15T13:30:00.000Z');
console.log('sundayMatchRules ok');
