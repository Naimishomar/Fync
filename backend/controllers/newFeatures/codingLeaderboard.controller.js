import User from "../../models/user.model.js";
import { fetchLeetCodeStats, fetchFullLeetCodeProfile } from "./coding.controller.js";
import redisClient from "../../utils/redis.js";
import { syncUser, runSyncTick, COOLDOWN_SECONDS } from "../../utils/leetcodeSync.js";

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

        // Only the LeetCode fields are written. Replacing the whole `codingStats`
        // object here reset gfg/codechef/codeforces to 0 every time a user
        // re-linked their profile.
        const user = await User.findByIdAndUpdate(
            req.user.id,
            [{
                $set: {
                    "codingProfiles.leetcode": username,
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
            }],
            { new: true }
        );

        return res.status(200).json({ success: true, message: "LeetCode connected!", user });
    } catch (error) {
        console.error("Update Profile Error:", error);
        return res.status(500).json({ message: "Error updating profile" });
    }
};

// 2. REFRESH STATS HELPER
// Thin wrapper so callers that only hold an id still go through the same
// per-username cooldown as the cron.
export const refreshUserStats = async (userId) => {
    const user = await User.findById(userId).select("codingProfiles.leetcode codingStats.lastUpdated").lean();
    if (!user) return 'unlinked';
    return syncUser(user);
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

        const username = user.codingProfiles.leetcode;
        const cacheKey = `leetcode_full_profile:${username}`;
        
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
            }
        } catch (err) {
            console.error("Redis Cache Get Error:", err);
        }

        // Fetch aggregation from external API
        const fullProfile = await fetchFullLeetCodeProfile(username);

        try {
            await redisClient.setEx(cacheKey, 3600, JSON.stringify(fullProfile)); // Cache for 1 hour
        } catch (err) {
            console.error("Redis Cache Set Error:", err);
        }

        return res.status(200).json({ success: true, data: fullProfile });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching external profile" });
    }
};

// 5. FORCE REFRESH SINGLE
// Not actually a force: the client shows every user the same countdown, so a
// college's worth of taps used to land on LeetCode within the same second. The
// cooldown is shared with the cron, and a user inside the window is told when
// their next sync is due rather than being sent upstream.
export const forceRefreshStats = async (req, res) => {
    try {
        const result = await refreshUserStats(req.user.id);
        const updatedUser = await User.findById(req.user.id);

        if (result === 'unlinked') {
            return res.status(400).json({ success: false, message: "No LeetCode username linked." });
        }
        if (result === 'failed') {
            return res.status(502).json({ success: false, message: "LeetCode did not respond. Try again shortly." });
        }

        const lastUpdated = updatedUser?.codingStats?.lastUpdated;
        const nextRefreshAt = lastUpdated
            ? new Date(new Date(lastUpdated).getTime() + COOLDOWN_SECONDS * 1000)
            : new Date();

        return res.status(200).json({
            success: true,
            synced: result === 'synced',
            message: result === 'synced' ? "Stats updated." : "Already up to date.",
            nextRefreshAt,
            user: updatedUser,
        });
    } catch (error) {
        console.error("Force refresh error:", error);
        return res.status(500).json({ message: "Refresh failed" });
    }
};

// 6. REFRESH ALL USERS (admin)
// Kicks the same tick the cron runs, so it obeys the same batch size, the same
// concurrency and the same lock. Two admin taps can no longer start two sweeps.
export const refreshAllStats = async (req, res) => {
    res.status(200).json({ success: true, message: "Sync tick queued." });
    runSyncTick().catch((err) => console.error("Global Refresh Error:", err.message));
};
