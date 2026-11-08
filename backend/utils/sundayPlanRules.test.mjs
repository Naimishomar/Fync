// Run: node utils/sundayPlanRules.test.mjs
import assert from 'node:assert/strict';
import { sundayWindow, parsePlan, joinError } from './sundayPlanRules.js';

// Sun 8 Nov 2026. 10:00 IST Sunday = 04:30Z.
const sunMorning = new Date('2026-11-08T04:30:00Z');
let w = sundayWindow(sunMorning);
assert.equal(w.start.toISOString(), '2026-11-07T18:30:00.000Z', 'Sunday: today');
assert.equal(w.expiresAt.toISOString(), '2026-11-09T00:30:00.000Z', 'Mon 06:00 IST');
// Sat 23:00 IST (17:30Z) -> tomorrow. Mon 01:00 IST (Sun 19:30Z, UTC still Sunday) -> next Sunday.
assert.equal(sundayWindow(new Date('2026-11-07T17:30:00Z')).start.toISOString(), '2026-11-07T18:30:00.000Z');
assert.equal(sundayWindow(new Date('2026-11-08T19:30:00Z')).start.toISOString(), '2026-11-14T18:30:00.000Z');

const ok = { title: 'Movie night', category: 'movie', place: 'Hostel B terrace', capacity: 10, startsAt: '2026-11-08T13:30:00Z', bring: ['chips', ' chips ', 'speaker'] };
const p = parsePlan(ok, sunMorning);
assert.equal(p.error, undefined);
assert.deepEqual(p.plan.bring, ['chips', 'speaker'], 'deduped + trimmed');
assert.match(parsePlan({ ...ok, startsAt: '2026-11-09T13:30:00Z' }, sunMorning).error, /Sunday/, 'Monday refused');
assert.match(parsePlan({ ...ok, startsAt: '2026-11-08T04:00:00Z' }, sunMorning).error, /passed/);
assert.match(parsePlan({ ...ok, capacity: 51 }, sunMorning).error, /Capacity/);
assert.match(parsePlan({ ...ok, capacity: 1 }, sunMorning).error, /Capacity/);
assert.match(parsePlan({ ...ok, category: 'rave' }, sunMorning).error, /vibe/);
assert.match(parsePlan({ ...ok, title: 'x' }, sunMorning).error, /title/);
assert.equal(parsePlan({ ...ok, bring: Array.from({ length: 12 }, (_, i) => `i${i}`) }, sunMorning).plan.bring.length, 8);

const plan = { host: 'h', college: 'IIT D', capacity: 3, bring: ['chips'], attendees: [], kicked: [], expiresAt: new Date('2026-11-09T00:30:00Z') };
const me = { _id: 'a', college: 'IIT D' };
const j = (o) => joinError({ plan, me, blocked: false, now: sunMorning, ...o });
assert.equal(j({}), null);
assert.equal(j({ bringing: 'chips' }), null);
assert.match(j({ bringing: 'cake' }), /bring list/);
assert.match(j({ plan: { ...plan, attendees: [{ user: 'b', bringing: 'chips' }] }, bringing: 'chips' }), /already bringing/);
assert.match(j({ plan: { ...plan, attendees: [{ user: 'b' }, { user: 'c' }] } }), /full/, 'host counts toward capacity');
assert.match(j({ plan: { ...plan, attendees: [{ user: 'a' }] } }), /already in/);
assert.match(j({ me: { _id: 'h', college: 'IIT D' } }), /hosting/);
assert.match(j({ me: { _id: 'a', college: 'NIT' } }), /another college/);
assert.match(j({ blocked: true }), /can't join/);
assert.match(j({ plan: { ...plan, kicked: ['a'] } }), /removed/);
assert.match(j({ now: new Date('2026-11-09T01:00:00Z') }), /not found/, 'expired');
console.log('sundayPlanRules ok');
