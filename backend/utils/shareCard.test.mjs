import assert from 'node:assert/strict';
import sharp from 'sharp';
import { esc, truncate, wrap, formatCount, renderPostCard, renderProfileCard } from './shareCard.js';

assert.equal(esc(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;');
assert.equal(esc('hi 🎉\u0007 there'), 'hi  there', 'emoji and XML-illegal controls stripped');
assert.equal(esc(null), '');

assert.equal(truncate('hello world', 20), 'hello world');
assert.equal(truncate('hello   \n world', 20), 'hello world', 'whitespace collapsed');
assert.equal(truncate('abcdefghij', 5), 'abcd…');

assert.deepEqual(wrap('the quick brown fox jumps', 10, 3), ['the quick', 'brown fox', 'jumps']);
const cut = wrap('one two three four five six seven eight', 9, 2);
assert.equal(cut.length, 2);
assert.ok(cut[1].endsWith('…') && cut[1].length <= 9, 'last line ellipsised within width');
assert.deepEqual(wrap('abcdefghijklmnop', 5, 5), ['abcde', 'fghij', 'klmno', 'p'], 'long words hard-broken');
assert.deepEqual(wrap('', 10, 3), []);

assert.equal(formatCount(999), '999');
assert.equal(formatCount(1234), '1.2K');
assert.equal(formatCount(12345), '12K');
assert.equal(formatCount(3_400_000), '3.4M');
assert.equal(formatCount(undefined), '0');

// Hostile text renders (escaped) and missing images fall back to placeholders.
const url = 'https://example.com/view?postId=0123456789abcdef01234567';
const post = await sharp(await renderPostCard({ name: '<b>&', username: 'x"y', caption: ']]><svg>', likes: 1, comments: 2 }, url)).metadata();
assert.deepEqual([post.format, post.width, post.height], ['png', 1080, 1350]);
const prof = await sharp(await renderProfileCard({ name: 'A', username: 'a', photo: Buffer.from('junk') }, url, 'jpg')).metadata();
assert.deepEqual([prof.format, prof.width, prof.height], ['jpeg', 1080, 1080]);
console.log('shareCard tests passed');
