import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('fync_notes'));

const User = (await import('../models/user.model.js')).default;
const Note = (await import('../models/note.model.js')).default;
const NoteDownload = (await import('../models/noteDownload.model.js')).default;
const { unlockNote } = await import('./note.controller.js');
await Promise.all([Note.syncIndexes(), NoteDownload.syncIndexes()]);

const mkRes = () => { const o = { code: 0, body: null };
  return { o, res: { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } } }; };
const call = async (userId, noteId) => { const m = mkRes();
  await unlockNote({ params: { id: String(noteId) }, user: { id: String(userId) } }, m.res); return m.o; };
const coinsOf = async (id) => (await User.findById(id).select('coins').lean()).coins;

let phoneSeq = 9000000000;
const mkUser = (name, coins) => User.create({
  name, username: name, email: `${name}@x.com`, password: 'x'.repeat(20),
  college: 'Test College', coins,
  gender: 'Male', major: 'CSE', year: '3', dob: new Date('2004-01-01'),
  mobileNumber: String(++phoneSeq),
});

const author = await mkUser('author', 0);
const reader = await mkUser('reader', 5);
const broke  = await mkUser('broke', 0);

const note = await Note.create({
  uploader: author._id, college: 'Test College', title: 'Trees',
  subject: 'DSA', fileUrl: 'https://r2/notes/trees.pdf',
});

// --- opening is free, and the uploader is thanked once ---
let r = await call(reader._id, note._id);
assert.equal(r.code, 200);
assert.equal(r.body.charged, 0);
assert.equal(r.body.fileUrl, 'https://r2/notes/trees.pdf');
assert.equal(await coinsOf(reader._id), 5, 'reader keeps every coin');
await new Promise((res) => setTimeout(res, 60));   // uploader credit is best-effort
assert.equal(await coinsOf(author._id), 1, 'uploader earned 1 for the share');
console.log('T open: free for the reader, uploader earned 1');

// --- a student with nothing can still read ---
r = await call(broke._id, note._id);
assert.equal(r.code, 200, 'zero coins must not block a download');
assert.equal(r.body.fileUrl, 'https://r2/notes/trees.pdf');
console.log('T zero balance: still gets the file');

// --- reopening does not inflate the counter or pay twice ---
await new Promise((res) => setTimeout(res, 60));
const beforeReopen = await coinsOf(author._id);
r = await call(reader._id, note._id);
assert.equal(r.code, 200);
await new Promise((res) => setTimeout(res, 60));
assert.equal(await coinsOf(author._id), beforeReopen, 'no second reward for a reopen');
assert.equal(await NoteDownload.countDocuments({ user: reader._id, note: note._id }), 1);
console.log('T reopen: counted once, uploader paid once');

// --- author opening their own note is not a download ---
r = await call(author._id, note._id);
assert.equal(r.code, 200);
assert.equal(await NoteDownload.countDocuments({ user: author._id, note: note._id }), 0,
  'your own upload is not a download of it');
console.log('T own upload: opens, not counted');

// --- concurrent opens count exactly once ---
const racer = await mkUser('racer', 0);
const results = await Promise.all(Array.from({ length: 6 }, () => call(racer._id, note._id)));
assert.ok(results.every((x) => x.code === 200), 'all concurrent calls succeed');
assert.equal(await NoteDownload.countDocuments({ user: racer._id, note: note._id }), 1,
  '6 simultaneous opens must record one download');
console.log('T 6 concurrent opens: recorded once');

// --- purged files must not be sold ---
const { purgeExpiredNotes } = await import('../utils/noteCleanup.js');
const old = await Note.create({
  uploader: author._id, college: 'Test College', title: 'Old unit',
  subject: 'DSA', fileUrl: 'https://r2/notes/old.pdf',
  createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
});
await purgeExpiredNotes();
const purged = await Note.findById(old._id).lean();
assert.equal(purged.expired, true, 'older than 7 days is flagged');
assert.equal(purged.fileUrl, '', 'url cleared');

const buyer = await mkUser('buyer', 10);
r = await call(buyer._id, old._id);
assert.equal(r.code, 410, 'expired note refused');
assert.equal(await NoteDownload.countDocuments({ user: buyer._id, note: old._id }), 0,
  'a purged file must not be recorded as downloaded');
console.log('T expired note: 410, nothing recorded');

// A note inside the window is untouched.
const fresh = await Note.create({
  uploader: author._id, college: 'Test College', title: 'Recent',
  subject: 'DSA', fileUrl: 'https://r2/notes/new.pdf',
});
await purgeExpiredNotes();
assert.equal((await Note.findById(fresh._id).lean()).expired, false, 'recent note survives');
console.log('T recent note: survives the purge');

// --- each note runs its own 7-day clock from its own upload ---
const day = 24 * 60 * 60 * 1000;
const ages = { day0: 0, day3: 3, day6: 6, day7: 7.1, day10: 10 };
const aged = {};
for (const [label, n] of Object.entries(ages)) {
  aged[label] = await Note.create({
    uploader: author._id, college: 'Test College', title: label, subject: 'DSA',
    fileUrl: `https://r2/${label}.pdf`, createdAt: new Date(Date.now() - n * day),
  });
}
await purgeExpiredNotes();
const state = {};
for (const [label, n] of Object.entries(aged)) state[label] = (await Note.findById(n._id).lean()).expired;

assert.equal(state.day0, false);
assert.equal(state.day3, false);
assert.equal(state.day6, false, 'six days old is still inside its window');
assert.equal(state.day7, true, 'past its own seventh day');
assert.equal(state.day10, true);
// The point: one run of the purge leaves some live and takes others, decided
// per note by its own upload time rather than by when the job happens to run.
console.log('T per-note clock:', JSON.stringify(state));

// Storage is what this is for: the R2 URL goes only for the expired ones.
assert.ok((await Note.findById(aged.day0._id).lean()).fileUrl.length > 0);
assert.equal((await Note.findById(aged.day10._id).lean()).fileUrl, '');
console.log('T file URL cleared for expired only');

// --- the same file cannot be shared twice in one college ---
const hash = 'a'.repeat(64);
await Note.create({ uploader: author._id, college: 'Test College', title: 'Unit 3',
  subject: 'DSA', fileUrl: 'https://r2/notes/u3.pdf', fileHash: hash });

let dup = null;
try {
  // Same bytes, different name and different uploader — exactly how a
  // duplicate actually arrives.
  await Note.create({ uploader: reader._id, college: 'Test College', title: 'unit3final',
    subject: 'DSA', fileUrl: 'https://r2/notes/u3copy.pdf', fileHash: hash });
} catch (err) { dup = err; }
assert.equal(dup?.code, 11000, 'duplicate hash in the same college must be rejected');
console.log('T duplicate file: rejected by the index');

// Another college sharing the same paper is a separate, useful listing.
await Note.create({ uploader: author._id, college: 'Other College', title: 'Unit 3',
  subject: 'DSA', fileUrl: 'https://r2/notes/u3.pdf', fileHash: hash });
console.log('T same file, different college: allowed');

// Once purged, the material can be shared again — the partial index skips
// expired rows, so a dead note does not block the topic forever.
await Note.updateMany({ college: 'Test College', fileHash: hash },
  { $set: { expired: true, fileUrl: '' } });
await Note.create({ uploader: reader._id, college: 'Test College', title: 'Unit 3 again',
  subject: 'DSA', fileUrl: 'https://r2/notes/u3new.pdf', fileHash: hash });
console.log('T re-share after expiry: allowed');

// Notes without a hash (legacy rows) must not collide with each other.
await Note.create({ uploader: author._id, college: 'Test College', title: 'legacy a',
  subject: 'DSA', fileUrl: 'https://r2/a.pdf' });
await Note.create({ uploader: author._id, college: 'Test College', title: 'legacy b',
  subject: 'DSA', fileUrl: 'https://r2/b.pdf' });
console.log('T hashless legacy notes: do not collide');

await mongoose.disconnect(); await mem.stop();
console.log('notes: all assertions passed');
// The Redis client from the import graph keeps retrying and holds the event
// loop open, so the process is ended explicitly rather than left hanging.
process.exit(0);
