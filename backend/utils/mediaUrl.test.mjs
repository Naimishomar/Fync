import assert from 'node:assert/strict';
import { makeMediaRewriter } from './mediaUrl.js';

const R2 = 'https://pub-abc.r2.dev';
const rw = makeMediaRewriter(`${R2}/`, 'https://api.example.com/media/');

const body = JSON.stringify({
  img: `${R2}/posts/a1.webp`,
  sm: `${R2}/posts/a1_sm.WEBP?v=2`,
  video: `${R2}/shorts/v.mp4`,
  other: 'https://example.com/x.png',
});
const out = JSON.parse(rw(body));
assert.equal(out.img, 'https://api.example.com/media/posts/a1.webp');
assert.equal(out.sm, 'https://api.example.com/media/posts/a1_sm.WEBP?v=2');
assert.equal(out.video, `${R2}/shorts/v.mp4`, 'videos stay on r2');
assert.equal(out.other, 'https://example.com/x.png');
assert.equal(makeMediaRewriter(R2, ''), null, 'off without MEDIA_PUBLIC_URL');
console.log('mediaUrl tests passed');

// Normal requests: stringified once and sent as the rewritten string, with the
// JSON content type and the route's status kept. Batch sub-requests: untouched
// (object path; the outer /batch response does the rewrite).
{
  process.env.R2_PUBLIC_URL = R2;
  process.env.MEDIA_PUBLIC_URL = 'https://api.example.com/media';
  const { mediaUrlMiddleware } = await import('./mediaUrl.js?mw');
  const mw = mediaUrlMiddleware();
  const mkRes = () => {
    const r = { headers: {}, statusCode: 200, sent: undefined, jsonGot: undefined };
    r.status = (c) => { r.statusCode = c; return r; };
    r.get = (k) => r.headers[k.toLowerCase()];
    r.type = (t) => { r.headers['content-type'] = t; return r; };
    r.send = (b) => { r.sent = b; return r; };
    r.json = (b) => { r.jsonGot = b; return r; };
    return r;
  };
  const payload = { success: true, posts: [{ image: [`${R2}/posts/p.webp`] }] };

  const res = mkRes();
  mw({}, res, () => {});
  res.status(201).json(payload);
  assert.equal(res.jsonGot, undefined, 'normal path must not re-enter res.json');
  assert.equal(typeof res.sent, 'string');
  assert.equal(res.headers['content-type'], 'json');
  assert.equal(res.statusCode, 201);
  const sent = JSON.parse(res.sent);
  assert.equal(sent.success, true);
  assert.equal(sent.posts[0].image[0], 'https://api.example.com/media/posts/p.webp');

  const sub = mkRes();
  mw({ isBatchSub: true }, sub, () => {});
  sub.json(payload);
  assert.equal(sub.sent, undefined, 'batch sub-request must never get a string');
  assert.equal(sub.jsonGot, payload, 'batch sub-request keeps the object');
  console.log('mediaUrl middleware test passed');
}
