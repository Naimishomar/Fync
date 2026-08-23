import cron from 'node-cron';
import Contest from '../models/coding/contest.model.js';
import Problem from '../models/coding/problem.model.js';

/**
 * Schedules the weekly contest: three problems, a three hour window, one per
 * difficulty.
 *
 * Nothing here runs the contest — ContestManager.monitorContests already flips
 * Upcoming to Ongoing to Completed on the clock, and scoring happens per
 * submission. This only makes sure next week's contest exists in time for
 * people to register for it.
 */

// Local wall-clock, because "9am" means 9am where the students are, not UTC.
export const TZ = process.env.CONTEST_TZ || 'Asia/Kolkata';
const START_HOUR = Number(process.env.WEEKLY_CONTEST_HOUR ?? 9);
const DURATION_HOURS = Number(process.env.WEEKLY_CONTEST_HOURS ?? 3);
// 0 = Sunday.
const DAY = Number(process.env.WEEKLY_CONTEST_DAY ?? 0);

/**
 * How far ahead of UTC `timeZone` is at a given instant, in milliseconds.
 *
 * Formatting the instant in the zone and reading the result back as if it were
 * UTC gives the offset directly, and it is measured per instant rather than
 * assumed, so it stays correct across a DST change.
 */
function zoneOffset(utcMs, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - utcMs;
}

/** The parts of `utcMs` as read in the zone. */
function zoneParts(utcMs, timeZone) {
  const shifted = new Date(utcMs + zoneOffset(utcMs, timeZone));
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate(), day: shifted.getUTCDay() };
}

/**
 * The real instant at which the zone's clock reads `hour` on the given local
 * calendar day.
 *
 * `new Date(y, m, d, 9)` would use the *server's* timezone, so a box running in
 * UTC would schedule the 9am contest for 2:30pm in India.
 */
export function zonedTime({ y, m, d }, hour, timeZone = TZ) {
  const naive = Date.UTC(y, m, d, hour);
  // Applied twice: the offset is looked up at the approximate instant, then
  // re-checked at the corrected one, which matters on a DST-transition day.
  const once = naive - zoneOffset(naive, timeZone);
  return new Date(naive - zoneOffset(once, timeZone));
}

/** ISO-ish week key, used so the scheduler never creates the same week twice. */
export function weekKey(date, timeZone = TZ) {
  const { y, m, d } = zoneParts(date.getTime(), timeZone);
  const jan1 = Date.UTC(y, 0, 1);
  const week = Math.ceil(((Date.UTC(y, m, d) - jan1) / 86400000 + new Date(jan1).getUTCDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

/** The next occurrence of the contest day at or after `from`, at START_HOUR. */
export function nextContestStart(from = new Date(), timeZone = TZ) {
  for (let i = 0; i <= 7; i++) {
    const probe = from.getTime() + i * 86400000;
    const parts = zoneParts(probe, timeZone);
    if (parts.day !== DAY) continue;
    const start = zonedTime(parts, START_HOUR, timeZone);
    if (start > from) return start;
  }
  return null;
}

/**
 * One Easy, one Medium, one Hard, sampled at random.
 *
 * Only problems with hidden test cases are eligible. A problem imported from
 * LeetCode or Codeforces has nothing but the samples printed in its statement,
 * and a three hour contest scored on visible cases is won by whoever types
 * `print("[0,1]")` fastest.
 */
export async function pickWeeklyProblems() {
  const picked = [];
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    const [problem] = await Problem.aggregate([
      { $match: { difficulty, 'testCases.isHidden': true } },
      { $sample: { size: 1 } },
      { $project: { _id: 1 } },
    ]);
    if (problem) picked.push(problem._id);
  }
  return picked;
}

/**
 * Create next week's contest if it does not exist yet. Safe to call repeatedly.
 */
export async function ensureWeeklyContest(now = new Date()) {
  const start = nextContestStart(now);
  if (!start) return null;

  const key = weekKey(start);
  const existing = await Contest.findOne({ weeklyKey: key });
  if (existing) return existing;

  const problems = await pickWeeklyProblems();
  if (problems.length < 3) {
    console.warn(`Weekly contest ${key} skipped: only ${problems.length} eligible problems with hidden test cases. Run scripts/seedOpenProblems.mjs.`);
    return null;
  }

  const end = new Date(start.getTime() + DURATION_HOURS * 3600 * 1000);
  return Contest.create({
    title: `Weekly Contest ${key}`,
    description: `Three problems, ${DURATION_HOURS} hours. Ranked by problems solved, then by total time including a penalty per wrong submission.`,
    problems,
    startTime: start,
    endTime: end,
    weeklyKey: key,
    visibility: 'Public',
    status: 'Upcoming',
  });
}

const startWeeklyContestCron = () => {
  // Hourly rather than once a week: a restart or a deploy during the one weekly
  // tick would silently skip a contest, and the create is idempotent anyway.
  cron.schedule('7 * * * *', () => {
    ensureWeeklyContest().catch((err) => console.error('Weekly contest scheduler error:', err.message));
  }, { timezone: TZ });

  ensureWeeklyContest().catch((err) => console.error('Weekly contest scheduler error:', err.message));
};

export default startWeeklyContestCron;
