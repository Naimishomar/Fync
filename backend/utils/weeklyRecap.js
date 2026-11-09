import './cardFonts.js';
import cron from 'node-cron';
import sharp from 'sharp';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import { istDateKey, istDayStart } from './eventTime.js';
import { getCodingCalendar, computeStreaks } from './codingCalendar.js';
import { checkAndResetStreak } from './streak.js';
import { esc, truncate, formatCount } from './shareCard.js';
import { pushUser } from './notifyUser.js';

/**
 * "Your week on Fync": a 1080x1920 story card of the last 7 IST days —
 * problems solved (all linked platforms), posts, likes on them, best post,
 * streak — plus a Sunday evening push telling people it's ready.
 */

const DAY = 86400000;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Pure: the last 7 IST date keys ending today, oldest first. */
export const lastSevenKeys = (todayKey = istDateKey()) => {
  const end = istDayStart(todayKey).getTime();
  return Array.from({ length: 7 }, (_, i) => istDateKey(new Date(end - (6 - i) * DAY)));
};

/** Everything the card shows, or null for an unknown user. */
export const buildRecap = async (userId, now = new Date()) => {
  if (!mongoose.isValidObjectId(userId)) return null;
  const user = await User.findById(userId)
    .select('name username codingProfiles streakCount highestStreak lastPostDate').lean();
  if (!user) return null;

  const keys = lastSevenKeys(istDateKey(now));
  const since = istDayStart(keys[0]);
  const [coding, posts] = await Promise.all([
    getCodingCalendar(user.codingProfiles).catch(() => null),
    Post.find({ user: user._id, createdAt: { $gte: since }, isPrivate: { $ne: true } })
      .select('description likes').lean(),
  ]);

  const solvedByDay = keys.map((k) => coding?.[k] || 0);
  const top = posts.reduce((best, p) => ((p.likes || 0) > (best?.likes || 0) ? p : best), null);
  const codingStreak = coding ? computeStreaks(coding, keys[6]) : null;
  const postStreak = checkAndResetStreak(user.lastPostDate, user.streakCount, now);

  return {
    name: user.name || user.username,
    username: user.username,
    keys,
    solvedByDay,
    solved: solvedByDay.reduce((a, n) => a + n, 0),
    linked: Boolean(coding),
    posts: posts.length,
    likes: posts.reduce((a, p) => a + (p.likes || 0), 0),
    topPost: top && top.likes > 0 ? { text: top.description, likes: top.likes } : null,
    streak: Math.max(postStreak, codingStreak?.current || 0),
  };
};

const FONT = 'font-family="sans-serif"';

/** Recap -> PNG buffer, 1080x1920. */
export const renderRecapCard = async (r, link) => {
  const max = Math.max(1, ...r.solvedByDay);
  const bars = r.solvedByDay.map((n, i) => {
    const h = n ? 40 + Math.round((n / max) * 260) : 12;
    const x = 150 + i * 120;
    const day = WEEKDAYS[new Date(`${r.keys[i]}T00:00:00Z`).getUTCDay()];
    return `<rect x="${x}" y="${1060 - h}" width="80" height="${h}" rx="16" fill="${n ? '#F97316' : '#E7E2D9'}"/>
<text x="${x + 40}" y="1110" ${FONT} font-size="30" fill="#8A847C" text-anchor="middle">${day}</text>`;
  }).join('');
  const stat = (x, n, label) => `<text x="${x}" y="1300" ${FONT} font-size="80" font-weight="800" fill="#12100E" text-anchor="middle">${formatCount(n)}</text>
<text x="${x}" y="1350" ${FONT} font-size="30" fill="#57534E" text-anchor="middle">${label}</text>`;
  const headline = r.linked ? `${r.solved} problem${r.solved === 1 ? '' : 's'} solved` : `${r.posts} post${r.posts === 1 ? '' : 's'} this week`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#F97316"/><stop offset="1" stop-color="#FDBA74"/></linearGradient></defs>
<rect width="1080" height="1920" fill="url(#g)"/>
<text x="540" y="200" ${FONT} font-size="84" font-weight="800" fill="#FFFFFF" text-anchor="middle">Fync</text>
<text x="540" y="290" ${FONT} font-size="44" fill="#FFFFFF" text-anchor="middle">${esc(truncate(r.name, 28))}'s week</text>
<rect x="90" y="380" width="900" height="1080" rx="56" fill="#FFFFFF"/>
<text x="540" y="560" ${FONT} font-size="72" font-weight="800" fill="#12100E" text-anchor="middle">${esc(headline)}</text>
<text x="540" y="630" ${FONT} font-size="32" fill="#8A847C" text-anchor="middle">${r.linked ? 'LeetCode · GFG · Codeforces · CodeChef' : 'last 7 days on Fync'}</text>
${r.linked ? bars : ''}
${stat(260, r.streak, 'day streak')}${stat(540, r.posts, 'posts')}${stat(820, r.likes, 'likes')}
${r.topPost ? `<text x="540" y="1420" ${FONT} font-size="30" fill="#57534E" text-anchor="middle">Top post: "${esc(truncate(r.topPost.text, 40))}"</text>` : ''}
<rect x="190" y="1580" width="700" height="96" rx="48" fill="#FFFFFF"/>
<text x="540" y="1642" ${FONT} font-size="36" font-weight="700" fill="#F97316" text-anchor="middle">beat my week on Fync →</text>
<text x="540" y="1770" ${FONT} font-size="32" fill="#12100E" text-anchor="middle">${esc(String(link).replace(/^https?:\/\//, ''))}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
};

/** Sunday push to everyone active this week. */
export const runWeeklyRecapPush = async (now = new Date()) => {
  const since = new Date(now.getTime() - 7 * DAY);
  // ponytail: one capped batch; page by _id when weekly actives pass this.
  const users = await User.find({ lastPostDate: { $gte: since }, isBanned: { $ne: true } })
    .select('fcmTokens expoPushToken').limit(5000).lean();
  let sent = 0;
  for (const u of users) {
    const ok = await pushUser(u, {
      title: 'Your week on Fync is ready 📊',
      body: 'Problems solved, posts, streak. Share your card to your story.',
      data: { type: 'weekly_recap', screen: 'Profile' },
      tag: 'weekly_recap',
    });
    if (ok) sent++;
  }
  return sent;
};

export const initWeeklyRecap = () => {
  cron.schedule('0 18 * * 0', () => {
    runWeeklyRecapPush()
      .then((n) => console.log(`📊 Weekly recap: ${n} pushes`))
      .catch((err) => console.error('Weekly recap error:', err.message));
  }, { timezone: 'Asia/Kolkata' });
};
