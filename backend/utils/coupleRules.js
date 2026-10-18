/**
 * Pure Couple Space logic: IST calendar-day math, streaks, together counter.
 * Days are "YYYY-MM-DD" IST keys (see utils/eventTime.js); no Date-zone games here.
 */

const DAY_MS = 86400000;
const keyToUtc = (key) => Date.parse(`${key}T00:00:00.000Z`);

export const isDateKey = (s) =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(keyToUtc(s)).toISOString().slice(0, 10) === s;

/** Calendar days from a to b (b - a). */
export const dayDiff = (a, b) => Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);

export const addDays = (key, n) => new Date(keyToUtc(key) + n * DAY_MS).toISOString().slice(0, 10);

/** Streak after both partners answered on `today`. Same day again is a no-op. */
export const nextStreak = (streak, lastDay, today) => {
    if (lastDay === today) return streak;
    if (lastDay && dayDiff(lastDay, today) === 1) return streak + 1;
    return 1;
};

/** Streak as shown on read: a missed day zeroes it without a cron. */
export const liveStreak = (streak, lastDay, today) =>
    lastDay && dayDiff(lastDay, today) <= 1 ? streak : 0;

/** Same day-of-month `months` after since, clamped to month end (Jan 31 -> Feb 28). */
const plusMonths = (since, months) => {
    const [y, m, d] = since.split("-").map(Number);
    const total = m - 1 + months;
    const yy = y + Math.floor(total / 12);
    const mm = total % 12;
    const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(yy, mm, Math.min(d, last))).toISOString().slice(0, 10);
};

/** Next monthiversary and anniversary strictly after today. */
export const nextDates = (since, today) => {
    let months = 1;
    while (plusMonths(since, months) <= today) months++;
    const years = Math.ceil(months / 12);
    const mDate = plusMonths(since, months);
    const yDate = plusMonths(since, years * 12);
    return {
        monthiversary: { date: mDate, months, inDays: dayDiff(today, mDate) },
        anniversary: { date: yDate, years, inDays: dayDiff(today, yDate) },
    };
};

export const MILESTONES = [
    [7, "1 week"], [30, "30 days"], [50, "50 days"], [100, "100 days"], [200, "200 days"],
    [365, "1 year"], [500, "500 days"], [730, "2 years"], [1000, "1000 days"], [1095, "3 years"],
    [1461, "4 years"], [1826, "5 years"], [2000, "2000 days"], [3000, "3000 days"], [3653, "10 years"],
];

export const togetherStats = (since, today) => {
    const days = Math.max(0, dayDiff(since, today));
    const reached = MILESTONES.filter(([d]) => d <= days).map(([d, label]) => ({ days: d, label }));
    const nx = MILESTONES.find(([d]) => d > days);
    return {
        days,
        milestones: reached,
        nextMilestone: nx ? { days: nx[0], label: nx[1], inDays: nx[0] - days } : null,
        ...nextDates(since, today),
    };
};

/** Deterministic question index for an IST day. */
export const questionIndex = (dateKey, count) => {
    const n = Math.floor(keyToUtc(dateKey) / DAY_MS);
    return ((n % count) + count) % count;
};
