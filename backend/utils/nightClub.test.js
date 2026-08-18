// node utils/nightClub.test.js — no DB, no Redis.
// Every case is asserted while the process runs in UTC, which is what a
// deployed node:20-slim container actually is.
import assert from 'node:assert/strict';
import { checkClubStatus, clubTimeNow, clubDateKey, nightPseudonym } from './nightClub.js';

assert.equal(process.env.TZ, 'UTC', 'run me with TZ=UTC — that is the deployed reality');

const at = (iso) => checkClubStatus(new Date(iso));
const hours = (ms) => +(ms / 3600000).toFixed(2);

// IST is UTC+5:30, so 18:30Z is midnight in Kolkata.
assert.equal(clubTimeNow(new Date('2026-08-18T18:30:00Z')).hour, 0);
assert.equal(clubTimeNow(new Date('2026-08-19T12:00:00Z')).hour, 17, '17:30 IST');

// ── the boundaries ─────────────────────────────────────────────────────────
assert.equal(at('2026-08-18T18:29:59Z').isOpen, false, 'one second before midnight IST: shut');
assert.equal(at('2026-08-18T18:30:00Z').isOpen, true,  'midnight IST exactly: open');
assert.equal(at('2026-08-19T00:29:59Z').isOpen, true,  '05:59:59 IST: still open');
assert.equal(at('2026-08-19T00:30:00Z').isOpen, false, '06:00 IST exactly: shut');

// ── half past midnight IST must read OPEN ──────────────────────────────────
// This is the case the old regex got wrong wherever ICU renders en-US as
// "12:30:00 AM": it captured 12, so the club was closed during its own opening.
const halfPastMidnight = at('2026-08-18T19:00:00Z');
assert.equal(halfPastMidnight.hour, 0);
assert.equal(halfPastMidnight.isOpen, true);

// ── the countdown must be in IST, not server-local ─────────────────────────
// 17:30 IST -> midnight IST is 6.5h away. The old code called setHours(24,0,0,0)
// on a UTC server and answered 12h.
assert.equal(hours(at('2026-08-19T12:00:00Z').msUntilOpen), 6.5, 'closed: hours until doors open');
assert.equal(at('2026-08-19T12:00:00Z').msUntilClose, 0, 'no closing countdown while shut');

// 02:00 IST -> closes at 06:00 IST, 4h away.
assert.equal(hours(at('2026-08-18T20:30:00Z').msUntilClose), 4, 'open: hours until last call');
assert.equal(at('2026-08-18T20:30:00Z').msUntilOpen, 0, 'no opening countdown while open');

// A countdown must never exceed a full day or go negative.
for (let m = 0; m < 24 * 60; m += 7) {
  const s = checkClubStatus(new Date(Date.UTC(2026, 7, 19, 0, m, 0)));
  assert.ok(s.msUntilOpen >= 0 && s.msUntilOpen <= 86400000, `msUntilOpen sane at +${m}m`);
  assert.ok(s.msUntilClose >= 0 && s.msUntilClose <= 6 * 3600000, `msUntilClose sane at +${m}m`);
  assert.equal(s.isOpen, s.msUntilClose > 0, `open iff a closing countdown is running (+${m}m)`);
}

// ── per-night pseudonyms ───────────────────────────────────────────────────
const USER_A = '68a1b2c3d4e5f60718293a4b';
const USER_B = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const opensAt = new Date('2026-08-18T18:30:00Z');   // 00:00 IST
const laterSameNight = new Date('2026-08-19T00:29:00Z'); // 05:59 IST, same night
const nextNight = new Date('2026-08-19T19:00:00Z');

// The whole session is one IST calendar day, so an alias cannot change under a
// user mid-conversation.
assert.equal(clubDateKey(opensAt), clubDateKey(laterSameNight), 'one night is one date key');
assert.equal(
  nightPseudonym(USER_A, opensAt), nightPseudonym(USER_A, laterSameNight),
  'alias is stable for the whole night'
);

assert.notEqual(
  nightPseudonym(USER_A, opensAt), nightPseudonym(USER_A, nextNight),
  'alias rotates between nights, so last night cannot be linked to tonight'
);
assert.notEqual(
  nightPseudonym(USER_A, opensAt), nightPseudonym(USER_B, opensAt),
  'different users get different aliases'
);

// The point of the exercise: nothing derivable back to the account.
const pseudo = nightPseudonym(USER_A, opensAt);
assert.ok(!pseudo.includes(USER_A), 'pseudonym must not contain the user id');
assert.match(pseudo, /^[0-9a-f]{16}$/, 'opaque fixed-width hex');

console.log('nightClub: all checks passed ✅');
