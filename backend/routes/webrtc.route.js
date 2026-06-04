import express from 'express';
import axios from 'axios';

const router = express.Router();

// Generate Cloudflare TURN credentials dynamically
router.post('/turn-credentials', async (req, res) => {
    try {
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
