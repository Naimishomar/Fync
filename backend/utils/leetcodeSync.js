import User from "../models/user.model.js";
import redisClient from "./redis.js";
import { fetchLeetCodeStats } from "../controllers/newFeatures/coding.controller.js";

// How long a username's stats are considered fresh. Every path into a LeetCode
// fetch — the cron, the pull-to-refresh button, the admin sweep — goes through
// the same claim, so a username can be hit at most once per window no matter how
// many users press refresh at the same second.
export const COOLDOWN_SECONDS = Number(process.env.LEETCODE_COOLDOWN_SECONDS || 900);
// A failed fetch must not hold the full window, or one flaky response freezes a
// user's stats for 15 minutes.
const FAILURE_COOLDOWN_SECONDS = 300;

const BATCH = Number(process.env.LEETCODE_SYNC_BATCH || 120);
const CONCURRENCY = Number(process.env.LEETCODE_SYNC_CONCURRENCY || 2);
const LOCK_KEY = 'leetcode_sync:lock';

const cooldownKey = (username) => `leetcode_sync:cooldown:${String(username).toLowerCase()}`;

// Bounded worker pool. Nothing here needs p-limit: `index` is shared, each
// worker takes the next item, so at most `size` fetches are ever in flight.
export const runPool = async (items, size, fn) => {
    let index = 0;
    const worker = async () => {
        while (index < items.length) {
            const item = items[index++];
            try { await fn(item); } catch (err) { console.error("LeetCode sync task error:", err.message); }
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, worker));
};

export const isFresh = (lastUpdated, now = new Date(), seconds = COOLDOWN_SECONDS) =>
    !!lastUpdated && now.getTime() - new Date(lastUpdated).getTime() < seconds * 1000;

// `SET NX EX` is the whole rate limiter: it is atomic, so it deduplicates
// concurrent callers and enforces the cooldown with one key. If Redis is
// unreachable we fall back to the timestamp already stored on the user, which is
// weaker under concurrency but still stops a stampede from a fresh document.
export const claimSync = async (username, lastUpdated, now = new Date()) => {
    try {
        const claimed = await redisClient.set(cooldownKey(username), '1', { NX: true, EX: COOLDOWN_SECONDS });
        return claimed === 'OK';
    } catch (err) {
        console.error("LeetCode cooldown check failed, falling back to lastUpdated:", err.message);
        return !isFresh(lastUpdated, now);
    }
};

const releaseEarly = async (username) => {
    try {
        await redisClient.set(cooldownKey(username), '1', { EX: FAILURE_COOLDOWN_SECONDS });
    } catch { /* the cooldown simply stays at its full length */ }
};

/**
 * Refresh one user's LeetCode numbers, at most once per cooldown window.
 * @returns {'synced' | 'skipped' | 'failed' | 'unlinked'}
 */
export const syncUser = async (user) => {
    const username = user?.codingProfiles?.leetcode;
    if (!username) return 'unlinked';

    if (!(await claimSync(username, user.codingStats?.lastUpdated))) return 'skipped';

    const stats = await fetchLeetCodeStats(username);
    if (!stats) {
        await releaseEarly(username);
        return 'failed';
    }

    // Only the LeetCode fields are written. The previous version replaced the
    // whole `codingStats` object, which reset gfg/codechef/codeforces to 0 on
    // every sync. `totalSolved` is recomputed from the other counters instead of
    // being aliased to the LeetCode number.
    await User.updateOne({ _id: user._id }, [{
        $set: {
            "codingStats.leetcodeSolved": stats.totalSolved,
            "codingStats.lastUpdated": new Date(),
            "codingStats.totalSolved": {
                $add: [
                    stats.totalSolved,
                    { $ifNull: ["$codingStats.gfgSolved", 0] },
                    { $ifNull: ["$codingStats.codechefSolved", 0] },
                    { $ifNull: ["$codingStats.codeforcesSolved", 0] },
                    { $ifNull: ["$codingStats.hackerrankSolved", 0] },
                ]
            },
            "weeklyStats.questionsThisWeek": stats.sevenDayCount || 0,
        }
    }]);

    return 'synced';
};

const SYNC_FIELDS = "codingProfiles.leetcode codingStats.lastUpdated";

/**
 * One cron tick: refresh the most-stale linked users, oldest first, with a fixed
 * per-tick budget. The budget is what keeps the outbound rate predictable — the
 * old code walked every user in one pass, so the run time grew with signups
 * until it overran its own schedule and ticks began to overlap.
 */
export const syncStaleUsers = async () => {
    const users = await User.find({ "codingProfiles.leetcode": { $nin: [null, ""] } })
        .select(SYNC_FIELDS)
        .sort({ "codingStats.lastUpdated": 1 })   // never-synced (null) sorts first
        .limit(BATCH)
        .lean();

    const counts = { synced: 0, skipped: 0, failed: 0, unlinked: 0 };
    await runPool(users, CONCURRENCY, async (user) => {
        counts[await syncUser(user)]++;
    });

    if (counts.synced) {
        try {
            const keys = await redisClient.keys('coding_leaderboard:*');
            if (keys.length) await redisClient.del(keys);
        } catch (err) {
            console.error("Error clearing leaderboard cache:", err.message);
        }
    }
    return counts;
};

// Ticks must not overlap: a slow tick that is still fetching when the next one
// starts would double the outbound request rate, which is exactly the burst the
// cooldown exists to prevent. PM2 runs this on one worker, but a long tick can
// still collide with itself.
export const runSyncTick = async () => {
    let held = false;
    try {
        held = (await redisClient.set(LOCK_KEY, '1', { NX: true, EX: 600 })) === 'OK';
    } catch {
        held = true; // no Redis, no cross-tick coordination available
    }
    if (!held) return console.log("⏭️  LeetCode sync: previous tick still running");

    try {
        const counts = await syncStaleUsers();
        console.log(`🔄 LeetCode sync: ${counts.synced} synced, ${counts.skipped} fresh, ${counts.failed} failed`);
    } finally {
        try { await redisClient.del(LOCK_KEY); } catch { /* lock expires on its own */ }
    }
};
