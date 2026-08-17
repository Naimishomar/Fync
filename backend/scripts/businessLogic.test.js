// Business-logic tests: do the handlers do the RIGHT thing, not merely respond.
//
// The smoke run proves nothing crashes. This asserts the invariants that make
// the product correct — counters that match reality, actions that are safe to
// repeat, permissions that hold, cascades that complete.
//
// Run: node scripts/businessLogic.test.js
import 'dotenv/config.js';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_logic'));

const { default: User } = await import('../models/user.model.js');
const { default: Post } = await import('../models/post.model.js');
const { default: Comment } = await import('../models/comment.model.js');
const { default: Notification } = await import('../models/notification.model.js');

const postCtl = await import('../controllers/post.controller.js');
const authCtl = await import('../controllers/auth.controller.js');

// ── harness ─────────────────────────────────────────────────────────────────
const call = (fn, { user, params = {}, body = {}, query = {} } = {}) =>
  new Promise((resolve) => {
    const res = new Writable({ write(_c, _e, cb) { cb(); } });
    res.statusCode = 200;
    let settled = false;
    const done = (payload) => {
      if (settled) return res;
      settled = true;
      resolve({ status: res.statusCode, body: payload });
      return res;
    };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = done; res.send = done;
    res.set = res.setHeader = res.header = () => res;
    res.cookie = res.clearCookie = () => res;
    const req = { user, params, body, query, headers: {}, cookies: {},
                  app: { get: () => ({ to: () => ({ emit() {} }), emit() {} }) } };
    Promise.resolve(fn(req, res, (e) => done({ nextError: e?.message }))).catch((e) =>
      done({ threw: e?.message })
    );
  });

const mkUser = async (n) => {
  const u = await User.create({
    name: `User ${n}`, username: `user${n}`, email: `u${n}@test.dev`,
    mobileNumber: `900000000${n}`, password: 'x', college: 'Test College',
    year: 2, major: 'CSE', gender: 'Other', dob: new Date('2004-01-01'),
    user_access: 'user',
  });
  return { doc: u, ctx: { id: String(u._id), _id: u._id, username: u.username, college: 'Test College' } };
};

const failures = [];
const check = async (name, fn) => {
  try { await fn(); console.log(`  ok    ${name}`); }
  catch (e) { failures.push({ name, message: e.message }); console.log(`  FAIL  ${name}`); }
};

// ═══ LIKES ══════════════════════════════════════════════════════════════════
console.log('\nPost likes');
{
  const alice = await mkUser(1);
  const bob = await mkUser(2);
  const post = await Post.create({
    description: 'hello', user: alice.doc._id, college: 'Test College', likes: 0,
  });
  const P = { id: String(post._id) };

  await check('a like increments the counter and records the user', async () => {
    await call(postCtl.likePost, { user: bob.ctx, params: P });
    const p = await Post.findById(post._id);
    assert.equal(p.likes, 1);
    assert.equal(p.liked_by.length, 1);
  });

  await check('liking twice unlikes — the toggle is symmetric', async () => {
    await call(postCtl.likePost, { user: bob.ctx, params: P });
    const p = await Post.findById(post._id);
    assert.equal(p.likes, 0);
    assert.equal(p.liked_by.length, 0);
  });

  await check('counter never disagrees with liked_by under concurrency', async () => {
    // Two taps landing together is ordinary on mobile: a double-tap, or a retry
    // after a flaky response. The read-then-$inc has no guard against it.
    await Post.findByIdAndUpdate(post._id, { likes: 0, liked_by: [] });
    await Promise.all([
      call(postCtl.likePost, { user: bob.ctx, params: P }),
      call(postCtl.likePost, { user: bob.ctx, params: P }),
    ]);
    const p = await Post.findById(post._id);
    assert.equal(p.likes, p.liked_by.length,
      `likes=${p.likes} but liked_by has ${p.liked_by.length} entries`);
  });

  await check('the counter never goes negative', async () => {
    await Post.findByIdAndUpdate(post._id, { likes: 0, liked_by: [bob.doc._id] });
    await call(postCtl.likePost, { user: bob.ctx, params: P });
    const p = await Post.findById(post._id);
    assert.ok(p.likes >= 0, `likes went to ${p.likes}`);
  });
}

// ═══ FOLLOW ═════════════════════════════════════════════════════════════════
console.log('\nFollow graph');
{
  const alice = await mkUser(3);
  const bob = await mkUser(4);

  await check('following is mutual-consistent (his followers, her following)', async () => {
    await call(authCtl.followUser, { user: alice.ctx, params: { id: String(bob.doc._id) } });
    const [a, b] = await Promise.all([User.findById(alice.doc._id), User.findById(bob.doc._id)]);
    assert.equal(b.followers.length, 1);
    assert.equal(a.following.length, 1);
  });

  await check('following twice does not duplicate the edge', async () => {
    await call(authCtl.followUser, { user: alice.ctx, params: { id: String(bob.doc._id) } });
    const b = await User.findById(bob.doc._id);
    assert.equal(b.followers.length, 1, `followers=${b.followers.length}`);
  });

  await check('following twice does not send a second notification', async () => {
    const n = await Notification.countDocuments({ recipient: bob.doc._id, type: 'follow' });
    assert.equal(n, 1, `${n} follow notifications for one relationship`);
  });

  await check('you cannot follow yourself', async () => {
    const r = await call(authCtl.followUser, { user: alice.ctx, params: { id: String(alice.doc._id) } });
    assert.equal(r.status, 400);
  });

  await check('unfollow reverses both sides', async () => {
    await call(authCtl.unfollowUser, { user: alice.ctx, params: { id: String(bob.doc._id) } });
    const [a, b] = await Promise.all([User.findById(alice.doc._id), User.findById(bob.doc._id)]);
    assert.equal(b.followers.length, 0);
    assert.equal(a.following.length, 0);
  });
}

// ═══ COMMENTS ═══════════════════════════════════════════════════════════════
console.log('\nComments');
{
  const alice = await mkUser(5);
  const mallory = await mkUser(6);
  const post = await Post.create({
    description: 'thread', user: alice.doc._id, college: 'Test College', likes: 0,
  });

  const mkComment = async (owner, parent = null) =>
    Comment.create({
      text: 'hi', commentor: owner.doc._id, post: post._id, postType: 'Post', parentComment: parent,
    });

  await check('a user cannot delete another user\'s comment', async () => {
    const c = await mkComment(alice);
    const r = await call(postCtl.deleteComment, { user: mallory.ctx, params: { id: String(c._id) } });
    assert.equal(r.status, 403, `expected 403, got ${r.status}`);
    assert.ok(await Comment.findById(c._id), 'comment was deleted by a non-owner');
  });

  await check('deleting a comment detaches it from the post', async () => {
    const c = await mkComment(alice);
    await Post.findByIdAndUpdate(post._id, { $push: { comments: c._id } });
    await call(postCtl.deleteComment, { user: alice.ctx, params: { id: String(c._id) } });
    const p = await Post.findById(post._id);
    assert.ok(!p.comments.some((x) => String(x) === String(c._id)),
      'post still references the deleted comment');
  });

  await check('deleting a parent comment does not orphan its replies', async () => {
    const parent = await mkComment(alice);
    const reply = await mkComment(mallory, parent._id);
    await call(postCtl.deleteComment, { user: alice.ctx, params: { id: String(parent._id) } });
    const stillThere = await Comment.findById(reply._id);
    assert.equal(stillThere, null,
      'reply survived its parent — it is unreachable but still counted');
  });
}

// ═══ EVERY OTHER LIKE TOGGLE ════════════════════════════════════════════════
// The same read-then-$inc pattern existed in six sibling handlers. Each is
// exercised the same way: repeat taps, then concurrent taps.
console.log('\nOther like toggles');
{
  const { default: Shorts } = await import('../models/shorts.model.js');
  const { default: FundingProject } = await import('../models/funding.model.js');
  const { default: Notice } = await import('../models/notice.model.js');
  const { default: Confession } = await import('../models/newFeatures/confession.model.js');
  const { default: FyncMedia } = await import('../models/fync media/fyncMedia.model.js');

  const shortsCtl = await import('../controllers/shorts.controller.js');
  const fundCtl = await import('../controllers/funding.controller.js');
  const noticeCtl = await import('../controllers/notice.controller.js');
  const confCtl = await import('../controllers/newFeatures/confession.controller.js');
  const mediaCtl = await import('../controllers/fync media/fyncMedia.controller.js');

  const owner = await mkUser(7);
  const tapper = await mkUser(8);

  const cases = [
    ['shorts',     Shorts,         shortsCtl.likeAndUnlikeShort,      { video: 'v.mp4', title: 'S', likes: 0, views: 0, user: owner.doc._id, college: 'Test College' }, 'likes', 'liked_by'],
    ['funding',    FundingProject, fundCtl.likeAndUnlikeProject,      { title: 'P', description: 'd', user: owner.doc._id, college: 'Test College' }, 'likes', 'liked_by'],
    ['notice',     Notice,         noticeCtl.likeNotice,              { title: 'N', description: 'd', user: owner.doc._id, college: 'Test College' }, 'likes', 'liked_by'],
    ['confession', Confession,     confCtl.likeConfession,            { content: 'c', user: owner.doc._id, college: 'Test College' }, 'likes', 'liked_by'],
    ['media like', FyncMedia,      mediaCtl.likeAndUnlikeMedia,       { title: 'Media Item One', description: 'A description long enough to satisfy minlength', thumbnail: 't.jpg', video_link: 'm.mp4', date: new Date(), user: owner.doc._id, college: 'Test College' }, 'likes', 'liked_by'],
    ['media dislike', FyncMedia,   mediaCtl.dislikeAndUndislikeMedia, { title: 'Media Item Two', description: 'A description long enough to satisfy minlength', thumbnail: 't.jpg', video_link: 'm.mp4', date: new Date(), user: owner.doc._id, college: 'Test College' }, 'dislikes', 'disliked_by'],
  ];

  for (const [label, Model, handler, seed, countField, arrayField] of cases) {
    let doc;
    try {
      doc = await Model.create(seed);
    } catch (e) {
      console.log(`  skip  ${label} — fixture rejected: ${e.message.split(',')[0]}`);
      continue;
    }
    const params = { id: String(doc._id) };

    await check(`${label}: counter matches the array after repeat taps`, async () => {
      await call(handler, { user: tapper.ctx, params });
      await call(handler, { user: tapper.ctx, params });
      await call(handler, { user: tapper.ctx, params });
      const d = await Model.findById(doc._id);
      assert.equal(d[countField], (d[arrayField] || []).length,
        `${countField}=${d[countField]} vs ${arrayField}=${(d[arrayField] || []).length}`);
    });

    await check(`${label}: no duplicate entries and no negative count`, async () => {
      await Promise.all([
        call(handler, { user: tapper.ctx, params }),
        call(handler, { user: tapper.ctx, params }),
      ]);
      const d = await Model.findById(doc._id);
      const ids = (d[arrayField] || []).map(String);
      assert.equal(new Set(ids).size, ids.length, `duplicate ids in ${arrayField}`);
      assert.ok(d[countField] >= 0, `${countField} went to ${d[countField]}`);
      assert.equal(d[countField], ids.length, `${countField} drifted from ${arrayField}`);
    });
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log('');
if (failures.length) {
  console.log(`${failures.length} invariant(s) violated:\n`);
  for (const f of failures) console.log(`  ${f.name}\n      ${f.message}\n`);
} else {
  console.log('All business-logic invariants hold ✅');
}

await mongoose.disconnect();
await mongod.stop();
process.exit(failures.length ? 1 : 0);
