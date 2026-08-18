// End-to-end HTTP test of every hackathon route, against a throwaway in-memory
// MongoDB. Walks one full hackathon lifecycle in order — create, register,
// team up, submit, judge, rank, announce, award, tear down — because these
// routes are not independent: a submission needs a team, a score needs a
// judging-phase hackathon, a leaderboard needs scores.
//
// Redis is deliberately NOT required. Every route here must still answer when
// Redis is unreachable, since that is exactly the outage that took the whole
// hub down.
//
// Run: node scripts/hackathonRoutes.test.js [--verbose]
import 'dotenv/config.js';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

const VERBOSE = process.argv.includes('--verbose');
process.env.JWT_SECRET ||= 'hackathon-route-test-secret';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_hack_routes'));

const { default: User } = await import('../models/user.model.js');
const mkUser = (name, skills, n) => ({
  name,
  username: name.toLowerCase(),
  email: `${name.toLowerCase()}@test.dev`,
  mobileNumber: `90000000${n}`,
  password: 'x',
  dob: new Date('2003-01-01'),
  college: 'Test Institute of Technology',
  year: '3',
  gender: 'Other',
  major: 'CSE',
  skills,
});
const [organiser, leader, joiner, judge] = await User.create([
  mkUser('Organiser', ['react'], 1),
  mkUser('Leader', ['react', 'node'], 2),
  mkUser('Joiner', ['node'], 3),
  mkUser('Judge', [], 4),
]);

const tokenFor = (u) => jwt.sign({ id: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
const TOKENS = {
  organiser: tokenFor(organiser),
  leader: tokenFor(leader),
  joiner: tokenFor(joiner),
  judge: tokenFor(judge),
};

// ── mount the real routers, nothing else ────────────────────────────────────
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

// Surface handler errors as 500 with the message, the way the real app does.
app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));

const server = app.listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

// ── runner ──────────────────────────────────────────────────────────────────
const results = [];
let ctx = {};

const call = async (method, path, { as = 'organiser', body, expect = 200 } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKENS[as]}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }

  const want = Array.isArray(expect) ? expect : [expect];
  const ok = want.includes(res.status);
  results.push({
    ok,
    label: `${method} ${path}`,
    as,
    status: res.status,
    want: want.join('/'),
    message: json.message,
  });
  if (VERBOSE || !ok) {
    console.log(`${ok ? '  ok ' : '  FAIL'} ${method} ${path} [${as}] -> ${res.status}` +
      (ok ? '' : ` (wanted ${want.join('/')})`) + (json.message ? ` :: ${json.message}` : ''));
  }
  return json;
};

const day = 24 * 60 * 60 * 1000;
const now = Date.now();

// ── 1. hackathon lifecycle ──────────────────────────────────────────────────
console.log('\n[1] hackathon');
let r = await call('POST', '/hackathons', {
  expect: 201,
  body: {
    title: 'Route Test Hack',
    registrationstart: new Date(now - day),
    registrationends: new Date(now + day),
    hackathonstarts: new Date(now - day),
    hackathonends: new Date(now + 7 * day),
    prizepool: '₹1,00,000',
    prizes: [{ rank: 1, title: 'Winner', amount: '₹50,000' }],
    tags: ['ai', 'web'],
    MaxTeamSize: 3,
    judgingcriteria: [
      { name: 'Innovation', weightage: '3', description: 'novel?' },
      { name: 'Execution', weightage: '1', description: 'does it run?' },
    ],
  },
});
ctx.hack = r.hackathon?._id;
if (!ctx.hack) { console.error('FATAL: hackathon not created, cannot continue'); process.exit(1); }

await call('GET', `/hackathons/${ctx.hack}`);
await call('POST', '/hackathons/list', { body: { page: 1, limit: 10 } });
await call('POST', '/hackathons/list', { body: { page: 1, limit: 10, status: 'active', tags: ['ai'] } });
await call('GET', '/hackathons/my');
await call('PATCH', `/hackathons/${ctx.hack}`, { body: { description: 'updated blurb' } });
await call('PATCH', `/hackathons/${ctx.hack}`, { as: 'joiner', body: { description: 'nope' }, expect: 403 });
await call('PATCH', `/hackathons/${ctx.hack}/status`, { body: { status: 'active' } });
await call('PATCH', `/hackathons/${ctx.hack}/status`, { body: { status: 'nonsense' }, expect: 400 });
await call('POST', `/hackathons/${ctx.hack}/judge`, { body: { judgeId: judge._id } });
await call('POST', `/hackathons/${ctx.hack}/judge`, { body: { judgeId: judge._id }, expect: 400 });

// ── 2. registration + channel ───────────────────────────────────────────────
console.log('\n[2] registration + channel');
for (const who of ['leader', 'joiner', 'judge']) {
  await call('POST', `/hackathons/${ctx.hack}/join`, { as: who });
}
await call('GET', `/hackathons/${ctx.hack}/channel`);

// ── 3. teams ────────────────────────────────────────────────────────────────
console.log('\n[3] teams');
r = await call('POST', '/teams', {
  as: 'leader',
  expect: 201,
  body: { hackathonId: ctx.hack, name: 'Team Rocket', description: 'we build', requiredskill: ['node'] },
});
ctx.team = r.data?._id;
await call('POST', '/teams', {
  as: 'leader', expect: 400,
  body: { hackathonId: ctx.hack, name: 'Dupe', requiredskill: [] },
});
await call('GET', `/teams?hackathon=${ctx.hack}`);
await call('GET', `/teams?hackathon=${ctx.hack}&lookingforMembers=true`);
await call('GET', `/teams/${ctx.team}`);
await call('PATCH', `/teams/${ctx.team}`, { as: 'leader', body: { description: 'we ship' } });
// "Matched For You" — the default tab of the team screen.
await call('GET', `/teams/match/${ctx.hack}`, { as: 'joiner' });

// join-request flow (the pair the client was calling at the wrong URLs)
await call('POST', `/teams/${ctx.team}/request`, { as: 'joiner', body: { message: 'let me in' } });
r = await call('GET', `/teams/${ctx.team}`, { as: 'leader' });
ctx.request = r.team?.joinRequests?.find((x) => x.status === 'pending')?._id;
results.push({
  ok: !!ctx.request,
  label: 'GET /teams/:id exposes pending joinRequests',
  as: 'leader', status: ctx.request ? 'found' : 'missing', want: 'found',
});
await call('POST', `/teams/${ctx.team}/request/respond`, {
  as: 'leader', body: { requestId: ctx.request, action: 'accept' },
});

// invite flow
await call('POST', `/teams/${ctx.team}/invite`, { as: 'leader', body: { userId: judge._id } });
await call('POST', `/teams/${ctx.team}/invite/respond`, { as: 'judge', body: { action: 'decline' } });

// ── 4. submissions ──────────────────────────────────────────────────────────
console.log('\n[4] submissions');
r = await call('POST', '/submissions', {
  as: 'leader',
  expect: [200, 201],
  body: {
    hackathon: ctx.hack, team: ctx.team,
    ProjectName: 'Fync Router', TagLine: 'routes that route',
    description: 'a thing', techStack: ['node', 'react'], category: 'web',
    GithubUrl: 'https://github.com/x/y',
  },
});
ctx.sub = r.submission?._id || r.data?._id || r.newsub?._id;
if (!ctx.sub) {
  const { default: S } = await import('../models/hackathon/submission.model.js');
  ctx.sub = (await S.findOne({ hackathon: ctx.hack }))?._id?.toString();
}
await call('GET', `/submissions/my/${ctx.hack}`, { as: 'leader' });
await call('GET', `/submissions?hackathon=${ctx.hack}`);
await call('PATCH', `/submissions/${ctx.sub}`, { as: 'leader', body: { TagLine: 'now it routes faster' } });
r = await call('POST', `/submissions/${ctx.sub}/files`, {
  as: 'leader', body: { name: 'deck.pdf', Url: 'https://x/deck.pdf', type: 'pdf', size: '1mb' },
});
ctx.file = (r.submission?.files || r.files || []).slice(-1)[0]?._id;
if (ctx.file) await call('DELETE', `/submissions/${ctx.sub}/files/${ctx.file}`, { as: 'leader' });
await call('POST', `/submissions/${ctx.sub}/finalize`, { as: 'leader' });

// ── 5. judging + scores ─────────────────────────────────────────────────────
console.log('\n[5] judging + scores');
await call('PATCH', `/hackathons/${ctx.hack}/status`, { body: { status: 'judging' } });
r = await call('GET', `/scores/judge/pending/${ctx.hack}`, { as: 'judge' });
results.push({
  ok: (r.pending || []).length > 0,
  label: 'judge pending list is non-empty after a finalized submission',
  as: 'judge', status: `${(r.pending || []).length} pending`, want: '>0',
});
await call('POST', '/scores', {
  as: 'judge',
  body: {
    submission: ctx.sub,
    criteria: [{ name: 'Innovation', weightage: 3, score: 10 }, { name: 'Execution', weightage: 1, score: 2 }],
    feedback: 'solid',
  },
});
await call('POST', '/scores', {
  as: 'leader', expect: 403,
  body: { submission: ctx.sub, criteria: [{ name: 'Innovation', weightage: 3, score: 1 }] },
});
r = await call('GET', `/scores/${ctx.sub}`, { as: 'judge' });
// weighted, not mean: (10*3 + 2*1) / 4 = 8
results.push({
  ok: r.averageScore === 8,
  label: 'totalScore computed on upsert (weighted average = 8)',
  as: 'judge', status: String(r.averageScore), want: '8',
});
await call('GET', `/scores/judge/scored/${ctx.hack}`, { as: 'judge' });

// ── 6. leaderboard (Redis is down — must still rank) ────────────────────────
console.log('\n[6] leaderboard');
r = await call('GET', `/hackathon-leaderboard/${ctx.hack}`);
results.push({
  ok: r.leaderboard?.[0]?.score === 8 && r.leaderboard?.[0]?.rank === 1,
  label: 'leaderboard ranks the scored submission without Redis',
  as: 'organiser',
  status: JSON.stringify(r.leaderboard?.[0] ?? r.message ?? null).slice(0, 90),
  want: 'rank 1, score 8',
});
await call('GET', `/hackathon-leaderboard/${ctx.hack}/top/3`);
// `:n` is user input; a non-numeric value must be rejected, not forwarded to Redis.
await call('GET', `/hackathon-leaderboard/${ctx.hack}/top/abc`, { expect: 400 });
await call('GET', `/hackathon-leaderboard/${ctx.hack}/top/0`, { expect: 400 });
await call('GET', `/hackathon-leaderboard/${ctx.hack}/rank/${ctx.sub}`, { expect: [200, 404] });
// 503 when Redis is down is the correct answer here — there is no cache to rebuild.
await call('POST', `/hackathon-leaderboard/${ctx.hack}/rebuild`, { expect: [200, 503] });
await call('POST', `/hackathon-leaderboard/${ctx.hack}/rebuild`, { as: 'joiner', expect: 403 });

// ── 7. announcements ────────────────────────────────────────────────────────
console.log('\n[7] announcements');
r = await call('POST', `/announcements/${ctx.hack}`, {
  body: { title: 'Judging is live', body: 'Submit before midnight.', type: 'important' },
});
ctx.ann = r.announcement?._id;
await call('POST', `/announcements/${ctx.hack}`, {
  as: 'joiner', expect: 403, body: { title: 'nope', body: 'nope' },
});
await call('GET', `/announcements/${ctx.hack}`, { as: 'joiner' });
await call('GET', `/announcements/${ctx.hack}?type=important&page=1&limit=5`, { as: 'joiner' });
await call('PATCH', `/announcements/${ctx.ann}/react`, { as: 'joiner', body: { emoji: '🔥' } });
await call('PATCH', `/announcements/${ctx.ann}/pin`, { body: { isPinned: true } });
await call('PATCH', `/announcements/${ctx.ann}/pin`, { as: 'joiner', body: { isPinned: false }, expect: 403 });
await call('POST', `/announcements/${ctx.ann}/read`, { as: 'joiner' });

// ── 8. organiser console + winners ──────────────────────────────────────────
console.log('\n[8] console + winners');
r = await call('GET', `/hackathons/${ctx.hack}/dashboard`);
results.push({
  ok: r.stats?.submissions >= 1 && r.stats?.judges === 1 && Array.isArray(r.recentSubmissions),
  label: 'dashboard returns populated stats + moderation queue',
  as: 'organiser', status: JSON.stringify(r.stats ?? r.message ?? null).slice(0, 90), want: 'populated',
});
await call('GET', `/hackathons/${ctx.hack}/dashboard`, { as: 'joiner', expect: 403 });
await call('PATCH', `/hackathons/${ctx.hack}/winners`, {
  body: { winners: [{ rank: 1, title: 'Winner', amount: '₹50,000', submissionId: ctx.sub, teamId: ctx.team }] },
});
await call('PATCH', `/hackathons/${ctx.hack}/winners`, { body: { winners: 'not-an-array' }, expect: 400 });
await call('PATCH', `/hackathons/${ctx.hack}/status`, { body: { status: 'completed' } });

// ── 9. teardown routes ──────────────────────────────────────────────────────
console.log('\n[9] teardown');
await call('DELETE', `/hackathons/${ctx.hack}/judges/${judge._id}`);
await call('POST', `/teams/${ctx.team}/leave`, { as: 'joiner' });
await call('DELETE', `/submissions/${ctx.sub}`, { as: 'leader', expect: [200, 400] });
await call('DELETE', `/teams/${ctx.team}`, { as: 'leader' });
await call('DELETE', `/hackathons/${ctx.hack}`);
await call('GET', `/hackathons/${ctx.hack}`, { expect: 404 });

// ── report ──────────────────────────────────────────────────────────────────
const failed = results.filter((x) => !x.ok);
console.log(`\n${'─'.repeat(72)}`);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('\nFAILURES:');
  for (const f of failed) {
    console.log(`  ${f.label} [${f.as}] -> ${f.status} (wanted ${f.want})${f.message ? ` :: ${f.message}` : ''}`);
  }
}

server.close();
await mongoose.disconnect();
await mongod.stop();
process.exit(failed.length ? 1 : 0);
