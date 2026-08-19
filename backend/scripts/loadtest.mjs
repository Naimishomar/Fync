/**
 * Concurrent-socket load test.
 *
 *   node scripts/loadtest.mjs --url https://api.example.com --sockets 2000
 *
 * Opens N authenticated Socket.IO connections, holds them, and reports what the
 * server's memory and event-loop actually do -- because "handles 2000 users" is
 * a measurement, not a setting. Run it against a staging instance, not prod.
 *
 * Requires a valid JWT (--token) or a secret to mint throwaway ones (--secret,
 * matching the server's JWT_SECRET). Minting is the useful mode: 2000 sockets
 * all claiming the same user id share one presence entry and one room, which is
 * not what production looks like.
 *
 * Watch on the server while this runs:
 *   pm2 monit
 *   watch -n2 'free -m; pm2 jlist | jq ".[0].monit"'
 */

import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const URL = arg('url', 'http://localhost:8000');
const TARGET = Number(arg('sockets', 500));
// Opening thousands of sockets in one tick just queues them in the kernel and
// measures your own laptop, not the server. Ramp instead.
const RAMP_PER_SECOND = Number(arg('rate', 100));
const HOLD_SECONDS = Number(arg('hold', 60));
const TOKEN = arg('token', null);
const SECRET = arg('secret', process.env.JWT_SECRET);

if (!TOKEN && !SECRET) {
  console.error('Need --token <jwt> or --secret <jwt-secret> (or JWT_SECRET in env).');
  process.exit(1);
}

const mintToken = () =>
  TOKEN || jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, SECRET, { expiresIn: '2h' });

const sockets = [];
const stats = { connected: 0, failed: 0, disconnected: 0, errors: new Map() };
const latencies = [];

const note = (err) => {
  const k = String(err?.message || err).slice(0, 60);
  stats.errors.set(k, (stats.errors.get(k) || 0) + 1);
};

const openOne = () =>
  new Promise((resolve) => {
    const started = Date.now();
    const socket = io(URL, {
      transports: ['websocket'],
      auth: { token: mintToken() },
      reconnection: false,
      timeout: 20000,
    });

    socket.on('connect', () => {
      latencies.push(Date.now() - started);
      stats.connected++;
      // Presence and room joins are where per-socket server memory is spent;
      // a test that only opens the transport measures the easy half.
      socket.emit('register');
      resolve();
    });
    socket.on('connect_error', (err) => {
      stats.failed++;
      note(err);
      resolve();
    });
    socket.on('disconnect', () => {
      stats.disconnected++;
    });

    sockets.push(socket);
  });

const percentile = (arr, p) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const report = (label) => {
  const live = stats.connected - stats.disconnected;
  console.log(
    `[${label}] live=${live} connected=${stats.connected} failed=${stats.failed} ` +
      `dropped=${stats.disconnected} | handshake p50=${percentile(latencies, 50)}ms ` +
      `p95=${percentile(latencies, 95)}ms p99=${percentile(latencies, 99)}ms`
  );
  if (stats.errors.size > 0) {
    for (const [msg, count] of stats.errors) console.log(`        ${count}x ${msg}`);
  }
};

const run = async () => {
  console.log(`Opening ${TARGET} sockets to ${URL} at ${RAMP_PER_SECOND}/s…`);

  const batch = Math.max(1, Math.floor(RAMP_PER_SECOND / 10));
  while (sockets.length < TARGET) {
    const size = Math.min(batch, TARGET - sockets.length);
    await Promise.all(Array.from({ length: size }, openOne));
    await new Promise((r) => setTimeout(r, 100));
    if (sockets.length % 250 === 0) report(`ramp ${sockets.length}`);
  }

  report('ramped');
  console.log(`Holding ${HOLD_SECONDS}s — watch server memory and CPU credits now.`);

  // Dropped connections during the hold are the real signal: they mean the
  // server could open the sockets but cannot keep them alive.
  for (let i = 0; i < HOLD_SECONDS; i += 10) {
    await new Promise((r) => setTimeout(r, 10000));
    report(`hold ${i + 10}s`);
  }

  report('final');
  const live = stats.connected - stats.disconnected;
  console.log(
    live >= TARGET * 0.98
      ? `\nHELD ${live}/${TARGET} sockets.`
      : `\nDEGRADED: only ${live}/${TARGET} still connected.`
  );

  sockets.forEach((s) => s.close());
  process.exit(live >= TARGET * 0.98 ? 0 : 1);
};

run().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
