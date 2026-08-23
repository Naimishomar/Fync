import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.CONTEST_TZ = 'Asia/Kolkata';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('contest_scoring'));

const Contest = (await import('../models/coding/contest.model.js')).default;
const Problem = (await import('../models/coding/problem.model.js')).default;
const CodingSubmission = (await import('../models/coding/codingSubmission.model.js')).default;
const CodingTeam = (await import('../models/coding/codingTeam.model.js')).default;
const { default: ContestManager } = await import('./contestManager.js');
const { nextContestStart, weekKey, pickWeeklyProblems } = await import('../utils/weeklyContest.js');
const Team = await import('../controllers/coding/team.controller.js');

const inZone = (d) => d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hourCycle: 'h23' });

// --- weekly schedule: Sunday 09:00-12:00 India time ------------------------
{
  // A Wednesday points at the coming Sunday.
  const s = nextContestStart(new Date('2026-08-19T12:00:00Z'));
  assert.match(inZone(s), /8\/23\/2026, 09:00/);
  // Once the window has opened, the next one is a week out — not today's again.
  const after = nextContestStart(new Date('2026-08-23T04:00:00Z'));
  assert.match(inZone(after), /8\/30\/2026, 09:00/);
  // Distinct weeks get distinct keys, or the scheduler would think next week's
  // contest already exists.
  assert.notEqual(weekKey(s), weekKey(after));
  assert.equal(weekKey(s), weekKey(new Date(s.getTime() + 2 * 3600 * 1000)));
}

// --- problem eligibility ---------------------------------------------------
const hidden = (n) => Array.from({ length: n }, (_, i) => ({ input: `${i}`, expectedOutput: `${i}`, isHidden: true }));
const visible = [{ input: '1', expectedOutput: '1', isHidden: false }];

const easy = await Problem.create({ title: 'E', description: 'd', difficulty: 'Easy', points: 100, testCases: [...visible, ...hidden(2)] });
const med = await Problem.create({ title: 'M', description: 'd', difficulty: 'Medium', points: 200, testCases: [...visible, ...hidden(2)] });
await Problem.create({ title: 'H-samples-only', description: 'd', difficulty: 'Hard', points: 300, testCases: visible });

{
  const picked = await pickWeeklyProblems();
  // Easy and Medium qualify; the Hard one has no hidden cases, so a contest on
  // it would be won by pasting the visible expected output.
  assert.equal(picked.length, 2);
}

// --- scoring ---------------------------------------------------------------
const alice = new mongoose.Types.ObjectId();
const bob = new mongoose.Types.ObjectId();
const start = new Date(Date.now() - 30 * 60 * 1000); // contest began 30 min ago

const contest = await Contest.create({
  title: 'T', problems: [easy._id, med._id],
  startTime: start, endTime: new Date(Date.now() + 3600 * 1000),
  penaltyPerWrongSubmission: 5,
  participants: [{ user: alice, enteredAt: start }, { user: bob, enteredAt: start }],
});

const record = (user, problem, accepted = true) =>
  ContestManager.recordSubmission({ contestId: contest._id, userId: user, problemId: problem._id, accepted });

// A rejected submission awards nothing.
assert.equal(await record(alice, easy, false), null);

let award = await record(alice, easy);
assert.equal(award.points, 100);
// ~30 minutes elapsed, no prior wrong attempts recorded for Alice.
assert.ok(Math.abs(award.penalty - 30) <= 1, `penalty ${award.penalty}`);

// Re-solving the same problem must not pay twice.
assert.equal(await record(alice, easy), null);

// Bob logs two wrong attempts before getting it, so he carries 2 x 5 minutes.
await CodingSubmission.create([
  { user: bob, problem: easy._id, contest: contest._id, code: 'x', language: 'python', languageId: 71, status: 'Wrong Answer' },
  { user: bob, problem: easy._id, contest: contest._id, code: 'x', language: 'python', languageId: 71, status: 'Wrong Answer' },
]);
award = await record(bob, easy);
assert.ok(Math.abs(award.penalty - 40) <= 1, `bob penalty ${award.penalty}`);

// Alice takes the second problem too: more points beats a lower penalty.
await record(alice, med);

const board = await ContestManager.leaderboard(contest._id);
assert.deepEqual(board.rows.map((r) => [String(r.userId), r.score, r.solvedCount]),
  [[String(alice), 300, 2], [String(bob), 100, 1]]);
assert.equal(board.rows[0].rank, 1);

// Same score, lower penalty wins.
{
  const c2 = await Contest.create({
    title: 'tie', problems: [easy._id], startTime: start, endTime: new Date(Date.now() + 3600e3),
    participants: [{ user: alice, enteredAt: start, score: 100, penalty: 55 },
                   { user: bob, enteredAt: start, score: 100, penalty: 12 }],
  });
  const b2 = await ContestManager.leaderboard(c2._id);
  assert.equal(String(b2.rows[0].userId), String(bob));
}

// --- team seats ------------------------------------------------------------
const res = () => { const o = {}; return { o, r: { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } } }; };
const call = async (fn, user, body) => { const m = res(); await fn({ user: { id: user }, body }, m.r); return m.o; };

const leader = new mongoose.Types.ObjectId().toString();
const partner = new mongoose.Types.ObjectId().toString();
const third = new mongoose.Types.ObjectId().toString();

let out = await call(Team.createTeam, leader, { name: 'Duo' });
assert.equal(out.code, 201);
const code = out.body.team.inviteCode;
assert.equal(code.length, 6);

// Not ready to queue with one seat filled.
out = await call(Team.getMyTeam, leader, {});
assert.equal(out.body.ready, false);

out = await call(Team.joinTeam, partner, { code });
assert.equal(out.body.success, true);

out = await call(Team.getMyTeam, leader, {});
assert.equal(out.body.ready, true);

// The third person is refused — a 2v2 with a three-person side is not a 2v2.
out = await call(Team.joinTeam, third, { code });
assert.equal(out.code, 409);
assert.equal((await CodingTeam.findOne({ inviteCode: code })).members.length, 1);

// Nobody sits on two teams at once, which would let one person queue both sides.
out = await call(Team.createTeam, partner, { name: 'Other' });
assert.equal(out.code, 409);

console.log('contestScoring: ok');
await mongoose.disconnect();
await mem.stop();
