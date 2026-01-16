import cron from "node-cron";
import User from "../models/user.model.js";
import { refreshUserStats } from "../controllers/newFeatures/codingLeaderboard.controller.js";

const startCronJobs = () => {
    cron.schedule('0 */6 * * *', async () => {
        console.log("🔄 Updating Coding Stats...");
        const users = await User.find({ 
            $or: [{ "codingProfiles.leetcode": { $ne: null } }, { "codingProfiles.gfg": { $ne: null } }] 
        });
        
        for (const user of users) {
            await refreshUserStats(user._id);
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log("✅ Stats Updated");
    });
    cron.schedule('0 0 * * 0', async () => {
        console.log("📅 Resetting Weekly Leaderboard...");
        const users = await User.find({});
        for (const user of users) {
            user.weeklyStats.startOfWeekScore = user.codingStats.totalSolved;
            user.weeklyStats.questionsThisWeek = 0;
            await user.save();
        }
    });
};

export default startCronJobs;