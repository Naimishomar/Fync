import assert from 'node:assert/strict';
import fs from 'node:fs';

// Import rankFeed alone; the module also pulls redis/gemini at import time.
const src = fs.readFileSync(new URL('./feedEngine.js', import.meta.url), 'utf8');
const body = src
  .replace(/^import .*$/gm, '')
  .replace(/export async function [\s\S]*?\n}\n/g, '');   // drop the redis-backed halves
const mod = await import('data:text/javascript,' + encodeURIComponent(body));
const { rankFeed } = mod;

const now = Date.now();
const candidates = Array.from({ length: 150 }, (_, i) => ({
  _id: `post${String(i).padStart(3, '0')}`,
  description: i % 3 === 0 ? 'coding startup' : 'campus life',
  likes: (i * 7) % 40,
  comments: [],
  createdAt: new Date(now - i * 3600_000).toISOString(),
  user: { _id: `author${i % 12}` },
}));
const profile = { keywords: ['coding', 'startup'] };
const seed = 'user42:7';

// Walk the feed the way the client does and collect every id served.
const served = [];
for (let page = 1; page <= 15; page++) {
  const r = rankFeed({ candidates, seenIds: [], interestProfile: profile, page, limit: 10, seed });
  served.push(...r.items.map(p => p._id));
}

// THE BUG: the old Math.random() shuffle re-ran per request, so paging returned
// duplicates and dropped posts. Every post must appear exactly once.
assert.equal(served.length, 150, 'wrong total served');
assert.equal(new Set(served).size, 150, `duplicates served: ${served.length - new Set(served).size}`);

// Same seed, same request => same page. (Repeatability under refresh.)
const a = rankFeed({ candidates, seenIds: [], interestProfile: profile, page: 3, limit: 10, seed });
const b = rankFeed({ candidates, seenIds: [], interestProfile: profile, page: 3, limit: 10, seed });
assert.deepEqual(a.items.map(p => p._id), b.items.map(p => p._id), 'page not stable');

// Different users still get different feeds.
const other = rankFeed({ candidates, seenIds: [], interestProfile: profile, page: 1, limit: 10, seed: 'user99:7' });
assert.notDeepEqual(a.items.map(p => p._id), other.items.map(p => p._id), 'feed identical across users');

// A new pool generation reshuffles.
const bumped = rankFeed({ candidates, seenIds: [], interestProfile: profile, page: 1, limit: 10, seed: 'user42:8' });
const orig1 = rankFeed({ candidates, seenIds: [], interestProfile: profile, page: 1, limit: 10, seed });
assert.notDeepEqual(bumped.items.map(p => p._id), orig1.items.map(p => p._id), 'pool version ignored');

// seenIds are excluded, and hasMore is honest at the end.
const skipFirst = candidates.slice(0, 140).map(p => p._id);
const tail = rankFeed({ candidates, seenIds: skipFirst, interestProfile: profile, page: 1, limit: 10, seed });
assert.equal(tail.items.length, 10);
assert.equal(tail.hasMore, false);
assert.ok(tail.items.every(p => !skipFirst.includes(p._id)), 'served a seen post');

// Everything seen => recycled, not empty.
const all = rankFeed({ candidates, seenIds: candidates.map(p => p._id), interestProfile: profile, page: 1, limit: 10, seed });
assert.equal(all.mode, 'recycled');
assert.equal(all.items.length, 10);

console.log('feed ranking self-check passed (150 posts, 15 pages, 0 duplicates)');
