import redisClient from '../utils/redis.js';

export const monitoringMiddleware = async (req, res, next) => {
    const start = process.hrtime();

    // Capture the original end function to calculate total time
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const diff = process.hrtime(start);
        const durationInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        
        // Skip logging for health checks or favicon if needed
        if (req.originalUrl !== '/favicon.ico') {
            const cacheStatus = res.getHeader('X-Cache-Hit') || 'MISS';
            
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${durationInMs}ms`,
                cache: cacheStatus,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }));
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
