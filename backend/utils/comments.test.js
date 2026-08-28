import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCommentMeta } from './comments.js';

test('mergeCommentMeta attaches the count and the newest comment', () => {
  const posts = [{ _id: 'p1' }, { _id: 'p2' }];
  const counts = [{ _id: 'p1', count: 3 }];
  const topComments = [{ _id: 'c9', post: 'p1', text: 'newest' }];

  const [first, second] = mergeCommentMeta(posts, counts, topComments);

  assert.equal(first.commentCount, 3);
  assert.deepEqual(first.comments.map((c) => c._id), ['c9']);
  // A post nobody has commented on reports zero, not the length of a stale array.
  assert.equal(second.commentCount, 0);
  assert.deepEqual(second.comments, []);
});

test('mergeCommentMeta matches ids across ObjectId and string forms', () => {
  const objectIdish = { toString: () => 'p1' };
  const [post] = mergeCommentMeta(
    [{ _id: objectIdish }],
    [{ _id: 'p1', count: 1 }],
    [{ _id: 'c1', post: objectIdish, text: 'hi' }],
  );

  assert.equal(post.commentCount, 1);
  assert.equal(post.comments[0].text, 'hi');
});
