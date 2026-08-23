// The admin payment ledger, against a throwaway in-memory MongoDB.
//
// The interesting claim is the pagination: payments keep arriving while an
// admin scrolls, and a skip/limit window shifts by one every time, so page 2
// repeats a row page 1 already showed and drops another off the end. That is
// exactly the bug that makes a finance screen untrustworthy, so it is tested
// by inserting a payment mid-scroll.
//
// Run: node scripts/adminLedger.test.js [--verbose]
import 'dotenv/config.js';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

const VERBOSE = process.argv.includes('--verbose');
process.env.JWT_SECRET ||= 'admin-ledger-test-secret';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_admin_ledger'));

const { default: User } = await import('../models/user.model.js');
const { default: PaymentOrder } = await import('../models/paymentOrder.model.js');

const mkUser = (name, n, access) => ({
  name, username: name.toLowerCase(), email: `${name.toLowerCase()}@test.dev`,
  mobileNumber: `90000000${n}`, password: 'x', dob: new Date('2003-01-01'),
  college: 'Test Institute', year: 2027, gender: 'Other', major: 'B.Tech',
  user_access: access,
});
const [admin, student, other] = await User.create([
  mkUser('Admin', 1, 'admin'),
  mkUser('Riya', 2, 'user'),
  mkUser('Karan', 3, 'user'),
]);

const tokenFor = (u) => jwt.sign({ id: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
const TOKENS = { admin: tokenFor(admin), student: tokenFor(student) };

const app = express();
app.use(express.json());
app.use('/payment', (await import('../routes/payment.route.js')).default);
app.use('/user', (await import('../routes/auth.route.js')).default);
app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));

const server = app.listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${detail ? ` :: ${detail}` : ''}`);
};
const call = async (path, as = 'admin') => {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${TOKENS[as]}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

// 25 payments, oldest first, one second apart so the ordering is unambiguous.
const base = Date.UTC(2026, 0, 1);
const PURPOSES = ['notice_boost', 'funding_listing', 'interview_session'];
for (let i = 0; i < 25; i++) {
  await PaymentOrder.create({
    razorpayOrderId: `order_${String(i).padStart(2, '0')}`,
    razorpayPaymentId: i % 3 === 0 ? `pay_${i}` : undefined,
    user: i % 2 ? student._id : other._id,
    purpose: PURPOSES[i % 3],
    amount: (i + 1) * 100,
    status: i % 3 === 0 ? 'paid' : i % 3 === 1 ? 'created' : 'failed',
    paidAt: i % 3 === 0 ? new Date(base + i * 1000) : undefined,
    createdAt: new Date(base + i * 1000),
  });
}

console.log('\n[1] access control');
check('a student cannot read the ledger', (await call('/payment/admin/orders', 'student')).status === 403);
check('a student cannot read payment stats', (await call('/payment/admin/stats', 'student')).status === 403);
check('a student cannot read user stats', (await call('/user/admin/stats', 'student')).status === 403);

console.log('\n[2] first page');
const p1 = await call('/payment/admin/orders?limit=10');
check('returns exactly 10', p1.body.orders?.length === 10, String(p1.body.orders?.length));
check('newest first', p1.body.orders?.[0]?.orderId === 'order_24', p1.body.orders?.[0]?.orderId);
check('reports more to come', p1.body.hasMore === true && !!p1.body.nextCursor);

const row = p1.body.orders[0];
check('carries the reference id', !!row.orderId);
check('carries who paid', row.user?.name === 'Riya' || row.user?.name === 'Karan', row.user?.name);
check('carries what it was for', PURPOSES.includes(row.purpose), row.purpose);
check('carries the amount', typeof row.amount === 'number');
check('carries the status', ['created', 'paid', 'failed'].includes(row.status), row.status);

console.log('\n[3] scrolling through');
const seen = [];
let cursor = p1.body.nextCursor;
p1.body.orders.forEach((o) => seen.push(o.orderId));
let guard = 0;
while (cursor && guard++ < 10) {
  const next = await call(`/payment/admin/orders?limit=10&cursor=${encodeURIComponent(cursor)}`);
  next.body.orders.forEach((o) => seen.push(o.orderId));
  cursor = next.body.nextCursor;
}
check('every payment appears', seen.length === 25, `${seen.length} rows`);
check('no payment appears twice', new Set(seen).size === seen.length);
check('the last page ends the scroll', cursor === null);

console.log('\n[4] a payment arrives mid-scroll');
// This is where skip/limit fails: a new row at the top pushes everything down,
// so the second page re-serves a row the first page already showed.
const fresh = await call('/payment/admin/orders?limit=10');
await PaymentOrder.create({
  razorpayOrderId: 'order_LIVE', user: student._id, purpose: 'notice_boost',
  amount: 4900, status: 'created',
});
const after = await call(`/payment/admin/orders?limit=10&cursor=${encodeURIComponent(fresh.body.nextCursor)}`);
const firstPageIds = fresh.body.orders.map((o) => o.orderId);
const secondPageIds = after.body.orders.map((o) => o.orderId);
const overlap = secondPageIds.filter((id) => firstPageIds.includes(id));
check('the new payment does not duplicate a row', overlap.length === 0, overlap.join(','));
check('and no row is skipped', secondPageIds[0] === 'order_14', secondPageIds[0]);

console.log('\n[5] filters and search');
const paidOnly = await call('/payment/admin/orders?limit=50&status=paid');
check('status filter returns only that status',
  paidOnly.body.orders.every((o) => o.status === 'paid') && paidOnly.body.orders.length > 0,
  `${paidOnly.body.orders.length} rows`);

const byRef = await call('/payment/admin/orders?search=order_07');
check('search by reference id finds it', byRef.body.orders?.[0]?.orderId === 'order_07', byRef.body.orders?.[0]?.orderId);

const byName = await call('/payment/admin/orders?limit=50&search=Riya');
check('search by student name finds their payments',
  byName.body.orders.length > 0 && byName.body.orders.every((o) => o.user?.name === 'Riya'),
  `${byName.body.orders.length} rows`);

const byPurpose = await call('/payment/admin/orders?limit=50&purpose=notice_boost');
check('purpose filter works', byPurpose.body.orders.every((o) => o.purpose === 'notice_boost'));

const garbage = await call('/payment/admin/orders?limit=10&cursor=not-a-real-cursor');
check('a malformed cursor does not 500', garbage.status === 200 && garbage.body.orders?.length === 10);

console.log('\n[6] stats');
const ps = (await call('/payment/admin/stats')).body.stats;
const expectPaid = await PaymentOrder.countDocuments({ status: 'paid' });
const expectPending = await PaymentOrder.countDocuments({ status: 'created' });
check('successful count matches the collection', ps.successful === expectPaid, `${ps.successful} vs ${expectPaid}`);
check('pending count matches the collection', ps.pending === expectPending, `${ps.pending} vs ${expectPending}`);
check('gross collected sums only paid orders', ps.grossCollected > 0);
check('breaks down by feature', Array.isArray(ps.byPurpose) && ps.byPurpose.length > 0);

const us = (await call('/user/admin/stats')).body.stats;
check('total users matches the collection', us.total === (await User.countDocuments({})), `${us.total}`);
check('students counted separately', us.students === 2, String(us.students));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) failed.forEach((f) => console.log(`  FAIL ${f.label} :: ${f.detail}`));

await server.close();
await mongoose.disconnect();
await mongod.stop();
process.exit(failed.length ? 1 : 0);
