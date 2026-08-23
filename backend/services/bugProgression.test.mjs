import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.BUG_LADDER_REQUIRED = '3';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('bug_ladder'));

const BugProblem = (await import('../models/coding/bugProblem.model.js')).default;
const CodingSubmission = (await import('../models/coding/codingSubmission.model.js')).default;
const { solvedCounts, ladderFor, canAttempt, domainOverview, REQUIRED } =
  await import('./bugProgression.service.js');

assert.equal(REQUIRED, 3);

const user = new mongoose.Types.ObjectId();
const other = new mongoose.Types.ObjectId();

const mk = (domain, difficulty, n) =>
  BugProblem.create(Array.from({ length: n }, (_, i) => ({
    title: `${domain}-${difficulty}-${i}`,
    description: 'd', buggyCode: 'x', language: domain, domain, difficulty,
    testCases: [{ input: '1', expectedOutput: '1' }],
  })));

const pyEasy = await mk('python', 'Easy', 4);
const pyMed = await mk('python', 'Medium', 2);
const pyHard = await mk('python', 'Hard', 1);
await mk('cpp', 'Easy', 3);

const solve = (u, problem, status = 'Accepted') =>
  CodingSubmission.create({ user: u, problem: problem._id, code: 'x', language: 'python', languageId: 71, status });

// --- nothing solved: only Easy is open -------------------------------------
{
  const ladder = ladderFor({});
  assert.deepEqual(ladder.map((l) => l.unlocked), [true, false, false]);
  assert.equal(ladder[1].needs, 3);

  const gate = await canAttempt(user, pyHard[0]);
  assert.equal(gate.allowed, false);
  assert.match(gate.message, /3 more Medium python/);
}

// --- a rejected submission is not a solve -----------------------------------
await solve(user, pyEasy[0], 'Wrong Answer');
assert.deepEqual(await solvedCounts(user), {});

// --- the same problem solved twice counts once ------------------------------
await solve(user, pyEasy[0]);
await solve(user, pyEasy[0]);
assert.deepEqual((await solvedCounts(user)).python, { Easy: 1 });
assert.equal((await canAttempt(user, pyMed[0])).allowed, false);

// --- clearing the level opens the next one ----------------------------------
await solve(user, pyEasy[1]);
await solve(user, pyEasy[2]);
assert.equal((await canAttempt(user, pyMed[0])).allowed, true);
// Medium being open does not open Hard.
assert.equal((await canAttempt(user, pyHard[0])).allowed, false);

// --- progress in one track does not unlock another --------------------------
{
  const cppMedium = (await mk('cpp', 'Medium', 1))[0];
  assert.equal((await canAttempt(user, cppMedium)).allowed, false);
}

// --- one user's progress is their own ---------------------------------------
assert.deepEqual(await solvedCounts(other), {});
assert.equal((await canAttempt(other, pyMed[0])).allowed, false);

// --- overview reports availability and progress per track -------------------
{
  const overview = await domainOverview(user);
  const python = overview.find((d) => d.domain === 'python');
  assert.equal(python.available.Easy, 4);
  assert.equal(python.solved.Easy, 3);
  assert.equal(python.ladder.find((l) => l.level === 'Medium').unlocked, true);
  assert.equal(python.ladder.find((l) => l.level === 'Hard').unlocked, false);

  const cpp = overview.find((d) => d.domain === 'cpp');
  assert.equal(cpp.ladder.find((l) => l.level === 'Medium').unlocked, false);
}

console.log('bugProgression: ok');
await mongoose.disconnect();
await mem.stop();
