// Money path. These are the exact attacks the old signature-only checks let
// through, so each one stays here as a regression guard.
//
// Run: node utils/redeemOrder.test.js
import crypto from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.RAZORPAY_KEY_SECRET = 'test-secret-not-a-real-key';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_payments'));

const { default: PaymentOrder } = await import('../models/paymentOrder.model.js');
const { redeemPaidOrder, releaseOrder, PaymentError } = await import('./redeemOrder.js');

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${detail ? ` :: ${detail}` : ''}`);
};

/** Razorpay signs `order_id|payment_id` with the key secret. */
const sign = (orderId, paymentId) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

const USER = new mongoose.Types.ObjectId();
const OTHER = new mongoose.Types.ObjectId();

const mkOrder = (id, purpose, amount, user = USER) =>
  PaymentOrder.create({ razorpayOrderId: id, user, purpose, amount });

const captured = (amount, orderId) => async () => ({ status: 'captured', amount, order_id: orderId });

const expectFail = async (label, args, wantStatus) => {
  try {
    await redeemPaidOrder(args);
    check(label, false, 'it was accepted');
  } catch (e) {
    check(label, e instanceof PaymentError && e.status === wantStatus,
      `${e.constructor.name} ${e.status ?? ''} ${e.message}`);
  }
};

// ── the happy path still works ──────────────────────────────────────────────
await mkOrder('order_ok', 'notice_boost', 4900);
const ok = await redeemPaidOrder({
  orderId: 'order_ok', paymentId: 'pay_1', signature: sign('order_ok', 'pay_1'),
  userId: USER, purpose: 'notice_boost', fetchPayment: captured(4900, 'order_ok'),
});
check('a genuine receipt is redeemed', ok?.status === 'paid' && ok.amount === 4900);

// ── replay: the same receipt a second time ──────────────────────────────────
await expectFail('the same receipt cannot be spent twice', {
  orderId: 'order_ok', paymentId: 'pay_1', signature: sign('order_ok', 'pay_1'),
  userId: USER, purpose: 'notice_boost', fetchPayment: captured(4900, 'order_ok'),
}, 409);

// ── cross-purpose: pay ₹49 for a notice, claim a ₹249 listing ───────────────
await mkOrder('order_cheap', 'notice_boost', 4900);
await expectFail('a notice receipt cannot buy a funding listing', {
  orderId: 'order_cheap', paymentId: 'pay_2', signature: sign('order_cheap', 'pay_2'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(4900, 'order_cheap'),
}, 400);

// ── forged signature ────────────────────────────────────────────────────────
await mkOrder('order_forge', 'funding_listing', 24900);
await expectFail('a forged signature is rejected', {
  orderId: 'order_forge', paymentId: 'pay_3', signature: 'de'.repeat(32),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_forge'),
}, 400);

// A signature valid for one payment id must not validate another.
await expectFail('a signature from a different payment is rejected', {
  orderId: 'order_forge', paymentId: 'pay_3', signature: sign('order_forge', 'pay_OTHER'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_forge'),
}, 400);

// Non-hex garbage must not crash timingSafeEqual.
await expectFail('a malformed signature is rejected, not thrown on', {
  orderId: 'order_forge', paymentId: 'pay_3', signature: 'zzzz',
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_forge'),
}, 400);

// ── someone else's order ────────────────────────────────────────────────────
await mkOrder('order_theirs', 'funding_listing', 24900, OTHER);
await expectFail("another user's receipt is not usable", {
  orderId: 'order_theirs', paymentId: 'pay_4', signature: sign('order_theirs', 'pay_4'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_theirs'),
}, 404);

// ── the money must actually have arrived, in full ───────────────────────────
await mkOrder('order_short', 'funding_listing', 24900);
await expectFail('an underpaid capture is rejected', {
  orderId: 'order_short', paymentId: 'pay_5', signature: sign('order_short', 'pay_5'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(100, 'order_short'),
}, 400);
check('an underpaid order is not claimed',
  (await PaymentOrder.findOne({ razorpayOrderId: 'order_short' }).lean())?.status === 'created');

await mkOrder('order_uncaptured', 'funding_listing', 24900);
await expectFail('an uncaptured payment is rejected', {
  orderId: 'order_uncaptured', paymentId: 'pay_6', signature: sign('order_uncaptured', 'pay_6'),
  userId: USER, purpose: 'funding_listing',
  fetchPayment: async () => ({ status: 'failed', amount: 24900, order_id: 'order_uncaptured' }),
}, 400);

// A payment that belongs to a different order must not settle this one.
await mkOrder('order_mismatch', 'funding_listing', 24900);
await expectFail('a payment for another order is rejected', {
  orderId: 'order_mismatch', paymentId: 'pay_7', signature: sign('order_mismatch', 'pay_7'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_somewhere_else'),
}, 400);

// ── release: paid for something that could not be delivered ─────────────────
await mkOrder('order_release', 'funding_listing', 24900);
const claimed = await redeemPaidOrder({
  orderId: 'order_release', paymentId: 'pay_8', signature: sign('order_release', 'pay_8'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_release'),
});
await releaseOrder(claimed);
const released = await PaymentOrder.findOne({ razorpayOrderId: 'order_release' }).lean();
check('a released order stays paid but unconsumed', released?.status === 'paid' && !released?.meta?.consumedAt);

const retried = await redeemPaidOrder({
  orderId: 'order_release', paymentId: 'pay_8', signature: sign('order_release', 'pay_8'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_release'),
});
check('and the student can retry without paying twice', retried?.status === 'paid');

// ── webhook settled it first: the create endpoint still redeems, once ──────
await mkOrder('order_wh', 'notice_boost', 4900);
await PaymentOrder.updateOne({ razorpayOrderId: 'order_wh' },
  { status: 'paid', razorpayPaymentId: 'pay_wh', paidAt: new Date(), 'meta.settledBy': 'webhook' }); // what settleOrder does
const whArgs = {
  orderId: 'order_wh', paymentId: 'pay_wh', signature: sign('order_wh', 'pay_wh'),
  userId: USER, purpose: 'notice_boost', fetchPayment: captured(4900, 'order_wh'),
};
const race = await Promise.allSettled([redeemPaidOrder(whArgs), redeemPaidOrder(whArgs), redeemPaidOrder(whArgs)]);
check('a webhook-settled order is redeemed exactly once under a race',
  race.filter((r) => r.status === 'fulfilled').length === 1 &&
  race.filter((r) => r.reason?.status === 409).length === 2);
await expectFail('/payment/verify (no purpose) does not redeem a webhook-settled order', { ...whArgs, purpose: undefined }, 409);

await mkOrder('order_wh2', 'notice_boost', 4900);
await PaymentOrder.updateOne({ razorpayOrderId: 'order_wh2' }, { status: 'paid', razorpayPaymentId: 'pay_a', 'meta.settledBy': 'webhook' });
await expectFail('a webhook-settled order cannot be redeemed with a different payment', {
  orderId: 'order_wh2', paymentId: 'pay_b', signature: sign('order_wh2', 'pay_b'),
  userId: USER, purpose: 'notice_boost', fetchPayment: captured(4900, 'order_wh2'),
}, 409);

// ── legacy: delivered before the settledBy marker existed, same shape otherwise ─
await mkOrder('order_legacy', 'funding_listing', 24900);
await PaymentOrder.updateOne({ razorpayOrderId: 'order_legacy' },
  { status: 'paid', razorpayPaymentId: 'pay_old', paidAt: new Date() });
await expectFail('a legacy paid order (no settledBy) cannot be re-posted for a second listing', {
  orderId: 'order_legacy', paymentId: 'pay_old', signature: sign('order_legacy', 'pay_old'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_legacy'),
}, 409);

// ── payment.failed for one attempt, then a successful retry on the same order ─
await mkOrder('order_retry', 'funding_listing', 24900);
await PaymentOrder.updateOne({ razorpayOrderId: 'order_retry' }, { status: 'failed' });
const recovered = await redeemPaidOrder({
  orderId: 'order_retry', paymentId: 'pay_9', signature: sign('order_retry', 'pay_9'),
  userId: USER, purpose: 'funding_listing', fetchPayment: captured(24900, 'order_retry'),
});
check('a failed order can still be paid by a later attempt', recovered?.status === 'paid');

// ── authorized is captured first; a failed capture is not paid ──────────────
await mkOrder('order_auth', 'notice_boost', 4900);
let captureCalls = 0;
const authorized = await redeemPaidOrder({
  orderId: 'order_auth', paymentId: 'pay_10', signature: sign('order_auth', 'pay_10'),
  userId: USER, purpose: 'notice_boost',
  fetchPayment: async () => ({ id: 'pay_10', status: 'authorized', amount: 4900, order_id: 'order_auth' }),
  capturePayment: async () => { captureCalls++; return { status: 'captured' }; },
});
check('an authorized payment is captured before it counts', authorized?.status === 'paid' && captureCalls === 1);
await mkOrder('order_auth2', 'notice_boost', 4900);
await expectFail('an authorized payment whose capture fails is rejected', {
  orderId: 'order_auth2', paymentId: 'pay_11', signature: sign('order_auth2', 'pay_11'),
  userId: USER, purpose: 'notice_boost',
  fetchPayment: async () => ({ id: 'pay_11', status: 'authorized', amount: 4900, order_id: 'order_auth2' }),
  capturePayment: async () => ({ status: 'authorized' }),
}, 400);

// ── Razorpay down: nothing is left half-claimed ─────────────────────────────
await mkOrder('order_down', 'notice_boost', 4900);
try {
  await redeemPaidOrder({
    orderId: 'order_down', paymentId: 'pay_12', signature: sign('order_down', 'pay_12'),
    userId: USER, purpose: 'notice_boost', fetchPayment: async () => { throw new Error('ECONNRESET'); },
  });
} catch {}
check('a Razorpay outage leaves the order claimable',
  (await PaymentOrder.findOne({ razorpayOrderId: 'order_down' }).lean())?.status === 'created');

// ── interview credits are paid here but consumed by /start ──────────────────
await PaymentOrder.create({ razorpayOrderId: 'order_credit', user: USER, purpose: 'interview_session', amount: 500, meta: { credit: true } });
const credit = await redeemPaidOrder({
  orderId: 'order_credit', paymentId: 'pay_13', signature: sign('order_credit', 'pay_13'),
  userId: USER, purpose: 'interview_session', fetchPayment: captured(500, 'order_credit'),
});
check('a credit order is paid but not consumed', credit?.status === 'paid' && !credit.meta?.consumedAt);

// ── missing fields ──────────────────────────────────────────────────────────
await expectFail('missing details are rejected', { orderId: 'x', userId: USER }, 400);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);

await mongoose.disconnect();
await mongod.stop();
process.exit(failed.length ? 1 : 0);
