// 1v1 quiz queues are Redis lists of JSON entries ({ userId, socketId, ... }).
// LREM needs the exact stored string, so find this socket's entries first.
// Idempotent: no entry (or no list) is a no-op. Returns entries removed.
export const removeFromQueue = async (redis, queueKey, socketId) => {
  if (!queueKey || !socketId) return 0;
  const entries = await redis.lRange(queueKey, 0, -1);
  let removed = 0;
  for (const raw of entries) {
    let entry;
    try { entry = JSON.parse(raw); } catch { continue; }
    if (entry?.socketId === socketId) removed += await redis.lRem(queueKey, 0, raw);
  }
  return removed;
};
