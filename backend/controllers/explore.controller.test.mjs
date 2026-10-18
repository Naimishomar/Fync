// Featured row: only joinable items, normalized, mixed across types.
//
// Run: node controllers/explore.controller.test.mjs
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('fync_explore'));

const { default: Hackathon } = await import('../models/hackathon/hackathons.model.js');
const { default: Opportunity } = await import('../models/opportunity.model.js');
const { default: Bootcamp } = await import('../models/events/bootcamp.model.js');
const { default: Speaker } = await import('../models/events/createSpeakerSession.model.js');
const { default: User } = await import('../models/user.model.js');
const { getFeatured } = await import('./explore.controller.js');

const day = 86400000, now = Date.now();
const at = (d) => new Date(now + d * day);
const uid = new mongoose.Types.ObjectId();
await User.collection.insertOne({ _id: uid, name: 'GDG', email: 'o@x.y', username: 'gdg' });

await Hackathon.collection.insertMany([
  { hackathonId: 'h1', title: 'Open Hack', status: 'published', mode: 'Online', prizepool: '50000', bannerImage: 'https://r2/x.webp', hackathonstarts: at(5), hackathonends: at(6), organiser: uid },
  { hackathonId: 'h2', title: 'Ended Hack', status: 'published', hackathonstarts: at(-5), hackathonends: at(-4), organiser: uid },
  { hackathonId: 'h3', title: 'Reg Closed', status: 'published', hackathonstarts: at(5), hackathonends: at(6), registrationends: at(-1), organiser: uid },
  { hackathonId: 'h4', title: 'Draft Hack', status: 'draft', hackathonstarts: at(5), hackathonends: at(6), organiser: uid },
]);
await Opportunity.collection.insertMany([
  { title: 'SDE Intern', company: 'Acme', type: 'internship', isPaid: true, stipend: '10000', location: 'Remote', isActive: true, createdAt: new Date() },
  { title: 'Closed Job', company: 'Acme', type: 'job', isActive: false, createdAt: new Date() },
]);
await Bootcamp.collection.insertMany([
  { eventId: 'b1', eventName: 'Live Camp', college: 'IIT', venue: 'Hall', fee: 499, status: 'open', isCollegeSpecific: false, startDate: at(1), endDate: at(3) },
  { eventId: 'b2', eventName: 'Past Camp', college: 'IIT', venue: 'Hall', status: 'open', startDate: at(-9), endDate: at(-8) },
  { eventId: 'b3', eventName: 'Other College', college: 'NIT', venue: 'Hall', status: 'open', isCollegeSpecific: true, startDate: at(1), endDate: at(3) },
]);
await Speaker.collection.insertMany([
  { eventId: 1, eventName: 'Talk', college: 'IIT', venue: 'Zoom', fee: 0, status: 'open', isCollegeSpecific: false, date: at(2) },
  { eventId: 2, eventName: 'Closed Talk', college: 'IIT', venue: 'Hall', status: 'closed', date: at(2) },
]);

const out = {};
await getFeatured({ user: { id: String(uid), college: 'IIT' } },
  { status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } },
  (e) => { throw e; });

assert.equal(out.code, 200);
const titles = out.body.items.map((i) => i.title).sort();
assert.deepEqual(titles, ['Live Camp', 'Open Hack', 'SDE Intern', 'Talk'], `only joinable items: ${titles}`);
console.log('T excluded: ended/reg-closed/draft/inactive/past/closed/other-college');

const by = Object.fromEntries(out.body.items.map((i) => [i.type, i]));
assert.deepEqual(Object.keys(by).sort(), ['bootcamp', 'hackathon', 'internship', 'speaker']);
assert.deepEqual(by.hackathon.chips, ['Online', 'Prize ₹50,000', 'Register Now']);
assert.equal(by.hackathon.image, 'https://r2/x.webp');
assert.equal(by.hackathon.org, 'GDG');
assert.deepEqual(by.internship.chips, ['Remote', 'Stipend ₹10,000']);
assert.equal(by.internship.org, 'Acme');
assert.deepEqual(by.bootcamp.chips, ['Offline', '₹499', 'Register Now']);
assert.deepEqual(by.speaker.chips, ['Online', 'Free', 'Register Now']);
for (const i of out.body.items) assert.equal(typeof i.id, 'string');
console.log('T normalized + mixed types');

await mongoose.disconnect(); await mem.stop();
console.log('explore: all assertions passed');
process.exit(0);
