import User from "../models/user.model.js";
import { calculateFyncScore } from "./fyncScore.service.js";
import { fetchGitHubStats } from "./github.service.js";

/**
 * Nightly cron job:
 * 1. Re-syncs GitHub stats for all users with a connected GitHub account
 * 2. Recalculates Fync Score for every user
 *
 * Call this from your cron manager (node-cron, agenda, etc.)
 * Runs at 2:00 AM IST daily.
 */
export const runNightlyScoreUpdate = async () => {
    console.log("🌙 [Nightly Cron] Starting Fync Score + GitHub sync...");
    const startTime = Date.now();

    // 1. GitHub sync for connected users
    const githubUsers = await User.find({ githubUsername: { $ne: null } })
        .select("+githubAccessToken")
        .lean();

    let githubSynced = 0;
    for (const user of githubUsers) {
        try {
            const stats = await fetchGitHubStats(user.githubUsername, user.githubAccessToken);
            await User.findByIdAndUpdate(user._id, { githubStats: stats });
            githubSynced++;
        } catch (err) {
            console.warn(`⚠️ GitHub sync failed for ${user.githubUsername}:`, err.message);
        }
    }

    // 2. Recalculate scores for all users (in batches to avoid memory spikes)
    const allUsers = await User.find({}).select("_id").lean();
    let scoreUpdated = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
        const batch = allUsers.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
            batch.map((u) =>
                calculateFyncScore(u._id).then(() => scoreUpdated++)
            )
        );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [Nightly Cron] Done in ${elapsed}s — GitHub: ${githubSynced}/${githubUsers.length}, Scores: ${scoreUpdated}/${allUsers.length}`);
};
