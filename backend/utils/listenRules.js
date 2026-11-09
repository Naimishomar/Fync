/**
 * Listen Together: pure room state. The socket layer (controllers/listen.socket.js)
 * loads a room, calls applyAction, saves, broadcasts. No timers anywhere: the
 * playhead is derived from (position, anchorAt, playing), and `settle` advances
 * past finished tracks lazily whenever the room is read or changed. So a room
 * nobody is listening to costs nothing, and a late joiner lands in the right song.
 *
 * Time is server ms. Clients convert with their measured clock offset.
 */

export const MAX_MEMBERS = 8;
export const MAX_QUEUE = 50;
const MAX_TRACK_SECONDS = 30 * 60;
const ID = /^[A-Za-z0-9]{1,20}$/;

/** Client-sent track -> stored track, or null if invalid. `key` makes each queue entry unique. */
export const cleanTrack = (t, key, addedBy) => {
  if (!t || !ID.test(String(t.id))) return null;
  const duration = Math.round(Number(t.duration));
  if (!Number.isFinite(duration) || duration < 1 || duration > MAX_TRACK_SECONDS) return null;
  const artwork = typeof t.artwork === 'string' && /^https:\/\//.test(t.artwork) ? t.artwork.slice(0, 300) : null;
  return {
    key: String(key),
    id: String(t.id),
    title: String(t.title || '').slice(0, 120),
    artist: String(t.artist || '').slice(0, 80),
    artwork,
    duration,
    addedBy: String(addedBy || ''),
  };
};

export const newRoom = ({ id, code, host, now }) => ({
  id, code,
  members: [host],
  track: null,
  queue: [],
  playing: false,
  position: 0,   // ms into `track` at anchorAt
  anchorAt: now,
  version: 1,
  updatedAt: now,
});

/** Where the playhead is at `now`, clamped to the track. */
export const positionAt = (room, now) => {
  if (!room.track) return 0;
  const pos = room.playing ? room.position + (now - room.anchorAt) : room.position;
  return Math.max(0, Math.min(pos, room.track.duration * 1000));
};

const startTrack = (room, track, at) => {
  room.track = track;
  room.position = 0;
  room.anchorAt = at;
  room.playing = !!track;
};

/**
 * Advance past every track that has finished by `now`, carrying the overflow
 * into the next one (anchor at the moment the previous ended, not now). Queue
 * empty: stop at the end of the last track, paused. Returns true if changed.
 */
export const settle = (room, now) => {
  let changed = false;
  while (room.track && room.playing) {
    const endsAt = room.anchorAt + (room.track.duration * 1000 - room.position);
    if (endsAt > now) break;
    changed = true;
    if (room.queue.length) startTrack(room, room.queue.shift(), endsAt);
    else { room.position = room.track.duration * 1000; room.playing = false; room.anchorAt = endsAt; }
  }
  if (changed) room.version += 1; // clients only apply newer versions
  return changed;
};

/**
 * Apply one member action. Mutates and returns { room, changed, error }.
 * action: { type, track?, ms?, key?, trackKey? }, already from a verified member.
 * Every member may control playback; last write wins (version orders them).
 */
export const applyAction = (room, action, now, { newKey, userId } = {}) => {
  // A no-op action can still have advanced finished tracks: report that so the
  // caller saves and broadcasts it (this is how a track ending reaches everyone).
  const settled = settle(room, now);
  const fail = (error) => ({ room, changed: settled, error });
  switch (action?.type) {
    case 'play': {
      if (action.track) {
        const t = cleanTrack(action.track, newKey?.(), userId);
        if (!t) return fail('That song can\'t be played.');
        startTrack(room, t, now);
      } else {
        if (!room.track) return fail('Pick a song first.');
        // Resume at the end of a finished track = play it again from the top.
        const at = positionAt(room, now);
        room.position = at >= room.track.duration * 1000 ? 0 : at;
        room.playing = true;
        room.anchorAt = now;
      }
      break;
    }
    case 'pause': {
      if (!room.track || !room.playing) return { room, changed: settled };
      room.position = positionAt(room, now);
      room.playing = false;
      room.anchorAt = now;
      break;
    }
    case 'seek': {
      if (!room.track) return fail('Nothing is playing.');
      const ms = Number(action.ms);
      if (!Number.isFinite(ms)) return fail('Bad position.');
      room.position = Math.max(0, Math.min(ms, room.track.duration * 1000 - 1));
      room.anchorAt = now;
      break;
    }
    case 'queue': {
      if (room.queue.length >= MAX_QUEUE) return fail(`Queue is full (${MAX_QUEUE} songs).`);
      const t = cleanTrack(action.track, newKey?.(), userId);
      if (!t) return fail('That song can\'t be played.');
      // Nothing playing: queueing just plays it.
      if (!room.track || (!room.playing && positionAt(room, now) >= room.track.duration * 1000)) startTrack(room, t, now);
      else room.queue.push(t);
      break;
    }
    case 'unqueue': {
      const i = room.queue.findIndex((q) => q.key === String(action.key));
      if (i < 0) return { room, changed: settled }; // already gone (someone else removed / it started)
      room.queue.splice(i, 1);
      break;
    }
    case 'jump': {
      // Play a queued song now; songs before it stay queued.
      const i = room.queue.findIndex((q) => q.key === String(action.key));
      if (i < 0) return { room, changed: settled };
      const [t] = room.queue.splice(i, 1);
      startTrack(room, t, now);
      break;
    }
    case 'next': {
      // Only skip the song the sender saw: two people tapping Next at once skip one song, not two.
      if (!room.track || (action.trackKey && action.trackKey !== room.track.key)) return { room, changed: settled };
      if (room.queue.length) startTrack(room, room.queue.shift(), now);
      else { room.position = room.track.duration * 1000; room.playing = false; room.anchorAt = now; }
      break;
    }
    case 'autonext': {
      // A phone picked a random song because the current one ended (or none
      // was playing), or someone tapped skip (`skip: true`). Every phone may
      // send this at the same moment; only the first one for this track wins,
      // because it must name the track it saw (trackKey, '' for none).
      const cur = room.track;
      if (cur) {
        if (action.trackKey !== cur.key) return { room, changed: settled };
        const left = cur.duration * 1000 - positionAt(room, now);
        if (!action.skip && left > 2000) return { room, changed: settled }; // not over yet: early phone, ignore
      } else if (action.trackKey) {
        return { room, changed: settled };
      }
      const t = cleanTrack(action.track, newKey?.(), userId);
      if (!t) return fail('That song can\'t be played.');
      room.queue = [];
      startTrack(room, t, now);
      break;
    }
    default:
      return fail('Unknown action.');
  }
  room.version += 1;
  room.updatedAt = now;
  return { room, changed: true };
};

/** What clients get. `serverNow` lets them check their clock offset on every update. */
export const publicState = (room, now, online = []) => ({
  id: room.id,
  code: room.code,
  members: room.members,
  online,
  track: room.track,
  queue: room.queue,
  playing: room.playing,
  position: room.position,
  anchorAt: room.anchorAt,
  version: room.version,
  serverNow: now,
});
