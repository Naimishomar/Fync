// Run: node utils/stayRules.test.mjs
import assert from 'node:assert/strict';
import { parseStay, renewError, listQuery } from './stayRules.js';

const now = new Date('2026-11-08T10:00:00Z');
const ok = { kind: 'pg', title: 'Sunrise PG', rent: '7500', area: 'Hauz Khas', amenities: 'wifi,ac,bogus' };
const { stay } = parseStay(ok, now);
assert.equal(stay.rent, 7500);
assert.deepEqual(stay.amenities, ['wifi', 'ac'], 'unknown amenities dropped, comma string accepted');
assert.equal(stay.forGender, 'any');
assert.deepEqual(stay.habits, [], 'roommate fields only for roommate');
assert.deepEqual(parseStay({ ...ok, amenities: ['gym', 'gym'] }, now).stay.amenities, ['gym']);
assert.match(parseStay({ ...ok, kind: 'hotel' }, now).error, /PG/);
assert.match(parseStay({ ...ok, title: 'x' }, now).error, /title/);
assert.match(parseStay({ ...ok, rent: '499' }, now).error, /Rent/);
assert.match(parseStay({ ...ok, rent: '7500.5' }, now).error, /Rent/);
assert.match(parseStay({ ...ok, distanceKm: '51' }, now).error, /Distance/);
assert.equal(parseStay({ ...ok, distanceKm: '1.26' }, now).stay.distanceKm, 1.3);
assert.equal(parseStay({ ...ok, distanceKm: '' }, now).stay.distanceKm, null);
assert.equal(parseStay({ ...ok, title: 'a'.repeat(90) }, now).stay.title.length, 70);

const rm = parseStay({ ...ok, kind: 'roommate', moveIn: '2026-12-01', budget: '6000', habits: ['clean', 'nope'] }, now).stay;
assert.equal(rm.budget, 6000);
assert.deepEqual(rm.habits, ['clean']);
assert.match(parseStay({ ...ok, kind: 'roommate', moveIn: '2030-01-01' }, now).error, /Move-in/);

assert.equal(renewError({ expiresAt: new Date('2026-11-09'), renewed: false }, now), null);
assert.match(renewError({ expiresAt: new Date('2026-11-09'), renewed: true }, now), /once/);
assert.match(renewError({ expiresAt: new Date('2026-11-01'), renewed: false }, now), /not found/);

const a = listQuery({ kind: 'pg', maxRent: '9000', gender: 'female', food: 'veg', amenities: 'wifi,zzz' }, 'IIT D', now);
assert.deepEqual(a.filter.forGender, { $in: ['female', 'any'] });
assert.deepEqual(a.filter.food, { $in: ['veg', 'both'] });
assert.deepEqual(a.filter.amenities, { $all: ['wifi'] });
assert.deepEqual(a.filter.rent, { $lte: 9000 });
assert.deepEqual(a.sort, { createdAt: -1, _id: -1 });
const id = 'a'.repeat(24);
const b = listQuery({ sort: 'cheapest', cursor: `7000_${id}` }, 'IIT D', now);
assert.deepEqual(b.filter.$or, [{ rent: { $gt: 7000 } }, { rent: 7000, _id: { $gt: id } }]);
assert.equal(b.cursorOf({ rent: 8000, _id: id }), `8000_${id}`);
const c = listQuery({ cursor: `${now.getTime()}_${id}` }, 'IIT D', now);
assert.deepEqual(c.filter.$or[0], { createdAt: { $lt: now } });
assert.equal(listQuery({ cursor: 'junk' }, 'X', now).filter.$or, undefined, 'bad cursor ignored');
assert.equal(listQuery({ kind: 'castle', gender: 'x' }, 'X', now).filter.kind, undefined);
console.log('stayRules ok');
