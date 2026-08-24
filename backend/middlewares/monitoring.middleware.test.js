import assert from 'node:assert/strict';
import {
  normalizeRoute,
  recordLatency,
  percentile,
  latencyReport,
  resetLatency,
} from './monitoring.middleware.js';

// Ids collapse, so one route does not become ten thousand buckets.
assert.equal(normalizeRoute('GET', '/post/507f1f77bcf86cd799439011'), 'GET /post/:id');
assert.equal(normalizeRoute('GET', '/post/feed?page=2'), 'GET /post/feed');
assert.equal(normalizeRoute('POST', '/quiz/42/submit'), 'POST /quiz/:id/submit');
// Real path segments must survive — `feed` is not an id.
assert.equal(normalizeRoute('GET', '/user/profile'), 'GET /user/profile');

// Nearest-rank: p50 of 1..10 is the 5th value.
assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 100), 10);
assert.equal(percentile([7], 99), 7);

resetLatency();
for (const ms of [1, 1, 2, 2, 2, 3, 50]) recordLatency('GET', '/post/feed', ms);
for (const ms of [1, 1, 1, 1]) recordLatency('GET', '/ads', ms);

const report = latencyReport({ budgetMs: 3 });
const feed = report.slowest.find((r) => r.route === 'GET /post/feed');
const ads = report.slowest.find((r) => r.route === 'GET /ads');

assert.equal(feed.count, 7);
assert.equal(feed.p50, 2);
assert.equal(feed.max, 50);
assert.equal(feed.overBudget, false, 'p50 of 2ms is inside a 3ms budget');
assert.equal(ads.p99, 1);
// Slowest first, so the report opens on what to fix.
assert.equal(report.slowest[0].route, 'GET /post/feed');
assert.equal(report.overBudget, 0);

// A route whose median blows the budget must be flagged.
resetLatency();
for (const ms of [8, 9, 10]) recordLatency('GET', '/slow', ms);
assert.equal(latencyReport({ budgetMs: 3 }).overBudget, 1);

resetLatency();
console.log('monitoring.middleware tests passed ✅');
