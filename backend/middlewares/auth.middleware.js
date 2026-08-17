import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import redisClient from "../utils/redis.js";

// Fields the rest of the app reads off req.user. Keep this in sync with the
// object built below — selecting only these keeps the auth lookup off the
// hot path of large documents (followers/following arrays are huge).
const AUTH_FIELDS =
  "name email username mobileNumber college major avatar skills user_access graduationYear isBanned";

const CACHE_TTL_SECONDS = 300;
export const authCacheKey = (id) => `auth:user:${id}`;

// Every authenticated request used to cost one full Mongo round-trip plus
// hydration of the whole user document. Cache the projected doc in Redis so the
// common case is a single sub-millisecond GET.
const loadUser = async (id) => {
  const key = authCacheKey(id);
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.error("Auth cache read error:", err.message);
  }

  const user = await User.findById(id).select(AUTH_FIELDS).lean();
  if (!user) return null;

  try {
    await redisClient.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(user));
  } catch (err) {
    console.error("Auth cache write error:", err.message);
  }
  return user;
};

export const invalidateAuthCache = async (id) => {
  if (!id) return;
  try {
    await redisClient.del(authCacheKey(String(id)));
  } catch (err) {
    console.error("Auth cache invalidation error:", err.message);
  }
};

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({
        success: false,
        message: "Malformed token",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Let the client tell "refresh me" apart from "log in again".
      const expired = err.name === "TokenExpiredError";
      return res.status(401).json({
        success: false,
        message: expired ? "Token expired" : "Invalid token",
        expired,
      });
    }

    const user = await loadUser(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended for violating our terms.",
        isBanned: true,
      });
    }

    req.user = {
      id: String(user._id),
      // JSON round-trips through Redis turn _id into a string; controllers expect
      // an ObjectId here, so restore the type.
      _id: new mongoose.Types.ObjectId(String(user._id)),
      name: user.name,
      email: user.email,
      username: user.username,
      mobileNumber: user.mobileNumber,
      college: user.college,
      major: user.major,
      avatar: user.avatar,
      skills: user.skills || [],
      user_access: user.user_access,
      graduationYear: user.graduationYear,
    };
    next();
  } catch (error) {
    // A Mongo/Redis failure here is a 500, not a bad token — returning 401
    // would log every user out during an outage.
    next(error);
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user && req.user.user_access === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin authorization required."
    });
  }
};
