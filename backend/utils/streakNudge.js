import cron from 'node-cron';
import User from '../models/user.model.js';
import { istDateKey, istDayStart } from './eventTime.js';
import { pushUser } from './notifyUser.js';

/**
 * Evening nudge for streaks about to break: the user kept it alive yesterday
 * but has not posted or solved today. If someone they follow has a bigger
 * live streak, name them (the closest one above, so the gap feels catchable).
 */

const BATCH = 2000; // ponytail: one batch per run; page by _id if at-risk users pass this.

/**
 * Pure. me: { streakCount }. friends: [{ name, username, streakCount, alive }].
 * Returns { title, body }.
 */
export const pickNudge = (me, friends = []) => {
  const mine = me.streakCount || 0;
  const ahead = friends
    .filter((f) => f.alive && (f.streakCount || 0) > mine)
    .sort((a, b) => a.streakCount - b.streakCount)[0];
  const days = `${mine} day${mine === 1 ? '' : 's'}`;
  if (ahead) {
    const who = ahead.name || ahead.username;
    return {
      title: `${who} is on a ${ahead.streakCount} day streak 🔥`,
      body: `Yours is ${days}. Post or solve one problem today to keep it alive.`,
    };
  }
  return {
    title: `Your ${mine} day streak ends at midnight 🔥`,
    body: 'Post or solve one problem today to keep it alive.',
  };
};

export const runStreakNudge = async (now = new Date()) => {
  const todayStart = istDayStart(istDateKey(now));
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const atRisk = await User.find({
    streakCount: { $gt: 0 },
    lastPostDate: { $gte: yesterdayStart, $lt: todayStart },
    isBanned: { $ne: true },
  }).select('streakCount following fcmTokens expoPushToken').limit(BATCH).lean();
  if (!atRisk.length) return 0;

  // One query for every followed person across the batch.
  const followedIds = [...new Set(atRisk.flatMap((u) => (u.following || []).map(String)))];
  const followed = followedIds.length
    ? await User.find({ _id: { $in: followedIds }, streakCount: { $gt: 0 }, lastPostDate: { $gte: yesterdayStart } })
      .select('name username streakCount lastPostDate').lean()
    : [];
  const byId = new Map(followed.map((f) => [String(f._id), { ...f, alive: true }]));

  let sent = 0;
  for (const u of atRisk) {
    if (!u.fcmTokens?.length && !u.expoPushToken) continue;
    const friends = (u.following || []).map((id) => byId.get(String(id))).filter(Boolean);
    const { title, body } = pickNudge(u, friends);
    if (await pushUser(u, { title, body, data: { type: 'streak_nudge', screen: 'Home' }, tag: 'streak' })) sent++;
  }
  return sent;
};

export const initStreakNudge = () => {
  // 8 PM IST: late enough to matter, early enough to still do something.
  cron.schedule('0 20 * * *', () => {
    runStreakNudge()
      .then((n) => console.log(`🔥 Streak nudge: ${n} sent`))
      .catch((err) => console.error('Streak nudge error:', err.message));
  }, { timezone: 'Asia/Kolkata' });
};
