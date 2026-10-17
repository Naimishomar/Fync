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
