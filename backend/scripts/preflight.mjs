/**
 * Is a candidate box ready to take production traffic?
 *
 *   node scripts/preflight.mjs https://fync-api.duckdns.org
 *   node scripts/preflight.mjs https://fync-api.duckdns.org --ip=5.6.7.8
 *
 * With --ip, every request connects to that address while still sending the
 * real hostname for SNI and validating the certificate against it — the same
 * trick as `curl --resolve`. Useful when replacing the instance: point it at
 * the new box's IP and confirm it serves correctly under the production
 * hostname before the DNS record moves.
 *
 * Exit code is 0 only if every check passes, so it works as a deploy gate.
 */
import https from 'node:https';
import http from 'node:http';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) || process.env.BACKEND_URL || '').replace(/\/$/, '');
const pinnedIp = (args.find((a) => a.startsWith('--ip=')) || '').slice(5) || null;

if (!base) {
  console.error('usage: node scripts/preflight.mjs <baseUrl> [--ip=1.2.3.4]');
  process.exit(2);
}

const get = (path) => {
  const u = new URL(base + path);
  const secure = u.protocol === 'https:';
  const mod = secure ? https : http;
  const opts = {
    hostname: u.hostname,
    port: u.port || (secure ? 443 : 80),
    path: u.pathname + u.search,
    method: 'GET',
    timeout: 10_000,
    // Host header and SNI stay the real name; only the address changes.
    ...(secure ? { servername: u.hostname } : {}),
    // Node calls lookup with { all: true } in some paths and then expects an
    // array of records rather than positional args; answer both shapes.
    ...(pinnedIp
      ? {
          lookup: (_hostname, options, cb) =>
            options && options.all
              ? cb(null, [{ address: pinnedIp, family: 4 }])
              : cb(null, pinnedIp, 4),
        }
      : {}),
  };
  const t0 = process.hrtime.bigint();
  return new Promise((resolve, reject) => {
    const req = mod.request(opts, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () =>
        resolve({ status: res.statusCode, body, ms: Number(process.hrtime.bigint() - t0) / 1e6 }));
    });
    req.on('timeout', () => req.destroy(new Error('timed out after 10s')));
    req.on('error', reject);
    req.end();
  });
};

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(26)} ${detail}`);
};

console.log(`Target: ${base}${pinnedIp ? `  (pinned to ${pinnedIp})` : ''}\n`);

// Health, and with it Mongo and Redis as this box sees them. A cert error
// surfaces here too: the TLS handshake has to succeed before any status code.
let health = null;
try {
  const r = await get('/health');
  health = JSON.parse(r.body);
  record('tls + health', r.status === 200, `${r.status} in ${r.ms.toFixed(0)}ms`);
  record('mongo connected', health.mongo === true, String(health.mongo));
  record('redis adapter', health.redis === true, String(health.redis));
  record('serving host', !!health.host, health.host || 'unlabelled — set SERVER_LABEL');
} catch (err) {
  record('tls + health', false, err.message);
}

// A real route: proves routing, middleware and Atlas work together, and that
// auth is enforced rather than merely configured.
try {
  const r = await get('/post/posts?page=1&limit=1');
  record('auth enforced', r.status === 401 || r.status === 403, `${r.status} unauthenticated`);
  record('app latency', r.ms < 800, `${r.ms.toFixed(0)}ms`);
} catch (err) {
  record('auth enforced', false, err.message);
}

// Served by the app, not by a proxy default page — catches "nginx is up but
// Node is not".
try {
  const r = await get('/.well-known/assetlinks.json');
  record('assetlinks served', r.status === 200, String(r.status));
} catch (err) {
  record('assetlinks served', false, err.message);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('NOT ready:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('Ready. Safe to point DNS here.');
