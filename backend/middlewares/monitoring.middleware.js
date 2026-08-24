
// Under heavy concurrent load (10k+ users), logging EVERY request to stdout is a
// major bottleneck. We sample: 1% of fast requests + every slow (>=200ms) or 5xx.
const SAMPLE_RATE = 0.01;
let counter = 0;

export const monitoringMiddleware = async (req, res, next) => {
    const start = process.hrtime();

    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const diff = process.hrtime(start);
        const durationMs = diff[0] * 1e3 + diff[1] * 1e-6;
        const durationInMs = durationMs.toFixed(2);
        counter++;

        if (req.originalUrl !== '/favicon.ico' && req.originalUrl.startsWith('/socket.io') !== true) {
            // Every request, not just the sampled 1%: percentiles from a 1%
            // sample of a low-traffic route are noise.
            recordLatency(req.method, req.originalUrl, durationMs);

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

// ── PER-ROUTE LATENCY ────────────────────────────────────────────────────────
// The sampled console log above answers "was that request slow"; it cannot
// answer "which routes are over 3ms at p99", which is the only question that
// matters when chasing a latency target. This keeps a bounded sample per route
// in process memory — no Redis hop, no allocation per request beyond a number.
//
// Reservoir, not a full log: an unbounded array per route is a memory leak with
// a dashboard attached.
const SAMPLES_PER_ROUTE = 512;
const MAX_ROUTES = 400;

/** @type {Map<string, {count:number, total:number, max:number, samples:number[], next:number}>} */
const routeStats = new Map();

// Ids in the path would give every post its own bucket. Collapse anything that
// is an ObjectId, a UUID or a bare number back to a placeholder so /post/abc123
// and /post/def456 aggregate as one route.
const ID_SEGMENT = /^([0-9a-f]{24}|[0-9]+|[0-9a-f-]{32,36})$/i;

export const normalizeRoute = (method, url) => {
    const path = url.split('?')[0];
    const collapsed = path
        .split('/')
        .map((segment) => (ID_SEGMENT.test(segment) ? ':id' : segment))
        .join('/');
    return `${method} ${collapsed}`;
};

export const recordLatency = (method, url, ms) => {
    const route = normalizeRoute(method, url);
    let stat = routeStats.get(route);
    if (!stat) {
        // Bounded so a scanner hitting random paths cannot grow this forever.
        if (routeStats.size >= MAX_ROUTES) return;
        stat = { count: 0, total: 0, max: 0, samples: [], next: 0 };
        routeStats.set(route, stat);
    }
    stat.count++;
    stat.total += ms;
    if (ms > stat.max) stat.max = ms;
    if (stat.samples.length < SAMPLES_PER_ROUTE) {
        stat.samples.push(ms);
    } else {
        // Ring buffer: the report describes recent traffic, not all of history.
        stat.samples[stat.next] = ms;
        stat.next = (stat.next + 1) % SAMPLES_PER_ROUTE;
    }
};

/** Nearest-rank percentile. `sorted` must be ascending and non-empty. */
export const percentile = (sorted, p) => {
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
};

const round = (n) => Math.round(n * 100) / 100;

/** Slowest routes first, so the report opens on what to fix. */
export const latencyReport = ({ limit = 50, budgetMs = 3 } = {}) => {
    const rows = [];
    for (const [route, stat] of routeStats) {
        if (stat.samples.length === 0) continue;
        const sorted = [...stat.samples].sort((a, b) => a - b);
        rows.push({
            route,
            count: stat.count,
            avg: round(stat.total / stat.count),
            p50: round(percentile(sorted, 50)),
            p95: round(percentile(sorted, 95)),
            p99: round(percentile(sorted, 99)),
            max: round(stat.max),
            overBudget: percentile(sorted, 50) > budgetMs,
        });
    }
    rows.sort((a, b) => b.p99 - a.p99);
    return {
        budgetMs,
        routes: rows.length,
        overBudget: rows.filter((r) => r.overBudget).length,
        slowest: rows.slice(0, limit),
    };
};

export const resetLatency = () => routeStats.clear();
