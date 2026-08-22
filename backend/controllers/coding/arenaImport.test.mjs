import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('arena_import'));
const Problem = (await import('../../models/coding/problem.model.js')).default;
const { default: Ctl } = await import('./arenaAdmin.controller.js');

const mk = () => { const o = { code: 0, body: null };
  return { o, res: { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } } }; };
const call = async (body) => { const m = mk(); await Ctl.importProblems({ body }, m.res); return m.o; };

const good = {
  title: 'Sum', description: 'Add two numbers', difficulty: 'Easy',
  testCases: [{ input: '2 3', expectedOutput: '5' }, { input: '1 1', expectedOutput: '2', isHidden: true }],
};

let r = await call([good]);
assert.equal(r.code, 201);
assert.equal(r.body.created[0].cases, 2);

// One bad entry must not abort the batch — pasting thirty problems with one
// typo should import twenty-nine.
r = await call([good, { title: 'Empty', description: 'x', testCases: [] }, { ...good, title: 'Third' }]);
assert.equal(r.body.created.length, 2);
assert.equal(r.body.errors.length, 1);
assert.equal(r.body.errors[0].index, 1, 'the failing entry is reported by position');

// "0" is real expected output, not a missing field.
r = await call([{ ...good, title: 'Zero', testCases: [{ input: '0 0', expectedOutput: '0' }] }]);
assert.equal(r.body.created.length, 1);

// A problem with no visible case leaves the student nothing to check against.
r = await call([{ ...good, title: 'Hidden', testCases: [{ input: 'a', expectedOutput: 'b', isHidden: true }] }]);
assert.equal(r.body.created.length, 0);

// Difficulty is constrained, since the UI filters on it.
r = await call([{ ...good, title: 'Bad', difficulty: 'Impossible' }]);
assert.equal(r.body.created.length, 0);

// A single object is accepted, not only an array.
r = await call({ ...good, title: 'Single object' });
assert.equal(r.body.created.length, 1);

// Batch cap.
r = await call(Array.from({ length: 101 }, (_, i) => ({ ...good, title: `p${i}` })));
assert.equal(r.code, 400);

// Hidden flags survive the import — the runner needs them to filter results.
const stored = await Problem.findOne({ title: 'Sum' }).lean();
assert.equal(stored.testCases[1].isHidden, true);

console.log('arena import: all assertions passed');
await mongoose.disconnect(); await mem.stop();
process.exit(0);
