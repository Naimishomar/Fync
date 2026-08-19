/**
 * Event dates and times are Indian campus wall-clock, but the server runs in
 * UTC. Both event controllers were mixing the two:
 *
 *   new Date(date).setHours(17, 0)   // 17:00 in the SERVER's zone, not IST
 *   new Date().toISOString().slice(0,10)  // UTC's calendar date, not IST's
 *
 * Between 00:00 and 05:30 IST those disagree, so "today" was yesterday and a
 * bootcamp's first attendance scan of the morning failed with "not scheduled
 * for <yesterday>". Everything below does the arithmetic on a fixed +05:30
 * offset instead of nudging Date objects between zones.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India has no DST.

/** The IST calendar date as "YYYY-MM-DD". */
export const istDateKey = (instant = new Date()) =>
  new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The UTC instant at which the given IST calendar day begins. */
export const istDayStart = (dateKey = istDateKey()) =>
  new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() - IST_OFFSET_MS);

/**
 * The UTC instant of an IST wall-clock time on an IST calendar day.
 * Accepts "5:00 PM", "05:00 PM" and 24-hour "17:00". Returns null if the string
 * is not a time, so callers can fall back rather than silently use Invalid Date.
 */
export const istInstant = (dateKey, timeStr) => {
  const match = String(timeStr || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const modifier = match[3]?.toUpperCase();

  if (minutes > 59) return null;
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  if (hours > 23) return null;

  return new Date(istDayStart(dateKey).getTime() + (hours * 60 + minutes) * 60 * 1000);
};

/**
 * Whole IST calendar days between two instants (b - a). Day-boundary logic --
 * streaks, "did this happen today" -- must count calendar days in the user's
 * zone, not 24-hour blocks in the server's.
 */
export const istDayDiff = (a, b) =>
  Math.round((istDayStart(istDateKey(b)).getTime() - istDayStart(istDateKey(a)).getTime()) / 86400000);

/** "YYYY-MM-DD" for a stored Date, read as an IST calendar day. */
export const toDateKey = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : istDateKey(d);
};

/* Self-check: node utils/eventTime.js */
if (process.argv[1]?.endsWith("eventTime.js")) {
  const assert = (await import("node:assert/strict")).default;

  // 02:00 IST on the 19th is 20:30 UTC on the 18th. The UTC date is a day
  // behind — the exact case that broke morning attendance.
  const earlyMorningIST = new Date("2026-08-18T20:30:00.000Z");
  assert.equal(istDateKey(earlyMorningIST), "2026-08-19");
  assert.equal(earlyMorningIST.toISOString().slice(0, 10), "2026-08-18");

  assert.equal(istDayStart("2026-08-19").toISOString(), "2026-08-18T18:30:00.000Z");
  assert.equal(istInstant("2026-08-19", "5:00 PM").toISOString(), "2026-08-19T11:30:00.000Z");
  assert.equal(istInstant("2026-08-19", "17:00").toISOString(), "2026-08-19T11:30:00.000Z");
  assert.equal(istInstant("2026-08-19", "12:00 AM").toISOString(), "2026-08-18T18:30:00.000Z");
  assert.equal(istInstant("2026-08-19", "12:30 PM").toISOString(), "2026-08-19T07:00:00.000Z");
  assert.equal(istInstant("2026-08-19", "garbage"), null);
  assert.equal(istInstant("2026-08-19", ""), null);
  assert.equal(toDateKey(new Date("2026-08-18T20:30:00.000Z")), "2026-08-19");

  // Streak arithmetic. 23:00 IST on the 19th and 01:00 IST on the 20th are
  // consecutive IST days, even though in UTC they are 17:30 and 19:30 on the
  // SAME day -- which is why server-local maths dropped the user's streak.
  const nightOf19 = new Date("2026-08-19T17:30:00.000Z"); // 23:00 IST 19th
  const earlyOn20 = new Date("2026-08-19T19:30:00.000Z"); // 01:00 IST 20th
  assert.equal(nightOf19.toISOString().slice(0, 10), earlyOn20.toISOString().slice(0, 10));
  assert.equal(istDayDiff(nightOf19, earlyOn20), 1);
  assert.equal(istDayDiff(earlyOn20, earlyOn20), 0);
  // 2026-08-21T19:30Z is 01:00 IST on the 22nd, i.e. three IST days after the 19th.
  assert.equal(istDayDiff(nightOf19, new Date("2026-08-21T19:30:00.000Z")), 3);
  assert.equal(istDayDiff(nightOf19, new Date("2026-08-21T10:00:00.000Z")), 2); // 15:30 IST 21st

  console.log("eventTime self-check passed");
}
