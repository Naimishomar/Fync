// Per-route latency benchmark for the hackathon service.
//
// Raw query count is the wrong metric: six queries inside a Promise.all cost
// ONE wave of network latency, not six. What sets a route's latency is the
// DEPTH of its dependent chain — how many times it has to wait for the database
// before it can answer.
//
// So depth is measured, not guessed: every Mongo operation is given an
// artificial delay, the route is timed with and without it, and
//
//     depth = (slow_time - fast_time) / injected_delay
//
// Reported per route:
//   depth  — dependent round trips on the critical path
//   trips  — total queries issued (database load, not latency)
//   cpu    — local p50 with a zero-latency database: hydration, populate,
//            serialisation. This part does not shrink when Mongo gets closer.
//   proj   — projected server time on Atlas = depth * RTT + handler CPU,
//            with this harness's own loopback HTTP overhead subtracted
//
// Budget: server handler time under 10ms.
//
// Run: node scripts/hackathonLatency.js [--runs 30] [--rtt 1.5]
import 'dotenv/config.js';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

const RUNS = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 30;
// Typical same-region Mongo Atlas round trip. Override with --rtt.
const RTT_MS = Number(process.argv[process.argv.indexOf('--rtt') + 1]) || 1.5;
const DELAY_MS = 8;          // injected per-op delay; big enough to measure cleanly
const SERVER_BUDGET_MS = 10; // "single digit" server handler time
process.env.JWT_SECRET ||= 'hackathon-latency-secret';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_hack_latency'));

// ── instrument: count queries, and optionally slow each one down ────────────
let trips = 0;
let injecting = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Registered before any model compiles, so it applies to every schema.
mongoose.plugin((schema) => {
  schema.pre(/^(find|count|aggregate|update|delete|insert|save|replace)/, async function () {
    trips++;
    if (injecting) await sleep(DELAY_MS);
  });
});

const { default: User } = await import('../models/user.model.js');
const mk = (name, skills, n) => ({
  name, username: name.toLowerCase(), email: `${name.toLowerCase()}@bench.dev`,
  mobileNumber: `91000000${n}`, password: 'x', dob: new Date('2003-01-01'),
  college: 'Bench Institute', year: '3', gender: 'Other', major: 'CSE', skills,
});
const [organiser, leader, joiner, judge] = await User.create([
  mk('Organiser', ['react'], 1), mk('Leader', ['react', 'node'], 2),
  mk('Joiner', ['node'], 3), mk('Judge', [], 4),
]);
const tok = (u) => jwt.sign({ id: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
const TOKENS = { organiser: tok(organiser), leader: tok(leader), joiner: tok(joiner), judge: tok(judge) };

const app = express();
app.use(express.json());
for (const [path, mod] of [
  ['/hackathons', '../routes/hackathon/hackathon.route.js'],
  ['/teams', '../routes/hackathon/team.route.js'],
  ['/submissions', '../routes/hackathon/submission.route.js'],
  ['/announcements', '../routes/hackathon/announcement.route.js'],
  ['/scores', '../routes/hackathon/score.route.js'],
  ['/hackathon-leaderboard', '../routes/hackathon/leaderboard.route.js'],
]) app.use(path, (await import(mod)).default);

// Baselines, so the numbers below can be read honestly. Without these there is
// no way to tell handler cost apart from the cost of the loopback HTTP call,
// JSON encoding and JWT verification that every measurement carries.
const { authMiddleware } = await import('../middlewares/auth.middleware.js');
app.get('/bench/noop', (_req, res) => res.json({ ok: true }));
app.get('/bench/auth', authMiddleware, (_req, res) => res.json({ ok: true }));
app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));

const server = app.listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

const call = async (method, path, as = 'organiser', body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKENS[as]}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

// ── seed one realistic hackathon ────────────────────────────────────────────
const day = 864e5, now = Date.now();
let r = await call('POST', '/hackathons', 'organiser', {
  title: 'Latency Bench', registrationstart: new Date(now - day), registrationends: new Date(now + day),
  hackathonstarts: new Date(now - day), hackathonends: new Date(now + 7 * day),
  prizepool: '₹1,00,000', tags: ['ai'], MaxTeamSize: 3,
  judgingcriteria: [{ name: 'Innovation', weightage: '3' }, { name: 'Execution', weightage: '1' }],
});
const HACK = r.json.hackathon._id;
for (const who of ['leader', 'joiner', 'judge']) await call('POST', `/hackathons/${HACK}/join`, who);
await call('POST', `/hackathons/${HACK}/judge`, 'organiser', { judgeId: judge._id });
await call('PATCH', `/hackathons/${HACK}/status`, 'organiser', { status: 'active' });
r = await call('POST', '/teams', 'leader', { hackathonId: HACK, name: 'Bench Team', requiredskill: ['node'] });
const TEAM = r.json.data._id;
r = await call('POST', '/submissions', 'leader', {
  hackathon: HACK, team: TEAM, ProjectName: 'Bench Project', TagLine: 'fast',
  description: 'x', techStack: ['node'], category: 'web',
});
const { default: SubModel } = await import('../models/hackathon/submission.model.js');
const SUB = String(r.json.submission?._id ?? (await SubModel.findOne({ hackathon: HACK }))._id);
await call('POST', `/submissions/${SUB}/finalize`, 'leader');
await call('PATCH', `/hackathons/${HACK}/status`, 'organiser', { status: 'judging' });
await call('POST', '/scores', 'judge', {
  submission: SUB,
  criteria: [{ name: 'Innovation', weightage: 3, score: 9 }, { name: 'Execution', weightage: 1, score: 7 }],
});
r = await call('POST', `/announcements/${HACK}`, 'organiser', { title: 'Go', body: 'Ship it.' });
const ANN = r.json.announcement._id;

// ── the read paths users actually hit ───────────────────────────────────────
const ROUTES = [
  ['GET', '/bench/noop', 'organiser', null, '— baseline: bare route'],
  ['GET', '/bench/auth', 'organiser', null, '— baseline: + authMiddleware'],
  ['POST', '/hackathons/list', 'organiser', { page: 1, limit: 10 }, 'browse hub'],
  ['GET', '/hackathons/my', 'leader', null, 'my hackathons'],
  ['GET', `/hackathons/${HACK}`, 'joiner', null, 'hackathon detail'],
  ['GET', `/hackathons/${HACK}/dashboard`, 'organiser', null, 'organiser console'],
  ['GET', `/hackathons/${HACK}/channel`, 'joiner', null, 'channel'],
  ['GET', `/teams?hackathon=${HACK}`, 'joiner', null, 'team list'],
  ['GET', `/teams/${TEAM}`, 'leader', null, 'team detail'],
  ['GET', `/teams/match/${HACK}`, 'joiner', null, 'team matching'],
  ['GET', `/submissions?hackathon=${HACK}`, 'organiser', null, 'submission list'],
  ['GET', `/submissions/my/${HACK}`, 'leader', null, 'my submission'],
  ['GET', `/scores/judge/pending/${HACK}`, 'judge', null, 'judge queue'],
  ['GET', `/scores/judge/scored/${HACK}`, 'judge', null, 'judge scored'],
  ['GET', `/scores/${SUB}`, 'judge', null, 'score breakdown'],
  ['GET', `/hackathon-leaderboard/${HACK}`, 'organiser', null, 'leaderboard'],
  ['GET', `/announcements/${HACK}`, 'joiner', null, 'announcements'],
];

const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * p)] ?? 0;
const rows = [];

const timeIt = async (method, path, as, body, n) => {
  const times = [];
  for (let i = 0; i < n; i++) {
    const s0 = process.hrtime.bigint();
    const res = await call(method, path, as, body);
    times.push(Number(process.hrtime.bigint() - s0) / 1e6);
    if (res.status >= 400) return { err: res.status, times };
  }
  return { times };
};

for (const [method, path, as, body, label] of ROUTES) {
  await call(method, path, as, body); // warm up

  // total queries issued for one request
  trips = 0;
  await call(method, path, as, body);
  const totalTrips = trips;

  // fast pass — zero-latency database, so this is pure CPU
  injecting = false;
  const fast = await timeIt(method, path, as, body, RUNS);
  if (fast.err) { rows.push({ label, err: fast.err }); continue; }

  // slow pass — every op delayed, so the delta exposes chain depth
  injecting = true;
  const slow = await timeIt(method, path, as, body, Math.max(6, Math.round(RUNS / 4)));
  injecting = false;
  if (slow.err) { rows.push({ label, err: slow.err }); continue; }

  const cpu = pct(fast.times, 0.5);
  const depth = Math.max(1, Math.round((pct(slow.times, 0.5) - cpu) / DELAY_MS));
  rows.push({ label, trips: totalTrips, depth, cpu });
}

const harness = rows.find((r) => r.label.includes('bare route'))?.cpu ?? 0;
for (const r of rows) {
  if (r.err) continue;
  // server-side cost only: chain depth against real RTT, plus handler CPU with
  // this harness's own loopback overhead subtracted out.
  r.proj = r.depth * RTT_MS + Math.max(0, r.cpu - harness);
}
rows.sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0));
console.log(`\nper-route server cost  (${RUNS} runs, Atlas RTT assumed ${RTT_MS}ms)`);
console.log('─'.repeat(74));
console.log('depth  trips   cpu     proj    route');
for (const r of rows) {
  if (r.err) { console.log(`  err  ${String(r.err).padStart(5)}                  ${r.label}`); continue; }
  const flag = r.proj > SERVER_BUDGET_MS ? '  << over budget' : '';
  console.log(
    `${String(r.depth).padStart(5)}  ${String(r.trips).padStart(5)}  ` +
    `${r.cpu.toFixed(2).padStart(6)}  ${r.proj.toFixed(2).padStart(6)}  ${r.label}${flag}`
  );
}
const base = rows.find((r) => r.label.includes('+ authMiddleware'));
if (base) {
  console.log('─'.repeat(74));
  console.log(`baseline (loopback HTTP + JWT + auth lookup): ${base.cpu.toFixed(2)}ms cpu, depth ${base.depth}`);
  console.log('net handler cost above that baseline:');
  for (const r of rows) {
    if (r.err || r.label.startsWith('—')) continue;
    console.log(
      `${String(r.depth - base.depth).padStart(5)}  ${''.padStart(5)}  ` +
      `${(r.cpu - base.cpu).toFixed(2).padStart(6)}  ${''.padStart(6)}  ${r.label}`
    );
  }
}
const over = rows.filter((r) => !r.err && !r.label.startsWith('—') && r.proj > SERVER_BUDGET_MS);
console.log('─'.repeat(74));
console.log(`${over.length} of ${rows.filter((r) => !r.err && !r.label.startsWith('—')).length} routes projected over ${SERVER_BUDGET_MS}ms of server time`);
console.log(`deepest chain: ${rows.reduce((a, b) => ((a.depth ?? 0) > (b.depth ?? 0) ? a : b)).label}`);

server.close();
await mongoose.disconnect();
await mongod.stop();
process.exit(0);
