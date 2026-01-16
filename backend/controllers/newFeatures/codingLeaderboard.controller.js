import User from "../../models/user.model.js";
import { fetchLeetCodeStats, fetchFullLeetCodeProfile } from "./coding.controller.js";

// 1. UPDATE PROFILE
export const updateCodingProfiles = async (req, res) => {
    try {
        const { leetcode } = req.body;
        
        // Prevent saving empty strings or nulls effectively
        if (!leetcode || leetcode.trim() === "") {
             return res.status(400).json({ message: "Invalid LeetCode Username" });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { "codingProfiles.leetcode": leetcode.trim() } }, // Trim whitespace
            { new: true }
        );

        // Refresh stats immediately so they show up in leaderboard
        refreshUserStats(user._id);

        return res.status(200).json({ success: true, message: "LeetCode connected!", user });
    } catch (error) {
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
            
            // Fix Weekly Stats Bug for first-time users
            let startScore = user.weeklyStats.startOfWeekScore || 0;
            if (startScore === 0 && total > 0) {
                startScore = total;
                user.weeklyStats.startOfWeekScore = total;
            }

            user.codingStats = {
                totalSolved: total,
                leetcodeSolved: total,
                gfgSolved: 0,
                lastUpdated: new Date()
            };
            
            user.weeklyStats.questionsThisWeek = Math.max(0, total - startScore);
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

// 5. FORCE REFRESH
export const forceRefreshStats = async (req, res) => {
    try {
        await refreshUserStats(req.user.id);
        const updatedUser = await User.findById(req.user.id);
        return res.status(200).json({ success: true, user: updatedUser });
    } catch (error) {
        return res.status(500).json({ message: "Refresh failed" });
    }
};