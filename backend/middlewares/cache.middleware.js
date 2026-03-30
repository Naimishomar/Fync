import redisClient from '../utils/redis.js';

export const cacheMiddleware = (duration) => async (req, res, next) => {
    if (req.method !== 'GET') {
        return next();
    }

    const key = `fync_cache:${req.user?.id || 'public'}:${req.originalUrl}`;

    try {
        const cachedResponse = await redisClient.get(key);
        if (cachedResponse) {
            console.log(`Cache Hit for ${key} ✅`);
            return res.status(200).json(JSON.parse(cachedResponse));
        }

        // Override res.json to catch the response and cache it
        const originalJson = res.json;
        res.json = (body) => {
            if (res.statusCode === 200 && body.success) {
                redisClient.setEx(key, duration, JSON.stringify(body))
                    .catch(err => console.error("Redis Cache Save Error:", err));
            }
            return originalJson.call(res, body);
        };

        next();
    } catch (error) {
        console.error("Redis Middleware Error:", error);
        next();
    }
};

export const clearCache = async (pattern) => {
    try {
        // Find all keys matching the pattern regardless of userId
        const keys = await redisClient.keys(`fync_cache:*${pattern}*`);
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`🧹 Redis Clear: ${keys.length} keys for pattern "${pattern}"`);
        }
    } catch (error) {
        console.error("Redis Cache Clear Error:", error);
    }
};
