/**
 * Ghost opponents for 1v1 quiz: when nobody else is searching, replay a real
 * past attempt. The ghost is a recorded player's actual answers to the exact
 * questions they saw, so the score you are up against was really scored.
 *
 * Redis list per domain, newest first, capped. Nothing personal beyond the
 * public name/username/avatar the opponent card already shows.
 */

export const GHOST_WAIT_MS = 15000;
const MAX_GHOSTS = 50;
const GHOST_TTL_SECONDS = 7 * 24 * 60 * 60;

const key = (domain) => `ghost:quiz:${domain}`;

/** Save one finished human attempt. Never throws: a lost ghost is harmless. */
export const recordGhost = async (redis, domain, { userId, name, username, avatar, questions, answers, score }) => {
  if (!domain || !userId || !Array.isArray(questions) || !questions.length) return;
  try {
    await redis.lPush(key(domain), JSON.stringify({ userId: String(userId), name, username, avatar, questions, answers, score }));
    await redis.lTrim(key(domain), 0, MAX_GHOSTS - 1);
    await redis.expire(key(domain), GHOST_TTL_SECONDS);
  } catch { /* best effort */ }
};

/** A random recorded attempt by someone other than `userId`, or null. */
export const pickGhost = async (redis, domain, userId, random = Math.random) => {
  const all = (await redis.lRange(key(domain), 0, -1))
    .map((raw) => { try { return JSON.parse(raw); } catch { return null; } })
    .filter((g) => g && g.userId !== String(userId) && Number.isFinite(g.score));
  return all.length ? all[Math.floor(random() * all.length)] : null;
};
