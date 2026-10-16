// Interview credit: a verified payment must never be lost when /start fails.
//
// Run: node utils/interviewCredit.test.js
import crypto from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.RAZORPAY_KEY_SECRET = 'test-secret-not-a-real-key';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_interview_credit'));

const { default: PaymentOrder } = await import('../models/paymentOrder.model.js');
const { redeemInterviewOrder, findInterviewCredit, claimInterviewCredit, releaseInterviewCredit } =
  await import('./interviewCredit.js');

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${detail ? ` :: ${detail}` : ''}`);
};

const sign = (o, p) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${o}|${p}`).digest('hex');

const USER = new mongoose.Types.ObjectId();
const credits = () => PaymentOrder.countDocuments({ user: USER, status: 'paid', 'meta.credit': true, 'meta.consumedAt': { $exists: false } });

await PaymentOrder.create({
  razorpayOrderId: 'order_iv', user: USER, purpose: 'interview_session', amount: 500, meta: { duration: 10, credit: true },
});
const args = {
  orderId: 'order_iv', paymentId: 'pay_iv', signature: sign('order_iv', 'pay_iv'), userId: USER,
  fetchPayment: async () => ({ status: 'captured', amount: 500, order_id: 'order_iv' }),
};

// ── verify grants once, and a replay (or webhook-first) is still a success ──
const first = await redeemInterviewOrder(args);
check('verify grants a credit', first?.status === 'paid' && (await credits()) === 1);
const again = await redeemInterviewOrder(args);
check('a repeated verify succeeds without a second credit', again?.status === 'paid' && (await credits()) === 1);

try {
  await redeemInterviewOrder({ ...args, paymentId: 'pay_other', signature: sign('order_iv', 'pay_other') });
  check('a different payment on a spent order is refused', false, 'accepted');
} catch (e) {
  check('a different payment on a spent order is refused', e.status === 409);
}

check('the credit is visible to the client', (await findInterviewCredit(USER))?.meta?.duration === 10);

// ── start fails after claiming → released → retry consumes it ───────────────
const claimed = await claimInterviewCredit(USER);
check('start claims the credit', claimed?.meta?.duration === 10 && (await credits()) === 0);
await releaseInterviewCredit(claimed);
check('a failed start hands the credit back', (await credits()) === 1);

// ── concurrent retries: one payment = one session ───────────────────────────
const raced = await Promise.all([claimInterviewCredit(USER), claimInterviewCredit(USER), claimInterviewCredit(USER)]);
check('racing starts consume the credit exactly once', raced.filter(Boolean).length === 1 && (await credits()) === 0);
check('no credit left after it is spent', (await claimInterviewCredit(USER)) === null);

// Orders paid before the credit marker existed were spent by sessions that
// never recorded it; they must not resurface as free interviews.
await PaymentOrder.create({
  razorpayOrderId: 'order_legacy', user: USER, purpose: 'interview_session', amount: 500,
  status: 'paid', paidAt: new Date(), razorpayPaymentId: 'pay_legacy', meta: { duration: 15 },
});
check('a pre-marker paid order is not a credit', (await claimInterviewCredit(USER)) === null);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);

await mongoose.disconnect();
await mongod.stop();
process.exit(failed.length ? 1 : 0);
