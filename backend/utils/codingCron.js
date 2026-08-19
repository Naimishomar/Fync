import cron from "node-cron";
import User from "../models/user.model.js";
import { runSyncTick } from "./leetcodeSync.js";

const startCronJobs = () => {
    // Every 5 minutes, not 15: each tick refreshes a fixed slice of the
    // most-stale users, so the queue drains steadily instead of trying to walk
    // every user inside one window. The per-username cooldown in leetcodeSync
    // still caps any single profile at one fetch per 15 minutes.
    cron.schedule('*/5 * * * *', () => {
        runSyncTick().catch((err) => console.error("LeetCode sync tick error:", err.message));
    });

    // Weekly leaderboard reset. Was a find-all loop with one save() per user —
    // a full serial write per account every Sunday. One pipeline update does it
    // server-side.
    cron.schedule('0 0 * * 0', async () => {
        try {
            const res = await User.updateMany({}, [{
                $set: {
                    "weeklyStats.startOfWeekScore": { $ifNull: ["$codingStats.totalSolved", 0] },
                    "weeklyStats.questionsThisWeek": 0,
                }
            }]);
            console.log(`📅 Weekly leaderboard reset: ${res.modifiedCount} users`);
        } catch (err) {
            console.error("Weekly reset error:", err.message);
        }
    });
};

export default startCronJobs;
