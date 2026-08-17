// Run: node utils/pricing.test.js
//
// The old flow let the client post its own `amount` and its own `notes`, then
// granted entitlements from those notes — so ₹1 bought a yearly Community Spark.
// These checks pin the properties that closed it.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resolvePurchase, CATALOG } from './pricing.js';

// ── prices come from the server, never the request ──────────────────────────
const notice = await resolvePurchase('notice_boost', { amount: 1 }, 'u1');
assert.equal(notice.amount, 4900, 'a client-supplied amount must be ignored');

const funding = await resolvePurchase('funding_listing', { amount: 100 }, 'u1');
assert.equal(funding.amount, 24900);

const monthly = await resolvePurchase('community_creation', { plan: 'monthly', name: 'Robotics' }, 'u1');
assert.equal(monthly.amount, 9900);

const yearly = await resolvePurchase('community_creation', { plan: 'yearly', name: 'Robotics' }, 'u1');
assert.equal(yearly.amount, 99900);

// ── unknown or malformed purchases are refused, never defaulted ─────────────
await assert.rejects(
  () => resolvePurchase('free_everything', {}, 'u1'),
  /Unknown purchase type/,
  'an unrecognised purpose must not fall back to a client amount'
);
await assert.rejects(
  () => resolvePurchase('community_creation', { plan: 'lifetime' }, 'u1'),
  /Invalid plan/,
  'an unpriced plan must be rejected'
);

// ── stored meta is sanitised, not echoed ────────────────────────────────────
const named = await resolvePurchase(
  'community_creation',
  { plan: 'monthly', name: 'x'.repeat(500) },
  'u1'
);
assert.ok(named.meta.name.length <= 120, 'meta must not store unbounded client strings');
assert.equal(named.meta.plan, 'monthly');

// every catalog entry must actually be priceable
for (const purpose of Object.keys(CATALOG)) {
  assert.equal(typeof CATALOG[purpose].price, 'function', `${purpose} has no price function`);
}

// ── signature comparison must be length-safe ────────────────────────────────
// verifyOrder converts the received signature with Buffer.from(sig, 'hex');
// timingSafeEqual throws on a length mismatch, so the length guard must come
// first or a short signature would 500 instead of 400.
const expected = crypto.createHmac('sha256', 'secret').update('a|b').digest();
const short = Buffer.from('ab', 'hex');
assert.notEqual(short.length, expected.length);
assert.throws(() => crypto.timingSafeEqual(expected, short), 'confirms the length guard is required');

console.log('pricing: all checks passed ✅');
