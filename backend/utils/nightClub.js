// The 12 AM Club opens at midnight and closes at 6 AM — in India, not in
// whatever timezone the server happens to run in. `node:20-slim` sets no TZ, so
// a deployed box is UTC and every piece of local-time arithmetic here is 5.5
// hours out.
//
// One definition, used by the socket gate, the countdown the client shows, and
// the sunrise wipe, so those three cannot drift apart.

import crypto from 'node:crypto';

export const CLUB_TIMEZONE = 'Asia/Kolkata';
export const CLUB_OPEN_HOUR = 0;   // 00:00 IST
export const CLUB_CLOSE_HOUR = 6;  // 06:00 IST

const SECONDS_PER_DAY = 86400;

// `toLocaleString(...).match(/,\s*(\d+):/)` was the old approach. It depends on
// en-US formatting the time as 24-hour: on an ICU build that emits
// "8/19/2026, 12:30:00 AM" the regex captures 12, and the club reads as CLOSED
// at half past midnight — precisely when it should be open. formatToParts asks
// for the hour instead of parsing it back out of a display string.
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIMEZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const clubTimeNow = (now = new Date()) => {
  const parts = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    // h23 should never yield 24, but normalise rather than trust it.
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
};

export const checkClubStatus = (now = new Date()) => {
  const { hour, minute, second } = clubTimeNow(now);
  const isOpen = hour >= CLUB_OPEN_HOUR && hour < CLUB_CLOSE_HOUR;
  const secondsIntoDay = hour * 3600 + minute * 60 + second;

  return {
    isOpen,
    hour,
    // Time arithmetic in seconds-since-IST-midnight, so no Date object ever has
    // to be nudged across a timezone.
    msUntilOpen: isOpen ? 0 : (SECONDS_PER_DAY - secondsIntoDay) * 1000,
    msUntilClose: isOpen ? (CLUB_CLOSE_HOUR * 3600 - secondsIntoDay) * 1000 : 0,
  };
};

// The IST calendar date. A club session runs 00:00-06:00 IST, so this is
// constant for a whole night and rolls over between them.
export const clubDateKey = (now = new Date()) => {
  const p = {};
  for (const part of dateFormatter.formatToParts(now)) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  return `${p.year}-${p.month}-${p.day}`;
};

// Stable across workers and restarts, which matters: PM2 runs two instances, so
// a per-process random key would give the same person a different alias
// depending on which worker handled the message. Derived from JWT_SECRET with a
// domain separator rather than reusing it directly, so this value never
// discloses the signing key.
const pseudonymKey =
  process.env.NIGHT_CLUB_SECRET ||
  crypto.createHash('sha256').update(`night-club-pseudonym:${process.env.JWT_SECRET ?? ''}`).digest();

// A user's identity inside the club, for one night only.
//
// Real user ids used to travel with every message. They are not names, but they
// are stable handles: anyone logging a night's traffic could line them up
// against any other endpoint that returns a user id and de-anonymise the room.
// An HMAC is unlinkable to the account without the key, and unlinkable to the
// same person's alias on any other night.
export const nightPseudonym = (userId, now = new Date()) =>
  crypto
    .createHmac('sha256', pseudonymKey)
    .update(`${clubDateKey(now)}:${userId}`)
    .digest('hex')
    .slice(0, 16);
