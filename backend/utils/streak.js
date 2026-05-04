import User from '../models/user.model.js';

/**
 * Updates the user's daily post streak.
 * Logic:
 * - If last post was yesterday: streak++
 * - If last post was today: do nothing to streak count
 * - If last post was before yesterday: streak = 1
 * - Update lastPostDate to now
 */
export const updateStreak = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return { streakCount: 0, isCompletedToday: false };

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let isCompletedToday = false;
        
        if (user.lastPostDate) {
            const lastPost = new Date(user.lastPostDate);
            const lastPostStart = new Date(lastPost.getFullYear(), lastPost.getMonth(), lastPost.getDate());
            
            const diffTime = todayStart.getTime() - lastPostStart.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Posted yesterday, increment streak
                user.streakCount += 1;
                isCompletedToday = true;
            } else if (diffDays > 1) {
                // Missed at least one day, reset and start fresh
                user.streakCount = 1;
                isCompletedToday = true;
            } else if (diffDays === 0) {
                // Already posted today
                isCompletedToday = false;
            }
        } else {
            // First post ever
            user.streakCount = 1;
            isCompletedToday = true;
        }

        user.lastPostDate = now;
        if (user.streakCount > user.highestStreak) {
            user.highestStreak = user.streakCount;
        }
        
        await user.save();
        return { streakCount: user.streakCount, isCompletedToday };
    } catch (error) {
        console.error("Error updating streak:", error);
        return { streakCount: 0, isCompletedToday: false };
    }
};

/**
 * Resets streak to 0 if the user missed yesterday's post.
 * Should be called whenever user profile is fetched to keep data "fresh" without cron jobs.
 */
export const checkAndResetStreak = async (user) => {
    if (!user || !user.lastPostDate) return user;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastPost = new Date(user.lastPostDate);
    const lastPostStart = new Date(lastPost.getFullYear(), lastPost.getMonth(), lastPost.getDate());

    const diffTime = todayStart.getTime() - lastPostStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
        // Missed yesterday, reset streak to 0
        user.streakCount = 0;
        await user.save();
    }
    return user;
};
