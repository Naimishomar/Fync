import redisClient from '../utils/redis.js';
import { trackCacheHit, trackCacheMiss } from './monitoring.middleware.js';

export const cacheMiddleware = (duration) => async (req, res, next) => {
    if (req.method !== 'GET') {
        return next();
    }

    // ── IDENTIFY SHARED VS PERSONALIZED ──────────────────────────────────────
    const sharedRoutes = [
        '/entertainment/home', '/entertainment/popular', '/entertainment/trending',
        '/entertainment/bollywood', '/entertainment/top-rated', '/entertainment/upcoming',
        '/marketplace', '/paidGigs', '/short/all', '/post/posts'
    ];

    const isShared = sharedRoutes.some(route => req.originalUrl.includes(route));
    
    // Key structure: fync_cache:type:url
    const key = `fync_cache:${isShared ? 'shared' : req.user?.id || 'guest'}:${req.originalUrl}`;

    try {
        const cachedResponse = await redisClient.get(key);
        if (cachedResponse) {
            console.log(`Cache Hit [${isShared ? 'SHARED' : 'PRIVATE'}] for ${key} ✅`);
            
            // Observability: Track hit
            trackCacheHit(res);
            
            // Set Headers
            res.set('Cache-Control', `public, s-maxage=${duration}, max-age=${Math.floor(duration/2)}`);
            if (!isShared) {
                res.set('Vary', 'Authorization, Origin');
            } else {
                res.set('Vary', 'Origin');
            }
            
            return res.status(200).json(JSON.parse(cachedResponse));
        }

        const originalJson = res.json;
        res.json = (body) => {
            if (res.statusCode === 200 && body.success) {
                // Observability: Track miss
                trackCacheMiss(res);

                res.set('Cache-Control', `public, s-maxage=${duration}, max-age=${Math.floor(duration/2)}`);
                if (!isShared) {
                    res.set('Vary', 'Authorization, Origin');
                } else {
                    res.set('Vary', 'Origin');
                }

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
