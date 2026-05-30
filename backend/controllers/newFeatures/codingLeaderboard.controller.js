import User from "../../models/user.model.js";
import { fetchLeetCodeStats, fetchFullLeetCodeProfile } from "./coding.controller.js";
import redisClient from "../../utils/redis.js";

// 1. UPDATE PROFILE
export const updateCodingProfiles = async (req, res) => {
    try {
        const { leetcode } = req.body;
        
        if (!leetcode || leetcode.trim() === "") {
             return res.status(400).json({ message: "Invalid LeetCode Username" });
        }

        const username = leetcode.trim();

        // 🔥 VALIDATION: Check if username actually exists on LeetCode
        const stats = await fetchLeetCodeStats(username);
        if (!stats) {
            return res.status(404).json({ 
                success: false, 
                message: "LeetCode profile not found. Please check the username and try again." 
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { 
                $set: { "codingProfiles.leetcode": username },
                codingStats: {
                    totalSolved: stats.totalSolved,
                    leetcodeSolved: stats.totalSolved,
                    gfgSolved: 0,
                    lastUpdated: new Date()
                },
                "weeklyStats.questionsThisWeek": stats.sevenDayCount || 0
            },
            { new: true }
        );

        return res.status(200).json({ success: true, message: "LeetCode connected!", user });
    } catch (error) {
        console.error("Update Profile Error:", error);
        return res.status(500).json({ message: "Error updating profile" });
    }
};

// 2. REFRESH STATS HELPER
export const refreshUserStats = async (userId) => {
    const user = await User.findById(userId);
    if (!user || !user.codingProfiles.leetcode) return;

    try {
        const stats = await fetchLeetCodeStats(user.codingProfiles.leetcode);
        
        if (stats) {
            const total = stats.totalSolved;
            
            user.codingStats = {
                totalSolved: total,
                leetcodeSolved: total,
                gfgSolved: 0,
                lastUpdated: new Date()
            };
            
            // Now using rolling 7-day count from fetchLeetCodeStats
            user.weeklyStats.questionsThisWeek = stats.sevenDayCount || 0;
            await user.save();
        }
    } catch (err) {
        console.error("Refresh Error:", err);
    }
};

// 3. GET LEADERBOARD (Strict Filter)
export const getLeaderboard = async (req, res) => {
    try {
        const { type, scope, search } = req.query; 

        const cacheKey = `coding_leaderboard:${type || 'all'}:${scope || 'all'}:${req.user?.college || 'none'}:${search || 'none'}`;
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ success: true, leaderboard: JSON.parse(cachedData) });
            }
        } catch (err) {
            console.error("Redis Cache Get Error:", err);
        }
        
        // 🔥 STRICT FILTER: 
        // 1. Field must exist
        // 2. Must not be null
        // 3. Must not be an empty string
        const baseQuery = { 
            "codingProfiles.leetcode": { $exists: true, $ne: "" } 
        };

        const query = { $and: [baseQuery] };

        // College Scope Logic
        if (scope === 'college' && req.user.college) {
            query.$and.push({ college: req.user.college });
        }

        // Search Logic - Using high-speed Text Index
        if (search) {
            query.$and.push({ $text: { $search: search } });
        }

        let sortOption = type === 'weekly' 
            ? { "weeklyStats.questionsThisWeek": -1 } 
            : { "codingStats.totalSolved": -1 };

        const leaderboard = await User.find(query)
            .select("name username avatar codingStats weeklyStats codingProfiles college")
            .sort(sortOption)
            .limit(100)
            .lean();

        try {
            await redisClient.setEx(cacheKey, 900, JSON.stringify(leaderboard)); // Cache for 15 minutes
        } catch (err) {
            console.error("Redis Cache Set Error:", err);
        }

        return res.status(200).json({ success: true, leaderboard });
    } catch (error) {
        console.error("Leaderboard Fetch Error:", error);
        return res.status(500).json({ message: "Error fetching leaderboard" });
    }
};

// 4. GET FULL DETAILS (Profile Modal)
export const getCoderProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select("codingProfiles");

        if (!user || !user.codingProfiles.leetcode) {
            return res.status(404).json({ message: "LeetCode ID not found" });
        }

        // Fetch aggregation from external API
        const fullProfile = await fetchFullLeetCodeProfile(user.codingProfiles.leetcode);

        return res.status(200).json({ success: true, data: fullProfile });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching external profile" });
    }
};

// 5. FORCE REFRESH SINGLE
export const forceRefreshStats = async (req, res) => {
    try {
        await refreshUserStats(req.user.id);
        const updatedUser = await User.findById(req.user.id);
        return res.status(200).json({ success: true, user: updatedUser });
    } catch (error) {
        return res.status(500).json({ message: "Refresh failed" });
    }
};

// 6. REFRESH ALL USERS
export const refreshAllStats = async (req, res) => {
    try {
        const users = await User.find({ "codingProfiles.leetcode": { $exists: true, $ne: "" } });
        
        // Return immediately to not block UI
        res.status(200).json({ success: true, message: `Syncing ${users.length} users in background` });

        // Process in background with slight delays to prevent rate limiting
        for (const user of users) {
            await refreshUserStats(user._id);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error("Global Refresh Error:", error);
    }
};