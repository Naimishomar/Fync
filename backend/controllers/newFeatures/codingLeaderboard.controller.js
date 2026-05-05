import User from "../../models/user.model.js";
import { fetchLeetCodeStats, fetchFullLeetCodeProfile } from "./coding.controller.js";

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

        // Search Logic
        if (search) {
            query.$and.push({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { username: { $regex: search, $options: "i" } }
                ]
            });
        }

        let sortOption = type === 'weekly' 
            ? { "weeklyStats.questionsThisWeek": -1 } 
            : { "codingStats.totalSolved": -1 };

        const leaderboard = await User.find(query)
            .select("name username avatar codingStats weeklyStats codingProfiles college")
            .sort(sortOption)
            .limit(100);

        // --- BACKGROUND AUTO-SYNC LOGIC ---
        // Identify users who haven't been updated in the last 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const staleUsers = leaderboard.filter(u => 
            !u.codingStats?.lastUpdated || new Date(u.codingStats.lastUpdated) < tenMinutesAgo
        );

        if (staleUsers.length > 0) {
            console.log(`[Leaderboard] Auto-syncing ${staleUsers.length} stale profiles in background...`);
            // Run refresh in background without awaiting
            (async () => {
                for (const u of staleUsers) {
                    await refreshUserStats(u._id);
                    await new Promise(r => setTimeout(r, 200)); 
                }
            })();
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