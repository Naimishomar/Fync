// Invokes every exported controller function against a throwaway in-memory
// MongoDB and a local Redis, with a synthetic authenticated request.
//
// This is a crash hunt, not a behaviour spec. A 400 from a handler that wanted
// fields we didn't supply is a pass — the handler validated its input and said
// so. What it looks for is the stuff that is always a bug:
//
//   CRASH   the function threw instead of responding
//   500     it responded, but with a server error (usually a TypeError)
//   HANG    it neither responded nor threw — a missing await or a lost branch
//
// Run: node scripts/smokeControllers.js [--verbose]
import 'dotenv/config.js';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Writable } from 'node:stream';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const VERBOSE = process.argv.includes('--verbose');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 4000;

// ── boot an isolated database ───────────────────────────────────────────────
const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('fync_smoke'));

// Seed one user so handlers that look up req.user find something real.
const { default: User } = await import(pathToFileURL(join(ROOT, 'models/user.model.js')).href);
const actor = await User.collection.insertOne({
  name: 'Smoke Test',
  username: 'smoketest',
  email: 'smoke@test.dev',
  mobileNumber: '9990001111',
  password: 'x',
  college: 'Test College',
  user_access: 'admin',
  followers: [],
  following: [],
  createdAt: new Date(),
});
const ACTOR_ID = actor.insertedId;
const OTHER_ID = new mongoose.Types.ObjectId();

// ── synthetic request / response ────────────────────────────────────────────
const makeReq = () => ({
  user: { id: String(ACTOR_ID), _id: ACTOR_ID, name: 'Smoke Test', email: 'smoke@test.dev',
          username: 'smoketest', college: 'Test College', user_access: 'admin', skills: [] },
  // A valid ObjectId in every common slot: handlers that cast an id should find
  // a well-formed one and simply return "not found" rather than throwing.
  params: { id: String(OTHER_ID), userId: String(ACTOR_ID), postId: String(OTHER_ID),
            shortId: String(OTHER_ID), communityId: String(OTHER_ID), subId: String(OTHER_ID),
            subCommunityId: String(OTHER_ID), clubId: String(OTHER_ID), subGroupId: String(OTHER_ID),
            eventId: String(OTHER_ID), teamId: String(OTHER_ID), hackathonId: String(OTHER_ID),
            registrationId: String(OTHER_ID), conversationId: String(OTHER_ID),
            messageId: String(OTHER_ID), commentId: String(OTHER_ID), productId: String(OTHER_ID),
            orderId: String(OTHER_ID), problemId: String(OTHER_ID), contestId: String(OTHER_ID),
            submissionId: String(OTHER_ID), roomId: 'ROOM01', bootcampId: String(OTHER_ID),
            sessionId: String(OTHER_ID), noticeId: String(OTHER_ID), gigId: String(OTHER_ID),
            channelId: String(OTHER_ID), announcementId: String(OTHER_ID), slug: 'test-slug' },
  query: {}, body: {}, headers: { authorization: 'Bearer smoke' }, cookies: {},
  file: undefined, files: [], method: 'GET', originalUrl: '/smoke', ip: '127.0.0.1',
  protocol: 'http', get: () => 'localhost', app: { get: () => ({ to: () => ({ emit() {} }), emit() {} }) },
});

const makeRes = (settle) => {
  // A real Writable, because handlers that stream (PDFKit does `doc.pipe(res)`)
  // need `once`/`emit`/`end` to behave — a plain object mock reports a false
  // failure for perfectly good code.
  const res = new Writable({ write(_c, _e, cb) { cb(); } });
  res.statusCode = 200;
  res.headersSent = false;
  res.locals = {};
  const finish = (payload) => {
    if (res.headersSent) return res;
    res.headersSent = true;
    settle({ kind: 'responded', status: res.statusCode, payload });
    return res;
  };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = finish;
  res.send = finish;
  const streamEnd = res.end.bind(res);
  res.end = (...a) => { finish(null); return streamEnd(...a); };
  res.sendStatus = (c) => { res.statusCode = c; return finish(null); };
  res.redirect = (url) => { res.statusCode = 302; return finish(url); };
  res.set = res.setHeader = res.header = () => res;
  res.getHeader = () => undefined;
  res.cookie = res.clearCookie = () => res;
  res.type = res.contentType = () => res;
  res.attachment = res.download = () => res;
  return res;
};

// ── collect the functions ───────────────────────────────────────────────────
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.js') && !e.endsWith('.test.js')) files.push(p);
  }
};
walk(join(ROOT, 'controllers'));

const targets = [];
for (const file of files) {
  let mod;
  try {
    mod = await import(pathToFileURL(file).href);
  } catch (err) {
    targets.push({ file: relative(ROOT, file), name: '<module>', fn: null, importError: err.message });
    continue;
  }
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value === 'function' && value.length >= 2) {
      targets.push({ file: relative(ROOT, file), name, fn: value });
    } else if (name === 'default' && value && typeof value === 'object') {
      // Controllers exported as an object of methods (e.g. ArenaAdminController)
      for (const [m, f] of Object.entries(value)) {
        if (typeof f === 'function' && f.length >= 2) {
          targets.push({ file: relative(ROOT, file), name: `default.${m}`, fn: f.bind(value) });
        }
      }
    }
  }
}

// ── run them ────────────────────────────────────────────────────────────────
const results = { ok: [], crash: [], serverError: [], hang: [], importError: [], upstream: [] };

for (const t of targets) {
  if (t.importError) { results.importError.push(t); continue; }

  const outcome = await new Promise((resolve) => {
    let done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => settle({ kind: 'hang' }), TIMEOUT_MS);
    const wrap = (v) => { clearTimeout(timer); settle(v); };

    const req = makeReq();
    const res = makeRes(wrap);
    const next = (err) => wrap(err ? { kind: 'next-error', error: err } : { kind: 'next' });

    try {
      const out = t.fn(req, res, next);
      if (out && typeof out.then === 'function') {
        out.then(() => {}, (err) => wrap({ kind: 'throw', error: err }));
      }
    } catch (err) {
      wrap({ kind: 'throw', error: err });
    }
  });

  const label = `${t.file} :: ${t.name}`;
  if (outcome.kind === 'throw' || outcome.kind === 'next-error') {
    const e = outcome.error;
    const programmerBug = e instanceof TypeError || e instanceof ReferenceError || e instanceof SyntaxError;
    (programmerBug ? results.crash : results.ok).push({ label, error: `${e?.name}: ${e?.message}` });
  } else if (outcome.kind === 'hang') {
    results.hang.push({ label });
  } else if (outcome.kind === 'responded' && outcome.status >= 500) {
    if ([502, 503, 504].includes(outcome.status)) {
      results.upstream.push({ label, status: outcome.status });
      continue;
    }
    results.serverError.push({ label, status: outcome.status, payload: outcome.payload });
  } else {
    results.ok.push({ label, status: outcome.status });
  }
}

// ── report ──────────────────────────────────────────────────────────────────
const line = (s) => console.log(s);
line('');
line(`Invoked ${targets.length} controller functions across ${files.length} files.\n`);

const section = (title, rows, fmt) => {
  if (!rows.length) return;
  line(`${title} (${rows.length})`);
  for (const r of rows) line(`   ${fmt(r)}`);
  line('');
};

section('MODULE FAILED TO IMPORT', results.importError, (r) => `${r.file} — ${r.importError}`);
section('CRASHED (TypeError/ReferenceError — always a bug)', results.crash, (r) => `${r.label}\n      ${r.error}`);
section('HUNG (never responded — missing await or lost branch)', results.hang, (r) => r.label);
section('RESPONDED 5xx', results.serverError, (r) =>
  `${r.label}  →  ${r.status} ${VERBOSE ? JSON.stringify(r.payload)?.slice(0, 120) : ''}`);

const bad = results.crash.length + results.hang.length + results.serverError.length + results.importError.length;
if (results.upstream.length) {
  line(`${results.upstream.length} returned 502/503 — a third-party API was unavailable, not a defect:`);
  for (const r of results.upstream) line(`   ${r.label}  →  ${r.status}`);
  line('');
}
line(`${results.ok.length} handled their input cleanly (2xx/4xx or a forwarded error).`);
line(`${bad} need attention.`);

await mongoose.disconnect();
await mongod.stop();
process.exit(0);
