/**
 * The batch endpoint is a request multiplexer, so the things that can go wrong
 * with it are security-shaped: bypassing auth, reaching routes it should not,
 * or fetching arbitrary hosts. These assert the guards, not the happy path.
 *
 *   node routes/batch.route.test.js
 */
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import batchRoute from './batch.route.js';

const app = express();
app.use(express.json());

// A stand-in for authMiddleware: proves sub-requests really do traverse the
// middleware chain rather than skipping straight to the handler.
let authCalls = 0;
const requireAuth = (req, res, next) => {
  authCalls++;
  if (req.headers.authorization !== 'Bearer good') {
    return res.status(401).json({ success: false, message: 'No token' });
  }
  req.user = { id: 'u1' };
  next();
};

app.get('/open', (req, res) => res.json({ success: true, who: 'open' }));
app.get('/secret', requireAuth, (req, res) => res.json({ success: true, user: req.user.id }));
app.get('/echo', requireAuth, (req, res) => res.json({ success: true, q: req.query.n || null }));
app.get('/boom', requireAuth, () => { throw new Error('handler exploded'); });
app.get('/slow', requireAuth, () => { /* never responds */ });
app.get('/health', (req, res) => res.json({ status: 'UP' }));

app.use('/batch', batchRoute);

const server = http.createServer(app);
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const batch = (requests, auth = 'Bearer good') =>
  fetch(`${base}/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify({ requests }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

// ── Sub-requests really run through the middleware chain ────────────────────
authCalls = 0;
let res = await batch([
  { key: 'a', path: '/open' },
  { key: 'b', path: '/secret' },
]);
assert.equal(res.status, 200);
assert.equal(res.body.results.a.body.who, 'open');
assert.equal(res.body.results.b.body.user, 'u1');
assert.equal(authCalls, 1, 'auth middleware did not run for the protected sub-request');

// ── Auth is NOT bypassed: a bad token fails inside the batch too ────────────
res = await batch([{ key: 'b', path: '/secret' }], 'Bearer wrong');
assert.equal(res.body.results.b.status, 401, 'batch leaked a protected route to an unauthenticated caller');

// ── Query strings survive ───────────────────────────────────────────────────
res = await batch([{ key: 'q', path: '/echo?n=7' }]);
assert.equal(res.body.results.q.body.q, '7');

// ── A failing sub-request must not discard the others ───────────────────────
res = await batch([
  { key: 'ok', path: '/open' },
  { key: 'bad', path: '/boom' },
  { key: 'missing', path: '/nope' },
]);
assert.equal(res.body.results.ok.body.who, 'open', 'a sibling failure took down a good sub-request');
assert.equal(res.body.results.bad.status, 500);
assert.equal(res.body.results.missing.status, 404);

// ── SSRF guard: absolute and protocol-relative URLs are refused ─────────────
for (const evil of [
  'http://169.254.169.254/latest/meta-data/',   // EC2 instance metadata
  '//evil.example.com/steal',
  'https://evil.example.com',
  'not-a-path',
]) {
  const r = await batch([{ key: 'x', path: evil }]);
  assert.equal(r.body.results.x.status, 400, `SSRF guard let through: ${evil}`);
}

// ── Denied prefixes ─────────────────────────────────────────────────────────
for (const denied of ['/batch', '/health', '/socket.io/']) {
  const r = await batch([{ key: 'x', path: denied }]);
  assert.equal(r.body.results.x.status, 400, `denied prefix reachable: ${denied}`);
}

// ── Size cap: one request must not fan out into a flood ─────────────────────
res = await batch(Array.from({ length: 13 }, (_, i) => ({ key: `k${i}`, path: '/open' })));
assert.equal(res.status, 400, 'batch size cap not enforced');

// ── Shape validation ────────────────────────────────────────────────────────
for (const bad of [[], null]) {
  const r = await fetch(`${base}/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer good' },
    body: JSON.stringify({ requests: bad }),
  });
  assert.equal(r.status, 400);
}

// ── Sub-requests run concurrently, not one after another ────────────────────
app.get('/wait', requireAuth, (req, res) => setTimeout(() => res.json({ ok: true }), 300));
const started = Date.now();
res = await batch([
  { key: 'w1', path: '/wait' },
  { key: 'w2', path: '/wait' },
  { key: 'w3', path: '/wait' },
]);
const elapsed = Date.now() - started;
assert.ok(res.body.results.w1.body.ok && res.body.results.w3.body.ok);
assert.ok(elapsed < 800, `sub-requests ran serially (${elapsed}ms for 3x300ms)`);

server.close();
console.log('batch.route: all checks passed ✅ (auth enforced, SSRF blocked, cap enforced, concurrent)');

// ── Auth work is shared across sub-requests, not repeated ───────────────────
// A six-endpoint batch should resolve the caller once. This is the actual
// server-side saving: batching does not reduce middleware passes (each
// sub-request still runs the full chain, by design), it reduces the expensive
// work inside them.
{
  const app2 = express();
  app2.use(express.json());

  let resolves = 0;
  app2.use((req, _res, next) => {
    // Mirrors the guard in authMiddleware: reuse an inherited entry for the
    // same user rather than hitting the auth cache again.
    if (!req.authUser || String(req.authUser._id) !== 'u1') {
      resolves++;
      req.authUser = { _id: 'u1' };
    }
    req.user = { id: 'u1' };
    next();
  });
  for (const p of ['a', 'b', 'c', 'd', 'e', 'f']) {
    app2.get(`/${p}`, (_q, r) => r.json({ ok: p }));
  }
  app2.use('/batch', batchRoute);

  const s2 = http.createServer(app2);
  await new Promise((r) => s2.listen(0, r));
  const base2 = `http://127.0.0.1:${s2.address().port}`;
  const paths = ['a', 'b', 'c', 'd', 'e', 'f'];

  resolves = 0;
  await Promise.all(paths.map((p) => fetch(`${base2}/${p}`).then((r) => r.json())));
  const individual = resolves;

  resolves = 0;
  const out = await fetch(`${base2}/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requests: paths.map((p) => ({ key: p, path: `/${p}` })) }),
  }).then((r) => r.json());
  const batched = resolves;

  assert.equal(individual, 6, 'baseline: six separate requests resolve the user six times');
  assert.ok(paths.every((p) => out.results[p].body.ok === p), 'a sub-request did not complete');
  assert.equal(batched, 1, `batch resolved the user ${batched} times, expected 1`);

  s2.close();
  console.log(`batch.route: auth resolved ${individual}x individually vs ${batched}x batched ✅`);
}

// ── Dispatch overhead stays single-digit ────────────────────────────────────
// Guards the thing that makes batching worth doing: the multiplexing itself is
// in-process function calls, so it must add ~nothing. Real-world latency is
// whatever the slowest sub-request's query costs -- this asserts the envelope
// does not become the bottleneck.
{
  const app3 = express();
  app3.use(express.json());
  app3.use((req, _res, next) => { req.user = { id: 'u1' }; next(); });
  const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (const p of keys) app3.get(`/${p}`, (_q, r) => r.json({ ok: p }));
  app3.use('/batch', batchRoute);

  const s3 = http.createServer(app3);
  await new Promise((r) => s3.listen(0, r));
  const base3 = `http://127.0.0.1:${s3.address().port}`;
  // Full cap, so the guard covers the worst allowed case.
  const payload = JSON.stringify({
    requests: Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, path: `/${keys[i % 6]}` })),
  });

  const send = () =>
    fetch(`${base3}/batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    }).then((r) => r.json());

  for (let i = 0; i < 50; i++) await send();

  const samples = [];
  for (let i = 0; i < 300; i++) {
    const t = process.hrtime.bigint();
    await send();
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];

  assert.ok(p99 < 10, `batch of 12 p99 was ${p99.toFixed(2)}ms, expected single-digit`);

  s3.close();
  console.log(`batch.route: 12 sub-requests p50=${samples[150].toFixed(2)}ms p99=${p99.toFixed(2)}ms ✅`);
}
