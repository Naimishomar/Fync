import User from '../models/user.model.js';
import redisClient from './redis.js';

// Presence used to be global: every connect and disconnect ran
// `io.emit("statusUpdate", ...)` to *every* socket, and handed the joining client
// the entire `global_online_users` set. At 10k concurrent that is 10k deliveries
// per connect — reconnect churn alone (a train ride, a flaky campus wifi) turns
// into millions of frames a minute and pins the CPU.
//
// Nobody actually needs that. The only presence a client renders is for people it
// can chat with, so status changes go to that audience and the initial list is
// filtered down to it.
//
// ponytail: audience = followers ∪ following, cached for 5 minutes. A user who
// gains a follower mid-session won't see them until the cache lapses. If that
// matters, invalidate `presence:audience:<id>` from the follow controller.
const AUDIENCE_TTL_SECONDS = 300;
const audienceKey = (userId) => `presence:audience:${userId}`;

export const getPresenceAudience = async (userId) => {
  const key = audienceKey(userId);
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  } catch {
    // Fall through to Mongo.
  }

  const user = await User.findById(userId).select('followers following').lean();
  if (!user) return [];

  const audience = [
    ...new Set([...(user.followers || []), ...(user.following || [])].map(String)),
  ];

  try {
    await redisClient.setEx(key, AUDIENCE_TTL_SECONDS, JSON.stringify(audience));
  } catch {
    // Cache write is best-effort.
  }
  return audience;
};

export const invalidatePresenceAudience = async (userId) => {
  try {
    await redisClient.del(audienceKey(String(userId)));
  } catch {
    // Best-effort.
  }
};

/** Which of `candidateIds` are currently online, without pulling the whole set. */
export const filterOnline = async (candidateIds) => {
  if (candidateIds.length === 0) return [];
  const flags = await redisClient.smIsMember('global_online_users', candidateIds);
  return candidateIds.filter((_, i) => flags[i]);
};

/** Announce a status change to the people who render this user's presence. */
export const broadcastStatus = async (io, userId, status) => {
  const audience = await getPresenceAudience(userId);
  if (audience.length === 0) return;
  io.to(audience.map((id) => `user:${id}`)).emit('statusUpdate', { userId, status });
};
