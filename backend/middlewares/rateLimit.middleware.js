import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import jwt from 'jsonwebtoken';
import redisClient from '../utils/redis.js';

// A whole campus sits behind one NAT address, so a purely IP-keyed limit throttles
// hundreds of students as if they were one client. Key authenticated traffic by
// user id instead and fall back to IP only for anonymous requests.
//
// The token is verified rather than merely decoded: an unverified `sub` would let
// anyone mint a fresh limit bucket per request and bypass the limiter entirely.
const userOrIpKey = (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const { id } = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      if (id) return `u:${id}`;
    } catch {
      // Fall through to IP for expired/invalid tokens.
    }
  }
  return ipKeyGenerator(req, res);
};

const createRedisStore = (prefix) => new RedisStore({
  sendCommand: async (...args) => {
    // isReady, not isOpen: isOpen stays true for the whole reconnect loop, so a
    // dead Redis fell through to the 3s race below on every single request
    // instead of bypassing instantly. isReady is false until the connection can
    // actually accept commands.
    if (!redisClient.isReady) {
      throw new Error("Redis is offline, bypassing rate limit to prevent hang.");
    }
    // Allow up to 3 seconds for commands (handles initial connection/script loading latency).
    // The timer must be cleared: leaving it pending kept one live timer per request,
    // which at a few thousand requests a minute is a steady leak for no reason.
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Redis Timeout")), 3000);
    });
    try {
      return await Promise.race([redisClient.sendCommand(args), timeout]);
    } finally {
      clearTimeout(timer);
    }
  },
  prefix: prefix,
});

export const createLimiter = rateLimit({
    keyGenerator: userOrIpKey,
    store: createRedisStore('rl_create:'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 creations per window
    passOnStoreError: true,
    message: {
        success: false,
        message: "Transmission limit exceeded. Please wait 15 minutes before establishing another signal."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const authLimiter = rateLimit({
    store: createRedisStore('rl_auth:'),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 login attempts
    passOnStoreError: true,
    message: {
        success: false,
        message: "Too many login attempts. Please try again later for security."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const feedLimiter = rateLimit({
    keyGenerator: userOrIpKey,
    store: createRedisStore('rl_feed:'),
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // High limit for scrollers
    passOnStoreError: true,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only limit if they are hitting it too hard with failures or spam
});

export const generalLimiter = rateLimit({
    keyGenerator: userOrIpKey,
    store: createRedisStore('rl_general:'),
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Balanced for typical usage
    passOnStoreError: true,
    message: {
        success: false,
        message: "System load high. Please slow down your requests."
    },
    standardHeaders: true,
    legacyHeaders: false,
});
