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

// The middleware must hand res.json an object (batch stub responses keep whatever
// they are given), never a string via res.send.
{
  process.env.R2_PUBLIC_URL = R2;
  process.env.MEDIA_PUBLIC_URL = 'https://api.example.com/media';
  const { mediaUrlMiddleware } = await import('./mediaUrl.js?mw');
  let got;
  const res = { json(b) { got = b; return this; }, send() { throw new Error('send must not be used'); } };
  mediaUrlMiddleware()({}, res, () => {});
  res.json({ success: true, posts: [{ image: [`${R2}/posts/p.webp`] }] });
  assert.equal(typeof got, 'object');
  assert.equal(got.success, true);
  assert.equal(got.posts[0].image[0], 'https://api.example.com/media/posts/p.webp');
  console.log('mediaUrl middleware test passed');
}
