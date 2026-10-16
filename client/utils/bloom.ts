/**
 * Bloom filter for the feed's "already seen" check — port of
 * backend/utils/bloom.js. The hash and bit layout must match it exactly
 * (backend/utils/bloom.test.mjs runs this file and compares bits).
 *
 * Instead of POSTing up to 200 raw ids (~5.4 KB) with every feed request, the
 * app sends a fixed 2 KB bitset that remembers ~1,600 ids at ~1% false
 * positives. A false positive hides one unseen post; it never repeats one.
 */

export const BLOOM_BITS = 16384; // 2 KB
export const BLOOM_K = 7;

const fnv1a = (s: string, seed: number) => {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

export const bloomIndexes = (id: string, m = BLOOM_BITS, k = BLOOM_K) => {
  const s = String(id);
  const h1 = fnv1a(s, 0x811c9dc5);
  const h2 = fnv1a(s, 0x5bd1e995) | 1;
  const out = new Array<number>(k);
  for (let i = 0; i < k; i++) out[i] = ((h1 + Math.imul(i, h2)) >>> 0) % m;
  return out;
};

export const emptyBits = (m = BLOOM_BITS) => new Uint8Array(m / 8);

export const addToBits = (bits: Uint8Array, id: string, k = BLOOM_K) => {
  for (const i of bloomIndexes(id, bits.length * 8, k)) bits[i >> 3] |= 1 << (i & 7);
};

// Plain base64 — no dependency on atob/btoa being present on every engine.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const toBase64 = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
      + (b === undefined ? '=' : B64[(n >> 6) & 63])
      + (c === undefined ? '=' : B64[n & 63]);
  }
  return out;
};

export const fromBase64 = (s: string, size: number) => {
  const bytes = new Uint8Array(size);
  let j = 0;
  for (let i = 0; i < s.length && j < size; i += 4) {
    const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12)
      | ((B64.indexOf(s[i + 2]) & 63) << 6) | (B64.indexOf(s[i + 3]) & 63);
    bytes[j++] = (n >> 16) & 255;
    if (j < size && s[i + 2] !== '=') bytes[j++] = (n >> 8) & 255;
    if (j < size && s[i + 3] !== '=') bytes[j++] = n & 255;
  }
  return bytes;
};
