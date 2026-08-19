import User from '../models/user.model.js';
import { istDayDiff, istDateKey } from './eventTime.js';

/*
 * Streak days are IST calendar days.
 *
 * This file used to build day boundaries with `new Date(y, m, d)` — the SERVER's
 * local midnight. On a UTC host that puts the boundary at 05:30 IST, so a post
 * made between midnight and 05:30 IST counted toward the previous day. Users
 * posting late at night got no credit for it and could watch a streak they had
 * genuinely kept reset to 1.
 */

/** Did this user already post today, in IST? */
export const postedToday = (lastPostDate) =>
    Boolean(lastPostDate) && istDateKey(new Date(lastPostDate)) === istDateKey();

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
        let isCompletedToday = false;

        if (user.lastPostDate) {
            const diffDays = istDayDiff(user.lastPostDate, now);

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

    const diffDays = istDayDiff(user.lastPostDate, new Date());

    if (diffDays > 1) {
        // Missed yesterday, reset streak to 0
        user.streakCount = 0;
        await user.save();
    }
    return user;
};
