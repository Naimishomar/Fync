// Coins are spent with one conditional update, so parallel taps cannot buy
// several items with the balance for one.
//
// Run: node controllers/marketplace/marketplace.controller.test.mjs
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('fync_market'));

const { default: User } = await import('../../models/user.model.js');
const { default: MarketPlace } = await import('../../models/marketplace/marketplace.model.js');
const { buyProduct } = await import('./marketplace.controller.js');

const u = await User.collection.insertOne({ coins: 100, redeemedItems: [], email: 'a@b.c', username: 'x' });
const tee = await MarketPlace.collection.insertOne({ product_name: 'Tee', product_description: 'd', coins_required: 100 });
const gone = await MarketPlace.collection.insertOne({ product_name: 'Mug', product_description: 'd', coins_required: 1, is_available: false });

const buy = async (productId) => {
  const o = {};
  await buyProduct({ params: { product_id: String(productId) }, user: { id: String(u.insertedId) },
    body: { address: 'a', mobileNumber: '1', pincode: '1' } },
  { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } });
  return o;
};

const codes = (await Promise.all(Array.from({ length: 5 }, () => buy(tee.insertedId)))).map((r) => r.code);
const after = await User.collection.findOne({ _id: u.insertedId });
assert.equal(codes.filter((c) => c === 200).length, 1, `exactly one purchase wins: ${codes}`);
assert.equal(after.coins, 0);
assert.equal(after.redeemedItems.length, 1);
console.log('T race: one purchase, one debit');

await User.collection.updateOne({ _id: u.insertedId }, { $set: { coins: 50 } });
assert.equal((await buy(gone.insertedId)).code, 400, 'unavailable product is refused');
assert.equal((await User.collection.findOne({ _id: u.insertedId })).coins, 50);
console.log('T unavailable: refused, no debit');

await mongoose.disconnect(); await mem.stop();
console.log('marketplace: all assertions passed');
process.exit(0);
