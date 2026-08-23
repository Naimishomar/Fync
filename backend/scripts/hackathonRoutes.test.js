// End-to-end HTTP test of the hackathon listing routes, against a throwaway
// in-memory MongoDB.
//
// Fync hosts the listing, not the hackathon: students are handed off to the
// organiser's own registration link, and the only thing that comes back is the
// winner list the organiser tags afterwards. So this walks that lifecycle —
// create with an apply link, list, read, update, close, tag winners, delete —
// plus the authorisation edges that keep one organiser out of another's listing.
//
// Redis is deliberately NOT required. Every route here must still answer when
// Redis is unreachable, since that is exactly the outage that took the whole
// hub down.
//
// Run: node scripts/hackathonRoutes.test.js [--verbose]
import 'dotenv/config.js';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

const VERBOSE = process.argv.includes('--verbose');
process.env.JWT_SECRET ||= 'hackathon-route-test-secret';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_hack_routes'));

const { default: User } = await import('../models/user.model.js');
const { default: Notification } = await import('../models/notification.model.js');
const mkUser = (name, n) => ({
  name,
  username: name.toLowerCase(),
  email: `${name.toLowerCase()}@test.dev`,
  mobileNumber: `90000000${n}`,
  password: 'x',
  dob: new Date('2003-01-01'),
  college: 'Test Institute of Technology',
  year: '3',
  gender: 'Other',
  major: 'CSE',
  skills: ['react'],
});
const [organiser, rival, winnerA, winnerB] = await User.create([
  mkUser('Organiser', 1),
  mkUser('Rival', 2),
  mkUser('WinnerA', 3),
  mkUser('WinnerB', 4),
]);

const tokenFor = (u) => jwt.sign({ id: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
const TOKENS = {
  organiser: tokenFor(organiser),
  rival: tokenFor(rival),
  winnerA: tokenFor(winnerA),
};

// ── mount the real router, nothing else ─────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/hackathons', (await import('../routes/hackathon/hackathon.route.js')).default);

// Surface handler errors as 500 with the message, the way the real app does.
app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));

const server = app.listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

// ── runner ──────────────────────────────────────────────────────────────────
const results = [];

const call = async (method, path, { as = 'organiser', body, expect = 200 } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKENS[as]}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }

  const want = Array.isArray(expect) ? expect : [expect];
  const ok = want.includes(res.status);
  results.push({ ok, label: `${method} ${path}`, as, status: res.status, want: want.join('/'), message: json.message });
  if (VERBOSE || !ok) {
    console.log(`${ok ? '  ok ' : '  FAIL'} ${method} ${path} [${as}] -> ${res.status}` +
      (ok ? '' : ` (wanted ${want.join('/')})`) + (json.message ? ` :: ${json.message}` : ''));
  }
  return json;
};

const check = (label, ok, detail = '') => {
  results.push({ ok, label, as: '-', status: ok ? 'pass' : 'fail', want: 'pass', message: detail });
  if (VERBOSE || !ok) console.log(`${ok ? '  ok ' : '  FAIL'} ${label}${detail ? ` :: ${detail}` : ''}`);
};

const day = 24 * 60 * 60 * 1000;
const now = Date.now();
const baseListing = {
  title: 'Route Test Hack',
  registrationends: new Date(now + day),
  hackathonstarts: new Date(now - day),
  hackathonends: new Date(now + 7 * day),
  prizepool: '₹1,00,000',
  prizes: [{ rank: 1, title: 'Winner', amount: '₹50,000' }],
  tags: ['ai', 'web'],
  mode: 'Hybrid',
  location: 'Bengaluru',
  teamSize: '2-4',
};

// ── 1. create ───────────────────────────────────────────────────────────────
console.log('\n[1] create listing');

// The apply link IS the product — a listing without one is a dead end.
await call('POST', '/hackathons', { expect: 400, body: { ...baseListing } });
await call('POST', '/hackathons', { expect: 400, body: { ...baseListing, applyLink: 'not a url' } });

// A bare domain must still work: hosts paste "unstop.com/x" constantly.
const created = await call('POST', '/hackathons', {
  expect: 201,
  body: { ...baseListing, applyLink: 'unstop.com/hackathon/route-test', applyLabel: 'Register on Unstop' },
});
const hackId = created.hackathon?._id;
check('apply link gets an https scheme', created.hackathon?.applyLink === 'https://unstop.com/hackathon/route-test', created.hackathon?.applyLink);
check('organiser is the caller', created.hackathon?.organiser === organiser._id.toString());

// Nothing about registration state is ours to accept from the client.
const forged = await call('POST', '/hackathons', {
  expect: 201,
  body: { ...baseListing, applyLink: 'https://example.com/x', status: 'completed', winners: [{ rank: 1, users: [winnerA._id] }] },
});
// The listing runs from yesterday to next week, so the honest answer is
// "active" no matter what the client asked for.
check('client cannot forge status on create', forged.hackathon?.status === 'published', forged.hackathon?.status);
const forgedDetail = await call('GET', `/hackathons/${forged.hackathon._id}`);
check('a forged "completed" still derives as active', forgedDetail.hackathon?.status === 'active', forgedDetail.hackathon?.status);
check('client cannot forge winners on create', (forged.hackathon?.winners ?? []).length === 0);
await call('DELETE', `/hackathons/${forged.hackathon._id}`);

// ── 2. read ─────────────────────────────────────────────────────────────────
console.log('\n[2] read');
const listed = await call('POST', '/hackathons/list', { as: 'rival', body: { limit: 20 } });
check('listing is public to other students', (listed.hackathons ?? []).some((h) => h._id === hackId));

const detail = await call('GET', `/hackathons/${hackId}`, { as: 'rival' });
check('detail carries the apply link', detail.hackathon?.applyLink?.startsWith('https://'), detail.hackathon?.applyLink);
check('detail carries the apply label', detail.hackathon?.applyLabel === 'Register on Unstop');

// Eligibility round-trip. An empty list is the "open to all" answer, so it has
// to survive as an empty list rather than being dropped or coerced.
const targeted = await call('POST', '/hackathons', {
  expect: 201,
  body: {
    ...baseListing,
    title: 'Targeted Hack',
    applyLink: 'https://example.com/t',
    eligibility: { colleges: ['KIET Group of Institutions'], Year: ['2027', '2028'], branch: [] },
  },
});
const targetedDetail = await call('GET', `/hackathons/${targeted.hackathon._id}`, { as: 'rival' });
const elig = targetedDetail.hackathon?.eligibility ?? {};
check('selected colleges round-trip', elig.colleges?.[0] === 'KIET Group of Institutions', JSON.stringify(elig.colleges));
check('selected batches round-trip', elig.Year?.join(',') === '2027,2028', JSON.stringify(elig.Year));
check('"all branches" stays an empty list', Array.isArray(elig.branch) && elig.branch.length === 0, JSON.stringify(elig.branch));
await call('DELETE', `/hackathons/${targeted.hackathon._id}`);


// ── 2b. lifecycle filters ───────────────────────────────────────────────────
// The Live / Upcoming / Ended filters used to read a hand-set field nobody
// ever updated, so Live matched nothing. They are date windows now, and this
// is the check that they actually select the right rows.
console.log('\n[2b] lifecycle filters');

const seed = async (label, starts, ends) =>
  (await call('POST', '/hackathons', {
    expect: 201,
    body: { ...baseListing, title: label, applyLink: 'https://example.com/x', hackathonstarts: starts, hackathonends: ends },
  })).hackathon;

const past = await seed('Ended Hack', new Date(now - 9 * day), new Date(now - 2 * day));
const live = await seed('Live Hack', new Date(now - day), new Date(now + day));
const soon = await seed('Upcoming Hack', new Date(now + 3 * day), new Date(now + 5 * day));
const later = await seed('Much Later Hack', new Date(now + 30 * day), new Date(now + 32 * day));

const titlesFor = async (status) => {
  const r = await call('POST', '/hackathons/list', { as: 'rival', body: { status, limit: 50 } });
  return (r.hackathons ?? []).map((h) => h.title);
};

const liveTitles = await titlesFor('active');
check('Live returns the running one', liveTitles.includes('Live Hack'), liveTitles.join(', '));
check('Live excludes the ended one', !liveTitles.includes('Ended Hack'));
check('Live excludes the future one', !liveTitles.includes('Upcoming Hack'));

const upcomingTitles = await titlesFor('upcoming');
check('Upcoming returns future ones', upcomingTitles.includes('Upcoming Hack') && upcomingTitles.includes('Much Later Hack'));
check('Upcoming excludes the running one', !upcomingTitles.includes('Live Hack'));
check('Upcoming is ordered soonest first',
  upcomingTitles.indexOf('Upcoming Hack') < upcomingTitles.indexOf('Much Later Hack'), upcomingTitles.join(', '));

const endedTitles = await titlesFor('completed');
check('Ended returns the finished one', endedTitles.includes('Ended Hack'), endedTitles.join(', '));
check('Ended excludes the running one', !endedTitles.includes('Live Hack'));

// The derived value has to come back on the wire too — the card reads it.
const liveRow = (await call('POST', '/hackathons/list', { as: 'rival', body: { status: 'active', limit: 50 } }))
  .hackathons.find((h) => h.title === 'Live Hack');
check('list carries the derived status', liveRow?.status === 'active', liveRow?.status);
const endedDetail = await call('GET', `/hackathons/${past._id}`, { as: 'rival' });
check('detail carries the derived status', endedDetail.hackathon?.status === 'completed', endedDetail.hackathon?.status);

// Publishing is the only thing an organiser sets by hand now.
await call('PATCH', `/hackathons/${live._id}/status`, { expect: 400, body: { status: 'completed' } });
await call('PATCH', `/hackathons/${live._id}/status`, { body: { status: 'draft' } });
const hiddenFrom = await titlesFor('active');
check('a hidden listing leaves discovery', !hiddenFrom.includes('Live Hack'), hiddenFrom.join(', '));
const draftDetail = await call('GET', `/hackathons/${live._id}`);
check('a hidden listing reports draft', draftDetail.hackathon?.status === 'draft' && draftDetail.hackathon?.isDraft === true);
await call('PATCH', `/hackathons/${live._id}/status`, { body: { status: 'published' } });
const backTitles = await titlesFor('active');
check('publishing puts it back under Live', backTitles.includes('Live Hack'), backTitles.join(', '));

for (const h of [past, live, soon, later]) await call('DELETE', `/hackathons/${h._id}`);

// ── 3. update — only the organiser ──────────────────────────────────────────
console.log('\n[3] update');
await call('PATCH', `/hackathons/${hackId}`, { as: 'rival', expect: 403, body: { title: 'Hijacked' } });
await call('PATCH', `/hackathons/${hackId}`, { expect: 400, body: { applyLink: 'nonsense' } });

const patched = await call('PATCH', `/hackathons/${hackId}`, {
  body: { title: 'Route Test Hack v2', applyLink: 'https://forms.gle/abc123', winners: [{ rank: 1, users: [rival._id] }] },
});
check('title updated', patched.hackathon?.title === 'Route Test Hack v2');
check('generic update cannot write winners', (patched.hackathon?.winners ?? []).length === 0);

await call('PATCH', `/hackathons/${hackId}/status`, { expect: 400, body: { status: 'judging' } });
await call('PATCH', `/hackathons/${hackId}/status`, { as: 'rival', expect: 403, body: { status: 'draft' } });

// ── 4. winners ──────────────────────────────────────────────────────────────
console.log('\n[4] winners');
await call('PATCH', `/hackathons/${hackId}/winners`, { as: 'rival', expect: 403, body: { winners: [] } });
await call('PATCH', `/hackathons/${hackId}/winners`, { expect: 400, body: { winners: 'first place' } });

const announced = await call('PATCH', `/hackathons/${hackId}/winners`, {
  body: {
    winners: [
      { rank: 1, title: 'Winner', amount: '₹50,000', teamName: 'Team Fync', users: [winnerA._id, winnerB._id], projectLink: 'https://github.com/x' },
      { rank: 2, title: 'Runner up', teamName: 'Offline Team', users: [] },
    ],
  },
});
check('two winner rows saved', (announced.winners ?? []).length === 2);
check('tagged users are populated', !!announced.winners?.[0]?.users?.[0]?.name, JSON.stringify(announced.winners?.[0]?.users?.[0] ?? {}));
check('a row with no Fync accounts still keeps its team name', announced.winners?.[1]?.teamName === 'Offline Team');

const notified = await Notification.countDocuments({ hackathon: hackId, type: 'hackathon_announcement' });
check('both tagged students were notified', notified === 2, `got ${notified}`);

// Re-saving the same list is how an organiser fixes a typo. It must not
// re-notify everyone who was already tagged.
await call('PATCH', `/hackathons/${hackId}/winners`, {
  body: {
    winners: [
      { rank: 1, title: 'Winner', amount: '₹50,000', teamName: 'Team Fync (fixed)', users: [winnerA._id, winnerB._id] },
    ],
  },
});
const afterEdit = await Notification.countDocuments({ hackathon: hackId, type: 'hackathon_announcement' });
check('editing the list does not re-notify', afterEdit === 2, `got ${afterEdit}`);

// ── 5. my hackathons ────────────────────────────────────────────────────────
console.log('\n[5] my hackathons');
const mine = await call('GET', '/hackathons/my');
check('organiser sees it as organiser', mine.hackathons?.find((h) => h._id === hackId)?.myRole === 'organiser');

const won = await call('GET', '/hackathons/my', { as: 'winnerA' });
const wonRow = won.hackathons?.find((h) => h._id === hackId);
check('a tagged winner sees it in theirs', !!wonRow, `${won.hackathons?.length ?? 0} rows`);
check('winner row is labelled', wonRow?.myRole === 'winner' && wonRow?.myWin?.rank === 1, JSON.stringify(wonRow?.myWin ?? {}));

const rivalMine = await call('GET', '/hackathons/my', { as: 'rival' });
check('an untagged student sees nothing', (rivalMine.hackathons ?? []).length === 0);

// ── 6. delete ───────────────────────────────────────────────────────────────
console.log('\n[6] delete');
await call('DELETE', `/hackathons/${hackId}`, { as: 'rival', expect: 403 });
await call('DELETE', `/hackathons/${hackId}`);
await call('GET', `/hackathons/${hackId}`, { expect: 404 });

// ── report ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('\nFailures:');
  failed.forEach((f) => console.log(`  ${f.label} [${f.as}] -> ${f.status} (wanted ${f.want})${f.message ? ` :: ${f.message}` : ''}`));
}

await server.close();
await mongoose.disconnect();
await mongod.stop();
process.exit(failed.length ? 1 : 0);
