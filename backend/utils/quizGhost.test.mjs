import assert from 'node:assert/strict';
import { recordGhost, pickGhost } from './quizGhost.js';

// Minimal in-memory stand-in for the node-redis list calls used.
const lists = new Map();
const redis = {
  lPush: async (k, v) => { lists.set(k, [v, ...(lists.get(k) || [])]); },
  lTrim: async (k, a, b) => { lists.set(k, (lists.get(k) || []).slice(a, b + 1)); },
  expire: async () => {},
  lRange: async (k) => lists.get(k) || [],
};
const q = [{ question: 'q', options: ['a', 'b', 'c', 'd'], correctAnswer: 0 }];

assert.equal(await pickGhost(redis, 'dsa', 'u1'), null, 'empty: no ghost');
await recordGhost(redis, 'dsa', { userId: 'u1', name: 'A', questions: q, answers: [0], score: 1 });
assert.equal(await pickGhost(redis, 'dsa', 'u1'), null, 'never your own attempt');
assert.equal(await pickGhost(redis, 'web', 'u2'), null, 'domains are separate');
assert.equal((await pickGhost(redis, 'dsa', 'u2')).score, 1);
await recordGhost(redis, 'dsa', { userId: 'u3', questions: [], answers: [], score: 0 });
assert.equal((await redis.lRange('ghost:quiz:dsa')).length, 1, 'no questions: not recorded');
for (let i = 0; i < 60; i++) await recordGhost(redis, 'dsa', { userId: `x${i}`, questions: q, answers: [1], score: 0 });
assert.equal((await redis.lRange('ghost:quiz:dsa')).length, 50, 'capped');
console.log('quiz ghost tests passed');
process.exit(0);
