import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../utils/redis.js';

const createRedisStore = (prefix) => new RedisStore({
  sendCommand: (...args) => redisClient.sendCommand(args),
  prefix: prefix,
});

export const createLimiter = rateLimit({
    store: createRedisStore('rl_create:'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 creations per window
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
    message: {
        success: false,
        message: "Too many login attempts. Please try again later for security."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const feedLimiter = rateLimit({
    store: createRedisStore('rl_feed:'),
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // High limit for scrollers
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only limit if they are hitting it too hard with failures or spam
});

export const generalLimiter = rateLimit({
    store: createRedisStore('rl_general:'),
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Balanced for typical usage
    message: {
        success: false,
        message: "System load high. Please slow down your requests."
    },
    standardHeaders: true,
    legacyHeaders: false,
});
