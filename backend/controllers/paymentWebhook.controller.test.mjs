// Webhook paths the main suite (scripts/paymentWebhook.test.js) does not cover:
// a failed attempt followed by a successful one, and refunds revoking access.
//
// Run: node controllers/paymentWebhook.controller.test.mjs
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import crypto from 'crypto';
import assert from 'assert/strict';
process.env.RAZORPAY_WEBHOOK_SECRET='w';
const m = await MongoMemoryServer.create(); await mongoose.connect(m.getUri('t'));
const B='../';
const { default: PO } = await import(B+'models/paymentOrder.model.js');
const { default: Sub } = await import(B+'models/subscription.model.js');
const { default: RB } = await import(B+'models/events/registerBootcamp.model.js');
const { razorpayWebhook } = await import(B+'controllers/paymentWebhook.controller.js');
const send = async (ev) => { const raw=Buffer.from(JSON.stringify(ev)); const o={};
  await razorpayWebhook({ body: raw, headers: {'x-razorpay-signature': crypto.createHmac('sha256','w').update(raw).digest('hex')} }, {status(c){o.c=c;return this}, json(b){o.b=b;return this}}); return o; };
const u = new mongoose.Types.ObjectId();
// failed then captured
await PO.create({ razorpayOrderId:'o1', user:u, purpose:'bootcamp', amount:100, meta:{} });
await send({ event:'payment.failed', payload:{payment:{entity:{id:'p0',order_id:'o1',amount:100}}}});
assert.equal((await PO.findOne({razorpayOrderId:'o1'})).status,'failed');
let r = await send({ event:'payment.captured', payload:{payment:{entity:{id:'p1',order_id:'o1',amount:100}}}});
assert.equal((await PO.findOne({razorpayOrderId:'o1'})).status,'paid'); assert.equal(r.b.granted,'bootcamp');
r = await send({ event:'payment.captured', payload:{payment:{entity:{id:'p1',order_id:'o1',amount:100}}}});
assert.equal(r.b.duplicate,true);
// mismatch
await PO.create({ razorpayOrderId:'o2', user:u, purpose:'notice_boost', amount:100 });
r = await send({ event:'payment.captured', payload:{payment:{entity:{id:'p2',order_id:'o2',amount:1}}}});
assert.equal(r.b.mismatch,true); assert.equal((await PO.findOne({razorpayOrderId:'o2'})).status,'failed');
// refund of bootcamp registration + subscription
const reg = await RB.collection.insertOne({ isPaid:true });
await PO.updateOne({razorpayOrderId:'o1'},{ 'meta.registrationId': String(reg.insertedId) });
r = await send({ event:'refund.processed', payload:{ refund:{entity:{id:'rf1',payment_id:'p1',amount:100}}, payment:{entity:{id:'p1',amount:100,amount_refunded:100}} }});
assert.equal(r.c,200);
assert.equal((await RB.collection.findOne({_id:reg.insertedId})).isPaid,false);
assert.ok((await PO.findOne({razorpayOrderId:'o1'})).meta.refundedAt);
await Sub.create({ user:u, razorpayOrderId:'s1', razorpayPaymentId:'ps', amount:39, status:'active', endDate:new Date(Date.now()+864e5) });
await send({ event:'refund.processed', payload:{ refund:{entity:{id:'rf2',payment_id:'ps',amount:3900}}, payment:{entity:{id:'ps',amount:3900,amount_refunded:3900}} }});
assert.equal((await Sub.findOne({razorpayOrderId:'s1'})).status,'expired');
await mongoose.disconnect(); await m.stop();
console.log('paymentWebhook.controller: all assertions passed'); process.exit(0);
