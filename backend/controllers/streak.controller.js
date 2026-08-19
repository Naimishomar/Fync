import User from '../models/user.model.js';
import { postedToday } from '../utils/streak.js';

/**
 * GET /user/streak/leaderboard
 * Returns top 10 users by streak and current user's rank.
 */
export const getStreakLeaderboard = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id)
            .select('streakCount lastPostDate updatedAt')
            .lean();
        if (!currentUser) return res.status(404).json({ success: false, message: "User not found" });

        // The three queries below have no dependency on each other; they used to
        // run one after another, so the screen paid three serial round trips.
        const rankQuery = currentUser.streakCount > 0
            ? {
                $or: [
                    { streakCount: { $gt: currentUser.streakCount } },
                    { streakCount: currentUser.streakCount, updatedAt: { $lt: currentUser.updatedAt } }
                ]
            }
            : { streakCount: { $gt: 0 } };

        const [leaderboard, ahead] = await Promise.all([
            User.find({ streakCount: { $gt: 0 } })
                .sort({ streakCount: -1, updatedAt: 1 })
                .limit(10)
                .select('name username avatar streakCount college')
                .lean(),
            User.countDocuments(rankQuery)
        ]);

        return res.status(200).json({
            success: true,
            leaderboard,
            userRank: ahead + 1,
            userStreak: currentUser.streakCount || 0,
            // IST, like the rest of the streak logic. Comparing server-local
            // calendar fields marked a late-night post as "yesterday" and told
            // the user their streak was not complete when it was.
            completedToday: postedToday(currentUser.lastPostDate)
        });
    } catch (error) {
        console.error("Leaderboard error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
