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
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      if (payload?.id) {
        // Hand the verified payload forward. authMiddleware runs later in the
        // same request and was verifying the identical token a second time --
        // two HMACs per authenticated request instead of one. Only a payload
        // this function actually verified is ever attached, so trusting it
        // downstream is the same trust boundary, not a weaker one.
        req.verifiedJwt = payload;
        return `u:${payload.id}`;
      }
    } catch {
      // Fall through to IP for expired/invalid tokens.
    }
  }
  return ipKeyGenerator(req.ip);
};

// Login and OTP routes are anonymous, so the campus-NAT problem above applies
// to them too: key by the account being targeted plus the address. Brute force
// against one account is still capped; a classmate on the same NAT is not.
export const identifierIpKey = (req) => {
  const id = String(req.body?.email || req.body?.identifier || '').toLowerCase().trim();
  return `${ipKeyGenerator(req.ip)}:${id}`;
};

// Refresh is a background call every app open makes, so it must not share
// the login bucket. Keyed by the refresh token's user when it verifies.
const refreshKey = (req) => {
  try {
    const { id } = jwt.verify(String(req.body?.refreshToken || ''), process.env.JWT_REFRESH_SECRET);
    if (id) return `u:${id}`;
  } catch {
    // Invalid/expired: fall through to IP.
  }
  return ipKeyGenerator(req.ip);
};

export const createRedisStore = (prefix) => new RedisStore({
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
    keyGenerator: identifierIpKey,
    store: createRedisStore('rl_auth:'),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 login attempts per account per address
    // Fail open: closed turned every login into a 500 whenever Redis blipped.
    passOnStoreError: true,
    message: {
        success: false,
        message: "Too many login attempts. Please try again later for security."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// The two above key by (address, account), so one address rotating through
// accounts or emails had no ceiling at all. A coarse per-address cap on top,
// loose enough for a campus NAT.
const ipCeiling = (prefix, windowMs, max) => rateLimit({
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    store: createRedisStore(prefix),
    windowMs,
    max,
    passOnStoreError: true,
    message: { success: false, message: "Too many requests from this network. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});
export const otpIpLimiter = ipCeiling('rl_otp_ip:', 5 * 60 * 1000, 30);
export const loginIpLimiter = ipCeiling('rl_login_ip:', 60 * 60 * 1000, 60);

export const refreshLimiter = rateLimit({
    keyGenerator: refreshKey,
    store: createRedisStore('rl_refresh:'),
    windowMs: 60 * 60 * 1000,
    max: 120,
    passOnStoreError: true,
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
