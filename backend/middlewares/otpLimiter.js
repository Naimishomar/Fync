import rateLimit from "express-rate-limit";
import redisClient from "../utils/redis.js";
import { identifierIpKey, createRedisStore } from "./rateLimit.middleware.js";

export const otpLimiter = rateLimit({
  keyGenerator: identifierIpKey,
  store: createRedisStore("rl_otp:"),
  windowMs: 5 * 60 * 1000,
  max: 10,
  passOnStoreError: true,
  message: "Too many OTP requests. Try again later."
});

// The limiter above is per address; a 6-digit code also needs a per-email cap,
// or rotating addresses walks the code space. 5 wrong codes lock that email for
// 15 minutes from the first miss. Redis down = no lock (the limiter still runs).
const FAIL_MAX = 5;
const FAIL_WINDOW_SECONDS = 15 * 60;
const failKey = (email) => `otp_fail:${String(email).toLowerCase().trim()}`;

export const isOtpLocked = async (email) => {
  try {
    return Number(await redisClient.get(failKey(email))) >= FAIL_MAX;
  } catch {
    return false;
  }
};

export const recordOtpFail = async (email) => {
  try {
    const n = await redisClient.incr(failKey(email));
    if (n === 1) await redisClient.expire(failKey(email), FAIL_WINDOW_SECONDS);
  } catch (err) {
    console.error("OTP fail counter error:", err.message);
  }
};

export const clearOtpFails = async (email) => {
  try {
    await redisClient.del(failKey(email));
  } catch {
    // Expires on its own.
  }
};
