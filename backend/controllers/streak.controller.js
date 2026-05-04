import User from '../models/user.model.js';

/**
 * GET /user/streak/leaderboard
 * Returns top 10 users by streak and current user's rank.
 */
export const getStreakLeaderboard = async (req, res) => {
    try {
        const leaderboard = await User.find({ streakCount: { $gt: 0 } })
            .sort({ streakCount: -1, updatedAt: 1 })
            .limit(10)
            .select('name username avatar streakCount college');

        const currentUser = await User.findById(req.user.id).select('streakCount');
        
        let rank = -1;
        if (currentUser && currentUser.streakCount > 0) {
            rank = await User.countDocuments({ 
                $or: [
                    { streakCount: { $gt: currentUser.streakCount } },
                    { streakCount: currentUser.streakCount, updatedAt: { $lt: currentUser.updatedAt } }
                ]
            }) + 1;
        } else if (currentUser) {
            rank = await User.countDocuments({ streakCount: { $gt: 0 } }) + 1;
        }

        return res.status(200).json({
            success: true,
            leaderboard,
            userRank: rank,
            userStreak: currentUser?.streakCount || 0
        });
    } catch (error) {
        console.error("Leaderboard error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
