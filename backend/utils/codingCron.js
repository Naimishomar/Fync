import cron from "node-cron";
import User from "../models/user.model.js";
import { refreshUserStats } from "../controllers/newFeatures/codingLeaderboard.controller.js";
import redisClient from "./redis.js";

const startCronJobs = () => {
    cron.schedule('*/15 * * * *', async () => {
        console.log("🔄 Updating Coding Stats...");
        const users = await User.find({ 
            $or: [{ "codingProfiles.leetcode": { $ne: null } }, { "codingProfiles.gfg": { $ne: null } }] 
        });
        
        for (const user of users) {
            await refreshUserStats(user._id);
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log("✅ Stats Updated");
        
        try {
            const keys = await redisClient.keys('coding_leaderboard:*');
            if (keys.length > 0) {
                await redisClient.del(keys);
                console.log("🧹 Cleared coding leaderboard cache.");
            }
        } catch (err) {
            console.error("Error clearing leaderboard cache:", err);
        }
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