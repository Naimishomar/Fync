import test from 'node:test';
import assert from 'node:assert/strict';
import { withTopComment } from './comments.js';

test('withTopComment keeps the newest comment and the full count', () => {
  const [post] = withTopComment([{
    _id: 'p1',
    comments: [
      { _id: 'c1', text: 'old', createdAt: '2026-01-01T00:00:00Z' },
      { _id: 'c3', text: 'newest', createdAt: '2026-03-01T00:00:00Z' },
      { _id: 'c2', text: 'middle', createdAt: '2026-02-01T00:00:00Z' },
    ],
  }]);

  assert.equal(post.commentCount, 3);
  assert.deepEqual(post.comments.map((c) => c._id), ['c3']);
});

test('withTopComment handles a post with no comments', () => {
  const [post] = withTopComment([{ _id: 'p2' }]);
  assert.equal(post.commentCount, 0);
  assert.deepEqual(post.comments, []);
});
