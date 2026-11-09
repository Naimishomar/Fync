// End to end over real sockets + Redis (db 15) + in-memory Mongo (for blocks).
// Run: REDIS_URL=redis://localhost:6379/15 node controllers/listen.socket.test.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';

process.env.REDIS_URL ||= 'redis://localhost:6379/15';
const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri('fync_listen'));
const { default: redis } = await import('../utils/redis.js');
const { default: User } = await import('../models/user.model.js');
const { setListenIo } = await import('./listen.socket.js');
for (let i = 0; i < 50 && !redis.isReady; i++) await new Promise((r) => setTimeout(r, 100));
assert.ok(redis.isReady, 'local redis');
await redis.flushDb();

const ids = { a: new mongoose.Types.ObjectId(), b: new mongoose.Types.ObjectId(), c: new mongoose.Types.ObjectId() };
await User.collection.insertMany([
  { _id: ids.a, name: 'A', blockedUsers: [ids.c] }, { _id: ids.b, name: 'B' }, { _id: ids.c, name: 'C' },
]);

const server = http.createServer();
const io = new Server(server);
io.use((s, next) => { s.userId = s.handshake.auth.userId; s.join(`user:${s.userId}`); next(); });
setListenIo(io);
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}`;

const client = (who) => new Promise((res) => {
  const s = connect(url, { auth: { userId: String(ids[who]) }, transports: ['websocket'], forceNew: true });
  s.states = [];
  s.on('lt:state', (st) => s.states.push(st));
  s.on('connect', () => res(s));
});
const ack = (s, ev, p = {}) => s.timeout(3000).emitWithAck(ev, p);
const nextState = (s, pred = () => true) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('no state')), 3000);
  const on = (st) => { if (pred(st)) { clearTimeout(t); s.off('lt:state', on); res(st); } };
  s.on('lt:state', on);
});
const T = { id: 'AK3w5q0', title: 'Song', artist: 'X', duration: 120 };

const A = await client('a');
const B = await client('b');

// Create + join.
const made = await ack(A, 'lt:create', { name: 'A' });
assert.ok(made.ok && /^[A-Z0-9]{6}$/.test(made.state.code));
const code = made.state.code;
const joinedSeenByA = nextState(A, (st) => st.members.length === 2);
const joined = await ack(B, 'lt:join', { code: code.toLowerCase(), name: 'B' });
assert.ok(joined.ok); assert.equal(joined.state.members.length, 2);
assert.deepEqual((await joinedSeenByA).online.sort(), [String(ids.a), String(ids.b)].sort());
assert.equal((await ack(B, 'lt:join', { code, name: 'B' })).ok, true, 'rejoin same room is idempotent');
assert.equal((await ack(B, 'lt:join', { code, name: 'B' })).state.members.length, 2);

// Bad / blocked joins.
assert.equal((await ack(B, 'lt:join', { code: 'ZZZZZZ' })).ok, false);
const C = await client('c');
const cj = await ack(C, 'lt:join', { code, name: 'C' });
assert.equal(cj.ok, false); assert.match(cj.error, /can't join/);

// Anyone controls playback; both phones get the same state.
const room = made.state.id;
const playingOnB = nextState(B, (st) => st.track?.id === T.id && st.playing);
assert.ok((await ack(A, 'lt:action', { roomId: room, type: 'queue', track: T })).ok);
const st1 = await playingOnB;
const pausedOnA = nextState(A, (st) => st.track && !st.playing);
assert.ok((await ack(B, 'lt:action', { roomId: room, type: 'pause' })).ok);
const st2 = await pausedOnA;
assert.ok(st2.version > st1.version);

// Non-members and wrong room ids are refused.
assert.equal((await ack(C, 'lt:action', { roomId: room, type: 'play' })).ok, false);
assert.equal((await ack(A, 'lt:action', { roomId: 'nope', type: 'play' })).ok, false);
assert.equal((await ack(A, 'lt:action', { roomId: room, type: 'queue', track: { id: '../etc', duration: 5 } })).ok, false);

// Disconnect keeps membership; reconnect + resume returns the room.
const offline = nextState(A, (st) => st.online.length === 1);
B.disconnect();
assert.deepEqual((await offline).online, [String(ids.a)]);
const B2 = await client('b');
const back = await ack(B2, 'lt:resume', {});
assert.ok(back.ok && back.state?.id === room); assert.equal(back.state.members.length, 2);

// Rate limit: a runaway loop gets cut off, real taps don't.
await new Promise((r) => setTimeout(r, 2100)); // fresh 2s window
let refused = 0;
for (let i = 0; i < 10; i++) if (!(await ack(A, 'lt:action', { roomId: room, type: 'seek', ms: i * 1000 })).ok) refused++;
assert.ok(refused >= 1 && refused <= 3, `rate limit kicked in (${refused})`);

// Leaving: last one out deletes the room and its code.
const aLeft = nextState(B2, (st) => st.members.length === 1);
assert.ok((await ack(A, 'lt:leave')).ok);
await aLeft;
assert.equal((await ack(A, 'lt:resume')).state, null);
assert.ok((await ack(B2, 'lt:leave')).ok);
assert.equal(await redis.exists(`lt:room:${room}`), 0);
assert.equal(await redis.exists(`lt:code:${code}`), 0);
assert.equal((await ack(C, 'lt:join', { code })).ok, false, 'dead code');

// One room per user: creating a new one leaves the old.
const r1 = await ack(A, 'lt:create', {});
await ack(B2, 'lt:join', { code: r1.state.code });
const r2 = await ack(B2, 'lt:create', {});
assert.notEqual(r2.state.id, r1.state.id);
const old = JSON.parse(await redis.get(`lt:room:${r1.state.id}`));
assert.deepEqual(old.members.map((m) => m.userId), [String(ids.a)]);

for (const s of [A, B2, C]) s.disconnect();
io.close(); server.close();
await redis.flushDb();
await mongoose.disconnect(); await mem.stop();
console.log('listen socket tests passed');
process.exit(0);
