import User from '../models/user.model.js';
import { postedToday } from '../utils/streak.js';
import { istDateKey, istDayStart } from '../utils/eventTime.js';

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

        // A streak is only alive if the last post was today or yesterday (IST);
        // streakCount is not reset until the next post, so a lapsed streak
        // used to sit on the board forever.
        const alive = { lastPostDate: { $gte: istDayStart(istDateKey(new Date(Date.now() - 86400000))) } };
        const myStreak = currentUser.lastPostDate && new Date(currentUser.lastPostDate) >= alive.lastPostDate.$gte
            ? (currentUser.streakCount || 0) : 0;

        // The three queries below have no dependency on each other; they used to
        // run one after another, so the screen paid three serial round trips.
        const rankQuery = myStreak > 0
            ? {
                ...alive,
                $or: [
                    { streakCount: { $gt: myStreak } },
                    { streakCount: myStreak, updatedAt: { $lt: currentUser.updatedAt } }
                ]
            }
            : { ...alive, streakCount: { $gt: 0 } };

        const [leaderboard, ahead] = await Promise.all([
            User.find({ ...alive, streakCount: { $gt: 0 } })
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
            userStreak: myStreak,
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
