import BugProblem from '../models/coding/bugProblem.model.js';
import CodingSubmission from '../models/coding/codingSubmission.model.js';

/**
 * The Easy -> Medium -> Hard ladder for bug missions.
 *
 * A student who opens a Hard bug first sees a hundred lines of unfamiliar code
 * and quits; the ladder exists so the first thing they meet is a one-line bug
 * they can actually find. Progress is tracked per domain, because being good at
 * Python bugs says nothing about reading Java.
 */

export const LEVELS = ['Easy', 'Medium', 'Hard'];

// Solves needed at a level before the next one opens.
export const REQUIRED = Number(process.env.BUG_LADDER_REQUIRED ?? 5);

/**
 * Distinct bug problems this user has actually fixed, grouped by domain and
 * difficulty.
 *
 * Counted from accepted submissions rather than a counter on the user, so it
 * stays right when a problem is deleted or a submission is re-judged. Distinct
 * matters: submitting the same fix five times is one solve, not five.
 */
export async function solvedCounts(userId) {
  const accepted = await CodingSubmission.find({ user: userId, status: 'Accepted' })
    .distinct('problem');
  if (!accepted.length) return {};

  const rows = await BugProblem.aggregate([
    { $match: { _id: { $in: accepted } } },
    { $group: { _id: { domain: '$domain', difficulty: '$difficulty' }, count: { $sum: 1 } } },
  ]);

  const counts = {};
  for (const r of rows) {
    counts[r._id.domain] ??= {};
    counts[r._id.domain][r._id.difficulty] = r.count;
  }
  return counts;
}

/**
 * The highest level unlocked in a domain, and how far off the next one is.
 * Easy is always open — there has to be a way in.
 */
export function ladderFor(domainCounts = {}) {
  const levels = LEVELS.map((level, i) => {
    if (i === 0) return { level, unlocked: true, solved: domainCounts[level] ?? 0, required: 0 };
    const previous = LEVELS[i - 1];
    const solved = domainCounts[previous] ?? 0;
    return {
      level,
      unlocked: solved >= REQUIRED,
      solved: domainCounts[level] ?? 0,
      // What the student still has to do at the previous level to get in.
      needs: Math.max(0, REQUIRED - solved),
      required: REQUIRED,
      unlockedBy: previous,
    };
  });
  return levels;
}

/**
 * Whether a user may open a specific bug problem. The listing greys locked
 * levels out, but the check has to exist on the server too — otherwise the
 * lock is a CSS class and anyone can request the id directly.
 */
export async function canAttempt(userId, bugProblem) {
  const index = LEVELS.indexOf(bugProblem.difficulty);
  if (index <= 0) return { allowed: true };

  const counts = (await solvedCounts(userId))[bugProblem.domain] ?? {};
  const previous = LEVELS[index - 1];
  const solved = counts[previous] ?? 0;
  if (solved >= REQUIRED) return { allowed: true };

  return {
    allowed: false,
    message: `Solve ${REQUIRED - solved} more ${previous} ${bugProblem.domain} bug${REQUIRED - solved === 1 ? '' : 's'} to unlock ${bugProblem.difficulty}.`,
  };
}

/**
 * Per-domain summary for the picker: how many bugs exist at each level, how
 * many this user has fixed, and which levels are open.
 */
export async function domainOverview(userId) {
  const totals = await BugProblem.aggregate([
    { $group: { _id: { domain: '$domain', difficulty: '$difficulty' }, count: { $sum: 1 } } },
  ]);
  const counts = await solvedCounts(userId);

  const byDomain = {};
  for (const t of totals) {
    byDomain[t._id.domain] ??= { total: 0, byLevel: {} };
    byDomain[t._id.domain].byLevel[t._id.difficulty] = t.count;
    byDomain[t._id.domain].total += t.count;
  }

  return Object.entries(byDomain).map(([domain, info]) => ({
    domain,
    total: info.total,
    available: info.byLevel,
    solved: counts[domain] ?? {},
    ladder: ladderFor(counts[domain]),
  })).sort((a, b) => b.total - a.total);
}

export default { solvedCounts, ladderFor, canAttempt, domainOverview, LEVELS, REQUIRED };
