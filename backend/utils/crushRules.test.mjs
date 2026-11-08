// Run: node utils/crushRules.test.mjs
import assert from 'node:assert/strict';
import { canRemove, unlockAt, pickError, MAX_PICKS, LOCK_DAYS } from './crushRules.js';

const t0 = new Date('2026-11-08T10:00:00Z');
assert.equal(canRemove(t0, new Date('2026-11-14T09:59:59Z')), false, 'locked for the first 7 days');
assert.equal(canRemove(t0, new Date('2026-11-15T10:00:00Z')), true, 'unlocked after 7 days');
assert.equal(unlockAt(t0).getTime() - t0.getTime(), LOCK_DAYS * 86400000);

const me = { _id: 'a', college: 'IIT D' };
const ok = { me, target: { _id: 'b', college: 'IIT D' }, myPickCount: 0, alreadyPicked: false, blocked: false };
assert.equal(pickError(ok), null);
assert.match(pickError({ ...ok, target: null }), /not found/);
assert.match(pickError({ ...ok, target: { _id: 'a', college: 'IIT D' } }), /yourself/);
assert.match(pickError({ ...ok, target: { _id: 'b', college: 'NIT' } }), /college/);
assert.match(pickError({ ...ok, me: { _id: 'a', college: null } }), /college/, 'no college, no picks');
assert.match(pickError({ ...ok, blocked: true }), /can't pick/);
assert.match(pickError({ ...ok, alreadyPicked: true }), /Already/);
assert.match(pickError({ ...ok, myPickCount: MAX_PICKS }), /up to 3/);
console.log('crushRules ok');
