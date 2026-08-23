// Razorpay webhook, against a throwaway in-memory MongoDB.
//
// This is the safety net under every payment: the money moves at Razorpay, so
// if the student's app dies between paying and calling verify, the webhook is
// the only thing that grants what they bought. It has to be idempotent
// (Razorpay retries until it gets a 200) and it has to refuse forgeries.
//
// Run: node scripts/paymentWebhook.test.js [--verbose]
import 'dotenv/config.js';
import crypto from 'crypto';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const VERBOSE = process.argv.includes('--verbose');
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec-test-only';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_webhook'));

const { default: User } = await import('../models/user.model.js');
const { default: PaymentOrder } = await import('../models/paymentOrder.model.js');
const { default: Subscription } = await import('../models/subscription.model.js');
const { default: Community } = await import('../models/community/community.model.js');

const app = express();
// Exactly how index.js mounts it: raw body, no JSON parser in front.
app.use('/payment/webhook', express.raw({ type: 'application/json' }),
  (await import('../routes/paymentWebhook.route.js')).default);
const server = app.listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${detail ? ` :: ${detail}` : ''}`);
};

const post = async (event, { secret = process.env.RAZORPAY_WEBHOOK_SECRET, signature } = {}) => {
  const body = JSON.stringify(event);
  const sig = signature ?? crypto.createHmac('sha256', secret).update(body).digest('hex');
  const res = await fetch(`${BASE}/payment/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
    body,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const captured = (orderId, amount, paymentId = 'pay_wh') => ({
  event: 'payment.captured',
  payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, status: 'captured' } } },
});

const user = await User.create({
  name: 'Riya', username: 'riya', email: 'riya@test.dev', mobileNumber: '9000000001',
  password: 'x', dob: new Date('2003-01-01'), college: 'Test Institute',
  year: 2027, gender: 'Other', major: 'B.Tech',
});

console.log('\n[1] forgery');
check('an unsigned delivery is rejected', (await post(captured('o1', 100), { signature: 'deadbeef' })).status === 400);
check('a delivery signed with the wrong secret is rejected',
  (await post(captured('o1', 100), { secret: 'not-the-secret' })).status === 400);
check('a malformed signature does not crash the server',
  (await post(captured('o1', 100), { signature: 'zzzz' })).status === 400);

// Tampering with the body after signing must invalidate it — this is the whole
// reason the route reads the raw bytes instead of a re-serialised object.
const honest = JSON.stringify(captured('o1', 100));
const honestSig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(honest).digest('hex');
const tampered = await fetch(`${BASE}/payment/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': honestSig },
  body: JSON.stringify(captured('o1', 999999)),
});
check('an altered amount invalidates the signature', tampered.status === 400);

console.log('\n[2] the case this exists for: app never called verify');
await PaymentOrder.create({
  razorpayOrderId: 'order_abandoned', user: user._id,
  purpose: 'community_spark', amount: 9900, status: 'created',
  meta: { plan: 'monthly', communityId: new mongoose.Types.ObjectId() },
});
const r1 = await post(captured('order_abandoned', 9900, 'pay_abandoned'));
check('a captured payment settles the order', r1.status === 200, JSON.stringify(r1.body));
const settled = await PaymentOrder.findOne({ razorpayOrderId: 'order_abandoned' }).lean();
check('the order is now paid', settled?.status === 'paid', settled?.status);
check('the payment id is recorded', settled?.razorpayPaymentId === 'pay_abandoned');
check('paidAt is stamped', !!settled?.paidAt);

console.log('\n[3] retries');
// Razorpay redelivers until it sees a 200; every redelivery must be harmless.
const r2 = await post(captured('order_abandoned', 9900, 'pay_abandoned'));
check('a redelivery answers 200', r2.status === 200);
check('and is reported as a duplicate', r2.body.duplicate === true, JSON.stringify(r2.body));
check('the order is still paid exactly once',
  (await PaymentOrder.countDocuments({ razorpayOrderId: 'order_abandoned', status: 'paid' })) === 1);

console.log('\n[4] the app won the race');
await PaymentOrder.create({
  razorpayOrderId: 'order_already', user: user._id, purpose: 'notice_boost',
  amount: 4900, status: 'paid', razorpayPaymentId: 'pay_app', paidAt: new Date(),
});
const r3 = await post(captured('order_already', 4900, 'pay_app'));
check('a webhook after a successful verify is a no-op', r3.status === 200);
const untouched = await PaymentOrder.findOne({ razorpayOrderId: 'order_already' }).lean();
check('it does not overwrite the recorded payment id', untouched?.razorpayPaymentId === 'pay_app');

console.log('\n[5] the amount must match what we charged');
await PaymentOrder.create({
  razorpayOrderId: 'order_short', user: user._id, purpose: 'funding_listing',
  amount: 24900, status: 'created',
});
const r4 = await post(captured('order_short', 100, 'pay_short'));
check('an underpaid capture answers 200', r4.status === 200);
check('and the order is marked failed, not granted',
  (await PaymentOrder.findOne({ razorpayOrderId: 'order_short' }).lean())?.status === 'failed');

console.log('\n[6] failures');
await PaymentOrder.create({
  razorpayOrderId: 'order_fail', user: user._id, purpose: 'notice_boost',
  amount: 4900, status: 'created',
});
const failEvent = {
  event: 'payment.failed',
  payload: { payment: { entity: { id: 'pay_f', order_id: 'order_fail', amount: 4900, status: 'failed' } } },
};
check('a failed payment answers 200', (await post(failEvent)).status === 200);
check('and marks the open order failed',
  (await PaymentOrder.findOne({ razorpayOrderId: 'order_fail' }).lean())?.status === 'failed');

// A late "failed" must never revoke something already delivered.
const lateFail = {
  event: 'payment.failed',
  payload: { payment: { entity: { id: 'pay_app', order_id: 'order_already', amount: 4900, status: 'failed' } } },
};
await post(lateFail);
check('a late failure does not undo an already-paid order',
  (await PaymentOrder.findOne({ razorpayOrderId: 'order_already' }).lean())?.status === 'paid');

console.log('\n[7] subscriptions');
await Subscription.create({
  user: user._id, razorpayOrderId: 'order_sub', amount: 39, status: 'pending',
});
const r5 = await post(captured('order_sub', 3900, 'pay_sub'));
check('a subscription payment activates it', r5.status === 200, JSON.stringify(r5.body));
const sub = await Subscription.findOne({ razorpayOrderId: 'order_sub' }).lean();
check('the subscription is active', sub?.status === 'active', sub?.status);
check('it has an end date about 30 days out',
  sub?.endDate && Math.round((sub.endDate - sub.startDate) / 86400000) === 30,
  String(sub?.endDate));
check('the user is marked subscribed', (await User.findById(user._id).lean())?.is_subscribed === true);

const r6 = await post(captured('order_sub', 3900, 'pay_sub'));
check('redelivering a subscription payment is a no-op', r6.status === 200 && r6.body.duplicate === true);
check('and does not extend it twice',
  (await Subscription.countDocuments({ razorpayOrderId: 'order_sub', status: 'active' })) === 1);

console.log('\n[8] events we do not handle');
check('an unknown event is acknowledged, not retried forever',
  (await post({ event: 'refund.created', payload: {} })).status === 200);
check('an order we have never seen is acknowledged',
  (await post(captured('order_unknown', 100, 'pay_unknown'))).status === 200);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) failed.forEach((f) => console.log(`  FAIL ${f.label} :: ${f.detail}`));

await server.close();
await mongoose.disconnect();
await mongod.stop();
process.exit(failed.length ? 1 : 0);
