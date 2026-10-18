// Fync Gifts money path: server-side amount, paid exactly once across
// verify + webhook, refund flips it, unpaid orders stay out of admin.
// Run: RAZORPAY_KEY_ID=k RAZORPAY_KEY_SECRET=s node controllers/gift.controller.test.mjs
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import crypto from 'crypto';
import assert from 'assert/strict';
process.env.RAZORPAY_WEBHOOK_SECRET = 'w';
process.env.RAZORPAY_KEY_ID ??= 'k'; process.env.RAZORPAY_KEY_SECRET ??= 's';
process.env.R2_PUBLIC_URL = 'https://cdn.test';
const m = await MongoMemoryServer.create(); await mongoose.connect(m.getUri('t'));
const { default: PO } = await import('../models/paymentOrder.model.js');
const { default: GO } = await import('../models/gift/giftOrder.model.js');
const { default: GP } = await import('../models/gift/giftProduct.model.js');
const { resolvePurchase } = await import('../utils/pricing.js');
const { grantEntitlement } = await import('./payment.controller.js');
const { razorpayWebhook } = await import('./paymentWebhook.controller.js');
const gift = await import('./gift.controller.js');

const call = async (fn, req) => { const o = {}; await fn(req, { status(c) { o.c = c; return this; }, json(b) { o.b = b; return this; } }, (e) => { throw e; }); return o; };
const send = (ev) => { const raw = Buffer.from(JSON.stringify(ev));
  return call(razorpayWebhook, { body: raw, headers: { 'x-razorpay-signature': crypto.createHmac('sha256', 'w').update(raw).digest('hex') } }); };

const u = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId();
let r = await call(gift.listProducts, {});
assert.equal(r.b.products.length, 6, 'first run seeds the catalog');
const mug = await GP.findOne({ slug: 'custom-mug' }).lean();

const shipping = { name: 'Riya', phone: '9876543210', line1: 'Hostel 4', city: 'Pune', state: 'MH', pincode: '411001' };
const body = { productId: String(mug._id), customization: { photos: ['https://cdn.test/gift_photos/a.webp'], text: 'Us', options: { Type: 'Magic (reveals when hot)' } }, shipping, amount: 1 };
r = await call(gift.createGiftOrder, { user: { id: u }, body });
assert.equal(r.c, 201);
assert.equal(r.b.amount, 34900 + 15000, 'price from product + option, client amount ignored');
const giftOrderId = String(r.b.giftOrderId);

r = await call(gift.createGiftOrder, { user: { id: u }, body: { ...body, customization: { ...body.customization, photos: ['https://evil.test/x.jpg'] } } });
assert.equal(r.c, 400, 'foreign photo host rejected');

// /payment/order resolution
const priced = await resolvePurchase('couple_gift', { giftOrderId, amount: 1 }, u);
assert.equal(priced.amount, 49900);
await assert.rejects(() => resolvePurchase('couple_gift', { giftOrderId }, other), /not found/, 'someone else\'s gift order');

// unpaid never in admin
r = await call(gift.adminListOrders, { query: {} });
assert.equal(r.b.orders.length, 0);

// webhook settles, then verify path (grantEntitlement) runs again: one 'paid'
await PO.create({ razorpayOrderId: 'g1', user: u, purpose: 'couple_gift', amount: priced.amount, meta: priced.meta });
r = await send({ event: 'payment.captured', payload: { payment: { entity: { id: 'p1', order_id: 'g1', amount: 49900 } } } });
assert.equal(r.b.granted, 'couple_gift');
await grantEntitlement(await PO.findOne({ razorpayOrderId: 'g1' }).lean());
r = await send({ event: 'payment.captured', payload: { payment: { entity: { id: 'p1', order_id: 'g1', amount: 49900 } } } });
let g = await GO.findById(giftOrderId).lean();
assert.equal(g.status, 'paid'); assert.equal(g.paymentOrderId, 'g1');
assert.equal(g.statusHistory.filter((h) => h.status === 'paid').length, 1, 'paid exactly once');
await assert.rejects(() => resolvePurchase('couple_gift', { giftOrderId }, u), /already paid/, 'cannot pay twice');

// public projection hides the address; admin sees it
assert.equal((await GO.findById(giftOrderId).lean()).shipping, undefined);
r = await call(gift.adminListOrders, { query: {} });
assert.equal(r.b.orders[0].shipping.pincode, '411001');

// admin transitions
r = await call(gift.adminUpdateOrder, { params: { id: giftOrderId }, body: { status: 'delivered' } });
assert.equal(r.c, 400, 'paid -> delivered skips steps');
r = await call(gift.adminUpdateOrder, { params: { id: giftOrderId }, body: { status: 'in_production' } });
assert.equal(r.b.order.status, 'in_production');
r = await call(gift.adminUpdateOrder, { params: { id: giftOrderId }, body: { status: 'shipped', tracking: { courier: 'Delhivery', awb: '123', url: 'javascript:alert(1)' } } });
assert.equal(r.c, 400, 'tracking url must be http(s)');

// full refund via webhook
await send({ event: 'refund.processed', payload: { refund: { entity: { id: 'rf', payment_id: 'p1' } }, payment: { entity: { id: 'p1', amount: 49900, amount_refunded: 49900 } } } });
assert.equal((await GO.findById(giftOrderId).lean()).status, 'refunded');

await mongoose.disconnect(); await m.stop();
console.log('gift.controller: all assertions passed');
