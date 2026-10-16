/**
 * Bloom filter for the feed's "already seen" check.
 *
 * The client used to POST every seen id with each feed request: 200 ObjectIds,
 * ~5.4 KB of JSON on a mobile uplink, and it forgot everything past 200. A Bloom
 * filter answers the same "seen this?" question in a fixed 2 KB bitset holding
 * ~1,600 ids at ~1% false positives. A false positive only hides one unseen
 * post; it can never resurface a seen one.
 *
 * client/utils/bloom.ts is a byte-for-byte port — keep the hash and layout in
 * step (bloom.test.mjs checks both produce identical bits).
 */

/** FNV-1a, 32-bit. ObjectIds are ASCII, so charCodeAt is the byte. */
const fnv1a = (s, seed) => {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

/** Kirsch–Mitzenmacher double hashing: k probes from two hashes. */
export const bloomIndexes = (id, m, k) => {
  const s = String(id);
  const h1 = fnv1a(s, 0x811c9dc5);
  const h2 = fnv1a(s, 0x5bd1e995) | 1; // odd, so probes don't collapse when m is a power of two
  const out = new Array(k);
  for (let i = 0; i < k; i++) out[i] = ((h1 + Math.imul(i, h2)) >>> 0) % m;
  return out;
};

// Bounds on what a client may send: at most 8 KB of bits, a sane probe count.
const MIN_BITS = 1024;
const MAX_BITS = 65536;
const MAX_K = 16;

/**
 * Parse `{ m, k, b }` (b = base64 bitset) from a request body.
 * Returns null for anything malformed, so the caller falls back to no filter
 * rather than trusting a bitset of the wrong size.
 */
export const parseBloom = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const m = Number(raw.m);
  const k = Number(raw.k);
  if (!Number.isInteger(m) || m < MIN_BITS || m > MAX_BITS || m % 8 !== 0) return null;
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) return null;
  if (typeof raw.b !== 'string') return null;
  const bits = Buffer.from(raw.b, 'base64');
  if (bits.length !== m / 8) return null;
  return {
    has: (id) => bloomIndexes(id, m, k).every((i) => (bits[i >> 3] & (1 << (i & 7))) !== 0),
  };
};

/**
 * The "seen" predicate for a feed request: the Bloom filter when the client
 * sent one, else the legacy `seenIds` array (older app builds).
 */
export const seenPredicate = (body) => {
  const bloom = parseBloom(body?.seenBloom);
  if (bloom) return bloom.has;
  const ids = Array.isArray(body?.seenIds) ? body.seenIds : [];
  const set = new Set(ids.map(String));
  return (id) => set.has(String(id));
};
