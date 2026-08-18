import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL,
  // Without this, node-redis queues commands while the socket is down and the
  // reconnectStrategy below never gives up — so `await redisClient.get(...)`
  // hangs forever instead of throwing. authMiddleware awaits Redis on EVERY
  // authenticated request, so one unreachable Redis silently froze the whole
  // API. Fail fast instead: every caller already try/catches and falls back to
  // Mongo.
  disableOfflineQueue: true,
  socket: {
    // Derive TLS from the URL scheme instead of forcing it on: a hardcoded
    // `tls: true` cannot talk to a plain redis:// instance (local, or Redis on
    // the same EC2 box), and the handshake fails with an opaque socket error.
    tls: (process.env.REDIS_URL || '').startsWith('rediss://'),
    keepAlive: 30000,
    // Give up on the *initial* connect, but keep retrying forever afterwards.
    // Bailing out permanently after 5 attempts meant one Redis blip left the
    // process running with rate limiting, caching and presence dead until a
    // manual restart.
    reconnectStrategy: (retries) => Math.min(1000 + retries * 500, 10000),
  },
});

client.on('connect', () => {
  console.log('Redis Client Connected ✅');
});

// Message only, not the error object: reconnects fire forever on a 10s cap, and
// the stack is six identical node:dns frames that say nothing the message does
// not. Logging the object filled the PM2 log with ~150k lines a day.
client.on('error', (err) => {
  console.error('Redis Client Error ❌', err.message);
});

// Exported so anything that genuinely needs Redis at boot can await the
// handshake. With `disableOfflineQueue` there is no buffer any more: a command
// issued in the same tick as this module's import rejects instead of queueing.
//
// Bounded on purpose. The reconnectStrategy above never returns an Error, so
// node-redis retries forever and `connect()` never settles against an
// unreachable host — `await redisReady` would hang the caller for good. This
// resolves either when Redis is ready or once it is clear it is not coming;
// check `redisClient.isReady` afterwards to tell those apart.
const CONNECT_GRACE_MS = 5000;
export const redisReady = (async () => {
  try {
    await Promise.race([
      client.connect(),
      new Promise((resolve) => setTimeout(resolve, CONNECT_GRACE_MS).unref()),
    ]);
  } catch (err) {
    console.error("Initial Redis Connection Failed:", err.message);
  }
})();

// Redis here is a cache, never the source of truth. These wrap the two calls
// that show up in request handlers so a dead Redis degrades to a cache miss
// instead of a 500 — `disableOfflineQueue` above makes offline commands reject
// rather than hang, and something has to catch that rejection.
export const cacheGet = async (key) => {
  try { return await client.get(key); } catch { return null; }
};

export const cacheSet = async (key, ttlSeconds, value) => {
  try { await client.setEx(key, ttlSeconds, value); } catch { /* cache miss next time */ }
};

export default client;