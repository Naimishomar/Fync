// One-off: bring an existing database in line with the storage cleanup.
//
// The app's autoIndex creates the new TTL indexes on boot, but it never drops
// an index a schema stopped declaring and never strips fields we stopped
// writing. This does all three, idempotently. Dry run by default.
//
//   node scripts/applyStorageIndexes.js           # show the plan
//   node scripts/applyStorageIndexes.js --apply   # do it (off-peak: the first
//                                                 # TTL pass deletes the backlog)
import 'dotenv/config.js';
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const WEEK = 7 * 24 * 60 * 60;
const MONTH = 30 * 24 * 60 * 60;

const TTL = [
  ['notifications', { createdAt: 1 }, { expireAfterSeconds: WEEK, partialFilterExpression: { isRead: true } }],
  ['paymentorders', { createdAt: 1 }, { expireAfterSeconds: WEEK, partialFilterExpression: { status: 'created' } }],
  ['paymentorders', { updatedAt: 1 }, { expireAfterSeconds: WEEK, partialFilterExpression: { status: 'failed' } }],
  ['giftorders', { createdAt: 1 }, { expireAfterSeconds: WEEK, partialFilterExpression: { status: 'pending_payment' } }],
  ['subscriptions', { createdAt: 1 }, { expireAfterSeconds: WEEK, partialFilterExpression: { status: 'pending' } }],
  ['submissions', { submittedAt: 1 }, { expireAfterSeconds: WEEK }],
  ['notifications', { updatedAt: 1 }, { expireAfterSeconds: MONTH }],
];

// Each is a prefix of a compound index on the same collection, or (liked_by)
// a multikey index no query filters on.
const DROP = [
  ['users', 'college_1'],
  ['users', 'college_1_user_access_1'],
  ['notes', 'uploader_1'],
  ['giftorders', 'status_1'],
  ['shadowrivals', 'season_1'],
  ['shorts', 'liked_by_1'],
  ['fundingprojects', 'liked_by_1'],
];

// Fields no code reads any more.
const UNSET = [
  ['fyncscores', 'scoreHistory'],
  ['placementpredictions', 'resumeText'],
  ['notes', 'expiredAt'],
  ['affiliateshares', 'lastClickedAt'],
  ['users', 'weeklyStats.startOfWeekScore'],
  ['clubmessages', 'readBy'],
  ['clubmessages', 'reactions'],
];
// Notification defaults that are no longer stored: strip the empty ones.
for (const f of ['hackathon', 'post', 'shorts', 'confession']) UNSET.push(['notifications', f, null]);
for (const f of ['commentText', 'message', 'imageUrl']) UNSET.push(['notifications', f, '']);

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
const db = mongoose.connection.db;
console.log(APPLY ? 'APPLY MODE\n' : 'Dry run. Nothing will change.\n');

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const [coll, key, opts] of TTL) {
  const live = await db.collection(coll).indexes().catch(() => []);
  const hit = live.find((i) => sameKey(i.key, key));
  if (hit && hit.expireAfterSeconds === opts.expireAfterSeconds &&
      sameKey(hit.partialFilterExpression ?? null, opts.partialFilterExpression ?? null)) {
    console.log(`ok      ${coll} ${hit.name}`);
    continue;
  }
  if (hit) {
    // Same key with other options: createIndex would refuse. Replace it.
    console.log(`REPLACE ${coll} ${hit.name} -> TTL ${JSON.stringify(opts)}`);
    if (APPLY) await db.collection(coll).dropIndex(hit.name);
  } else {
    console.log(`CREATE  ${coll} ${JSON.stringify(key)} ${JSON.stringify(opts)}`);
  }
  if (APPLY) await db.collection(coll).createIndex(key, opts);
}

for (const [coll, name] of DROP) {
  const live = await db.collection(coll).indexes().catch(() => []);
  if (!live.some((i) => i.name === name)) { console.log(`ok      ${coll} ${name} absent`); continue; }
  console.log(`DROP    ${coll} ${name}`);
  if (APPLY) await db.collection(coll).dropIndex(name);
}

for (const [coll, field, onlyIf] of UNSET) {
  const filter = { [field]: onlyIf === undefined ? { $exists: true } : onlyIf };
  if (onlyIf === null) filter[field] = { $type: 'null' }; // not "missing"
  const n = await db.collection(coll).countDocuments(filter);
  if (!n) { console.log(`ok      ${coll}.${field} nothing to strip`); continue; }
  console.log(`UNSET   ${coll}.${field} on ${n} docs`);
  if (APPLY) await db.collection(coll).updateMany(filter, { $unset: { [field]: 1 } });
}

// Collections whose models were deleted (nothing ever read or wrote them).
// paymenttransactions is NOT dropped: prod still holds legacy payment rows,
// which are financial records. Export them before ever removing it.
for (const coll of ['monthlystats']) {
  const exists = (await db.listCollections({ name: coll }).toArray()).length;
  if (!exists) { console.log(`ok      ${coll} absent`); continue; }
  console.log(`DROPCOL ${coll} (${await db.collection(coll).countDocuments()} docs)`);
  if (APPLY) await db.collection(coll).drop();
}

// Backlog for the daily sweep in services/cleanup.service.js: source code of
// failed submissions older than 7 days (only Accepted code is worth keeping).
{
  const filter = { status: { $ne: 'Accepted' }, createdAt: { $lt: new Date(Date.now() - WEEK * 1000) }, code: { $exists: true } };
  const n = await db.collection('codingsubmissions').countDocuments(filter);
  console.log(n ? `UNSET   codingsubmissions.code/errorOutput on ${n} failed docs` : 'ok      codingsubmissions nothing to strip');
  if (APPLY && n) await db.collection('codingsubmissions').updateMany(filter, { $unset: { code: 1, errorOutput: 1 } });
}

await mongoose.disconnect();
console.log(APPLY ? '\nDone.' : '\nDry run complete. Re-run with --apply.');
