// Run: node utils/askRules.test.mjs
import assert from 'node:assert/strict';
import { checkMessage, cleanText, isAbusive, senderHash, recentHashes, isBlockedSender, cardSig, sigOk, expiresAt, USERNAME, DAY } from './askRules.js';

assert.equal(cleanText('  hi\u0000​ there \r\n\n\n\nok  '), 'hi there \n\nok', 'controls stripped, blank lines capped');
assert.deepEqual(checkMessage({ text: '  what is your fav song?  ' }), { text: 'what is your fav song?' });
assert.match(checkMessage({ text: '   ' }).error, /Write/);
assert.match(checkMessage({ text: 'a'.repeat(301) }).error, /300/);
assert.equal(checkMessage({ text: 'a'.repeat(300) }).text.length, 300);
assert.ok(checkMessage({ text: 'hello', honeypot: 'http://spam' }).error, 'honeypot filled -> rejected');

for (const bad of ['you are a b1tch', 'FUUUCK off', 'tu chutiya hai', 'bhosdike', 'mc', 'I will kill you', 'kys',
  'tujhe jaan se maar dunga', 'i know where you live', 'send nudes', 'madarchod']) {
  assert.ok(isAbusive(bad), `should block: ${bad}`);
  assert.match(checkMessage({ text: bad }).error, /kind/);
}
for (const ok of ['what is your crush name?', 'you killed it at the fest', 'time to skill up', 'chod do yaar, chill',
  'the class was so random', 'cocktail party?', 'bc of the exam', 'Dickens is my favourite author', 'skills']) {
  assert.equal(isAbusive(ok), false, `should allow: ${ok}`);
}

const t = Date.UTC(2026, 10, 8, 12);
assert.equal(senderHash('1.2.3.4', 's', t), senderHash('1.2.3.4', 's', t + 3600e3), 'same IP same day -> same hash');
assert.notEqual(senderHash('1.2.3.4', 's', t), senderHash('1.2.3.4', 's', t + DAY), 'salt rotates daily');
assert.notEqual(senderHash('1.2.3.4', 's', t), senderHash('1.2.3.5', 's', t));
assert.ok(!senderHash('1.2.3.4', 's', t).includes('1.2.3.4'));
const old = senderHash('9.9.9.9', 's', t - 6 * DAY); // message from 6 days ago, then blocked
const blocked = [{ h: old, exp: new Date(t + 7 * DAY) }];
assert.ok(isBlockedSender(blocked, recentHashes('9.9.9.9', 's', t + 6 * DAY), t + 6 * DAY), 'still blocked 12 days after the message day');
assert.equal(isBlockedSender(blocked, recentHashes('9.9.9.9', 's', t + 8 * DAY), t + 8 * DAY), false, 'block expired');
assert.equal(isBlockedSender(blocked, recentHashes('8.8.8.8', 's', t), t), false, 'other IP');

const id = '65f000000000000000000001';
assert.ok(sigOk(id, cardSig(id, 'x'), 'x'));
assert.equal(sigOk(id, cardSig(id, 'y'), 'x'), false);
assert.equal(sigOk('65f000000000000000000002', cardSig(id, 'x'), 'x'), false);
assert.equal(sigOk(id, undefined, 'x'), false);
assert.equal(expiresAt(new Date(t)).getTime() - t, 7 * DAY);

assert.ok(USERNAME.test('naimish.omar_1'));
assert.equal(USERNAME.test('a b'), false);
assert.equal(USERNAME.test('$where'), false);
console.log('askRules ok');
