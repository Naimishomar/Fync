import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bloomIndexes, parseBloom, seenPredicate } from './bloom.js';

const oid = (n) => n.toString(16).padStart(24, '0');
const M = 16384;
const K = 7;

const build = (ids, add) => {
  const bits = new Uint8Array(M / 8);
  for (const id of ids) add(bits, id);
  return bits;
};
const serverAdd = (bits, id) => {
  for (const i of bloomIndexes(id, M, K)) bits[i >> 3] |= 1 << (i & 7);
};

const seen = Array.from({ length: 1600 }, (_, i) => oid(0x5f0000 + i * 7919));
const bits = build(seen, serverAdd);
const filter = parseBloom({ m: M, k: K, b: Buffer.from(bits).toString('base64') });

// No false negatives: a seen post is never shown again.
assert.ok(seen.every(filter.has), 'every added id must test positive');

// ~1% false positives at the client's full capacity (1,600 ids).
const probes = Array.from({ length: 20000 }, (_, i) => oid(0xa00000 + i * 104729));
const fp = probes.filter(filter.has).length / probes.length;
assert.ok(fp < 0.02, `false-positive rate too high: ${fp}`);

// Malformed input is ignored rather than trusted.
assert.equal(parseBloom({ m: M, k: K, b: 'AAAA' }), null, 'wrong-size bitset');
assert.equal(parseBloom({ m: 999, k: K, b: '' }), null, 'm not a byte multiple / too small');
assert.equal(parseBloom({ m: M, k: 0, b: Buffer.from(bits).toString('base64') }), null, 'k out of range');
assert.equal(parseBloom({ m: 1 << 20, k: K, b: '' }), null, 'oversized m');
assert.equal(parseBloom(null), null);

// Old app builds still send seenIds.
const legacy = seenPredicate({ seenIds: [oid(1)] });
assert.ok(legacy(oid(1)) && !legacy(oid(2)), 'legacy seenIds still filter');
assert.ok(seenPredicate({})(oid(1)) === false, 'no filter means nothing is seen');

// The app's port must produce the exact same bits and base64.
const clientPath = fileURLToPath(new URL('../../client/utils/bloom.ts', import.meta.url));
if (existsSync(clientPath)) {
  const client = await import(clientPath);
  assert.equal(client.BLOOM_BITS, M);
  assert.equal(client.BLOOM_K, K);
  for (const id of seen.slice(0, 200)) {
    assert.deepEqual(client.bloomIndexes(id), bloomIndexes(id, M, K), `index mismatch for ${id}`);
  }
  const clientBits = build(seen, (b, id) => client.addToBits(b, id));
  assert.equal(client.toBase64(clientBits), Buffer.from(bits).toString('base64'), 'base64 mismatch');
  assert.deepEqual(client.fromBase64(client.toBase64(clientBits), M / 8), clientBits, 'base64 round trip');
  for (const len of [1, 2, 3, 4, 5]) {
    const b = Uint8Array.from({ length: len }, (_, i) => (i * 97 + 13) & 255);
    assert.equal(client.toBase64(b), Buffer.from(b).toString('base64'), `base64 len ${len}`);
  }
  console.log('bloom: client/server parity ok');
} else {
  console.log('bloom: client/utils/bloom.ts not present, parity check skipped');
}

console.log(`bloom tests passed (fp=${(fp * 100).toFixed(2)}%)`);
