import redisClient from '../utils/redis.js';

// Under heavy concurrent load (10k+ users), logging EVERY request to stdout is a
// major bottleneck. We sample: 1% of fast requests + every slow (>=200ms) or 5xx.
const SAMPLE_RATE = 0.01;
let counter = 0;

export const monitoringMiddleware = async (req, res, next) => {
    const start = process.hrtime();

    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const diff = process.hrtime(start);
        const durationInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        counter++;

        if (req.originalUrl !== '/favicon.ico' && req.originalUrl.startsWith('/socket.io') !== true) {
            const shouldLog = res.statusCode >= 500
                || Number(durationInMs) >= 200
                || (counter % Math.round(1 / SAMPLE_RATE) === 0);
            if (shouldLog) {
                console.log(JSON.stringify({
                    timestamp: new Date().toISOString(),
                    method: req.method,
                    url: req.originalUrl,
                    status: res.statusCode,
                    duration: `${durationInMs}ms`,
                    cache: res.getHeader('X-Cache-Hit') || 'MISS',
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }));
            }
        }

        originalEnd.call(this, chunk, encoding);
    };

    next();
};

export const trackCacheHit = (res) => {
    res.setHeader('X-Cache-Hit', 'HIT');
};

export const trackCacheMiss = (res) => {
    res.setHeader('X-Cache-Hit', 'MISS');
};
