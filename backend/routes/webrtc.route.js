import express from 'express';
import axios from 'axios';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import redisClient from '../utils/redis.js';

const router = express.Router();

const TURN_CACHE_KEY = 'webrtc:turn-credentials';
const TURN_CACHE_TTL = 3600; // cache for 1 hour (creds are valid for 24h)

// Generate Cloudflare TURN credentials dynamically.
// Cached in Redis so we only hit the Cloudflare API once per hour regardless
// of how many users start calls, keeping call setup latency low.
router.post('/turn-credentials', authMiddleware, async (req, res) => {
    try {
        // 1. Serve from Redis cache if fresh
        try {
            const cached = await redisClient.get(TURN_CACHE_KEY);
            if (cached) {
                return res.status(200).json({ success: true, iceServers: JSON.parse(cached), cached: true });
            }
        } catch (e) {
            // Redis unavailable — fall through to Cloudflare
        }

        const turnKeyId = process.env.CF_TURN_KEY_ID;
        const apiToken = process.env.CF_API_TOKEN;

        if (!turnKeyId || !apiToken) {
            console.error("Missing Cloudflare TURN credentials in .env");
            return res.status(500).json({ success: false, message: 'Cloudflare credentials not configured on server' });
        }

        const response = await axios.post(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${turnKeyId}/credentials/generate`,
            { ttl: 86400 }, // 24 hours
            {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.iceServers) {
            // 2. Store in Redis for subsequent callers
            try {
                await redisClient.setEx(TURN_CACHE_KEY, TURN_CACHE_TTL, JSON.stringify(response.data.iceServers));
            } catch (e) {
                console.warn('Failed to cache TURN credentials', e.message);
            }
            return res.status(200).json({ success: true, iceServers: response.data.iceServers });
        } else {
            return res.status(500).json({ success: false, message: 'Invalid response from Cloudflare' });
        }
    } catch (error) {
        console.error('Error fetching TURN credentials from Cloudflare:', error.message);
        res.status(500).json({ success: false, message: 'Server error generating TURN credentials' });
    }
});

export default router;