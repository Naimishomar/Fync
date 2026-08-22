/**
 * GeeksforGeeks practice stats.
 *
 * GFG publishes no API. The profile page is a Next.js app whose server payload
 * is streamed into the HTML as escaped JSON inside self.__next_f chunks, and the
 * practice counters live in there. Reading them out is scraping, so treat it as
 * best-effort: a null return means "could not read", never "zero solved", and a
 * failed read must never overwrite a good number with 0.
 *
 * If GFG changes its page shape this stops returning numbers and the counters
 * simply stop moving — nothing else breaks.
 */
import User from "../models/user.model.js";

const UA = 'Mozilla/5.0 (compatible; FyncBot/1.0; +https://fync-api.duckdns.org)';

/** The blob is escaped inside the HTML, so the key may appear as "k" or \"k\". */
const readNumber = (html, key) => {
  const m = html.match(new RegExp(`\\\\?"${key}\\\\?"\\s*:\\s*(-?\\d+)`));
  return m ? Number(m[1]) : null;
};

export const fetchGfgStats = async (username) => {
  const url = `https://www.geeksforgeeks.org/user/${encodeURIComponent(username)}/`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const solved = readNumber(html, 'total_problems_solved');
    // A profile that does not exist still returns 200 with a generic shell, and
    // the counter is simply absent — which is why this checks for null rather
    // than falsy. Zero is a legitimate value for a real, unused account.
    if (solved === null) return null;

    return {
      solved,
      score: readNumber(html, 'score') ?? 0,
      streak: readNumber(html, 'pod_solved_current_streak') ?? 0,
    };
  } catch {
    return null;
  }
};

/**
 * Writes only the GFG fields and recomputes the total, mirroring the LeetCode
 * sync. Replacing the whole codingStats object would zero the other platforms.
 */
export const syncGfgUser = async (user) => {
  const username = user?.codingProfiles?.gfg;
  if (!username) return 'unlinked';

  const stats = await fetchGfgStats(username);
  if (!stats) return 'failed';

  await User.updateOne({ _id: user._id }, [{
    $set: {
      "codingStats.gfgSolved": stats.solved,
      // the schema field is gfgRating; gfgScore would be dropped silently by
      // strict mode and the number would never appear
      "codingStats.gfgRating": stats.score,
      "codingStats.lastUpdated": new Date(),
      "codingStats.totalSolved": {
        $add: [
          stats.solved,
          { $ifNull: ["$codingStats.leetcodeSolved", 0] },
          { $ifNull: ["$codingStats.codechefSolved", 0] },
          { $ifNull: ["$codingStats.codeforcesSolved", 0] },
          { $ifNull: ["$codingStats.hackerrankSolved", 0] },
        ]
      },
    }
  }]);

  return 'synced';
};
