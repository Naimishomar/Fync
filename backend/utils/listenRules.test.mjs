import assert from 'node:assert/strict';
import { newRoom, applyAction, positionAt, settle, cleanTrack, MAX_QUEUE } from './listenRules.js';

let k = 0;
const opts = { newKey: () => `k${++k}`, userId: 'u1' };
const T = (id, duration = 100) => ({ id, title: id, artist: 'a', duration });
const room = () => newRoom({ id: 'r', code: 'ABC123', host: { userId: 'u1' }, now: 0 });

// Validation: junk ids/durations never reach state.
assert.equal(cleanTrack({ id: '../x', duration: 10 }), null);
assert.equal(cleanTrack({ id: 'abc', duration: 0 }), null);
assert.equal(cleanTrack({ id: 'abc', duration: 99999 }), null);
assert.equal(cleanTrack({ id: 'abc', duration: 10, artwork: 'http://evil' }, 'k').artwork, null);

// Play, then the playhead moves with time; pause freezes it.
let r = room();
assert.ok(applyAction(r, { type: 'play', track: T('a') }, 1000, opts).changed);
assert.equal(positionAt(r, 6000), 5000);
applyAction(r, { type: 'pause' }, 6000, opts);
assert.equal(positionAt(r, 60000), 5000, 'paused: frozen');
applyAction(r, { type: 'play' }, 60000, opts);
assert.equal(positionAt(r, 61000), 6000, 'resume from where it paused');

// Seek clamps into the track.
applyAction(r, { type: 'seek', ms: 999999 }, 62000, opts);
assert.ok(positionAt(r, 62000) < 100000);
applyAction(r, { type: 'seek', ms: -5 }, 62000, opts);
assert.equal(positionAt(r, 62000), 0);

// Queue: with nothing playing, queueing plays immediately.
r = room();
applyAction(r, { type: 'queue', track: T('a', 10) }, 0, opts);
assert.equal(r.track.id, 'a'); assert.equal(r.playing, true); assert.equal(r.queue.length, 0);
applyAction(r, { type: 'queue', track: T('b', 10) }, 1000, opts);
applyAction(r, { type: 'queue', track: T('c', 10) }, 1000, opts);
assert.deepEqual(r.queue.map((q) => q.id), ['b', 'c']);

// Lazy advance: 25s later, a finished, b finished at 20s, c is 5s in. No timers.
const v = r.version;
assert.ok(settle(r, 25000));
assert.equal(r.track.id, 'c'); assert.equal(positionAt(r, 25000), 5000);
assert.ok(r.version > v, 'settle bumps version so clients apply it');
// Everything ends: stop paused at the end, don't loop.
settle(r, 60000);
assert.equal(r.playing, false); assert.equal(r.track.id, 'c'); assert.equal(positionAt(r, 99999), 10000);
// Play at the end restarts it.
applyAction(r, { type: 'play' }, 70000, opts);
assert.equal(positionAt(r, 70000), 0);

// Double Next from two people skips one song, not two.
r = room();
applyAction(r, { type: 'play', track: T('a') }, 0, opts);
applyAction(r, { type: 'queue', track: T('b') }, 0, opts);
applyAction(r, { type: 'queue', track: T('c') }, 0, opts);
const seen = r.track.key;
applyAction(r, { type: 'next', trackKey: seen }, 100, opts);
const second = applyAction(r, { type: 'next', trackKey: seen }, 120, opts);
assert.equal(second.changed, false); assert.equal(r.track.id, 'b');

// Unqueue/jump by key: stale keys are harmless no-ops.
const cKey = r.queue[0].key;
assert.equal(applyAction(r, { type: 'unqueue', key: 'nope' }, 200, opts).changed, false);
applyAction(r, { type: 'jump', key: cKey }, 200, opts);
assert.equal(r.track.id, 'c'); assert.equal(r.queue.length, 0);
assert.equal(applyAction(r, { type: 'jump', key: cKey }, 300, opts).changed, false);

// Queue cap and bad input.
r = room();
applyAction(r, { type: 'play', track: T('a') }, 0, opts);
for (let i = 0; i < MAX_QUEUE; i++) applyAction(r, { type: 'queue', track: T(`q${i}`) }, 0, opts);
assert.ok(applyAction(r, { type: 'queue', track: T('over') }, 0, opts).error);
assert.ok(applyAction(r, { type: 'bogus' }, 0, opts).error);
assert.ok(applyAction(room(), { type: 'play' }, 0, opts).error, 'resume with no track');

// A track ending reaches clients through any action: a stale Next still
// reports the settle as a change so it gets saved and broadcast.
r = room();
applyAction(r, { type: 'play', track: T('a', 10) }, 0, opts);
applyAction(r, { type: 'queue', track: T('b', 10) }, 0, opts);
const aKey = r.track.key;
const late = applyAction(r, { type: 'next', trackKey: aKey }, 10500, opts);
assert.equal(late.changed, true); assert.equal(r.track.id, 'b', 'settled to b, stale Next did not skip b');
assert.equal(Math.round(positionAt(r, 10500)), 500);

// autonext: every phone races to fill silence; exactly one random song wins.
r = room();
const first = applyAction(r, { type: 'autonext', trackKey: '', track: T('x', 30) }, 0, opts);
assert.equal(first.changed, true); assert.equal(r.track.id, 'x');
assert.equal(applyAction(r, { type: 'autonext', trackKey: '', track: T('y', 30) }, 10, opts).changed, false, 'second phone loses');
const xKey = r.track.key;
assert.equal(applyAction(r, { type: 'autonext', trackKey: xKey, track: T('y', 30) }, 5000, opts).changed, false, 'not ended yet');
assert.equal(applyAction(r, { type: 'autonext', trackKey: xKey, track: T('y', 30) }, 29000, opts).changed, true, 'within 2s of the end');
assert.equal(r.track.id, 'y');
// Skip works any time but still only once per track.
const yKey = r.track.key;
applyAction(r, { type: 'autonext', trackKey: yKey, skip: true, track: T('z', 30) }, 30000, opts);
assert.equal(applyAction(r, { type: 'autonext', trackKey: yKey, skip: true, track: T('w', 30) }, 30001, opts).changed, false);
assert.equal(r.track.id, 'z');
// After the end (settled to paused-at-end), autonext still fires.
settle(r, 999999);
assert.equal(applyAction(r, { type: 'autonext', trackKey: r.track.key, track: T('q', 30) }, 999999, opts).changed, true);

console.log('listen rules tests passed');
process.exit(0);
