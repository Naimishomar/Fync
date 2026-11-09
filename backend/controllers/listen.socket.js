import { customAlphabet } from "nanoid";
import redisClient from "../utils/redis.js";
import { isBlockedPair } from "./safety.controller.js";
import { MAX_MEMBERS, applyAction, newRoom, publicState, settle } from "../utils/listenRules.js";

/**
 * Listen Together: friends in one room hear the same Audius song at the same
 * moment, and anyone in the room can play, pause, seek, skip or queue.
 *
 * Sync model: the server stores (track, position, anchorAt, playing); each
 * client measures its clock offset with lt:time and plays at
 * position + (serverNow - anchorAt). Clients correct drift themselves, so the
 * server never streams timestamps. Rules and their tests: utils/listenRules.js.
 *
 * Membership is persistent (survives reconnects and app restarts) until the
 * member leaves; who is *online* is just who has a socket in the io room.
 *
 *   lt:room:<id>    JSON room state, TTL refreshed on every write
 *   lt:code:<code>  -> room id (invite code)
 *   lt:user:<uid>   -> room id (one room per user)
 *
 * All handlers use socket.io acks: cb({ ok, state }) or cb({ ok: false, error }).
 */

const ROOM_TTL = 6 * 60 * 60;
const newCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const newId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const newKey = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

const roomKey = (id) => `lt:room:${id}`;
const codeKey = (code) => `lt:code:${code}`;
const userKey = (uid) => `lt:user:${uid}`;
const ioRoom = (id) => `lt:${id}`;

const getRoom = async (id) => {
  const raw = id && await redisClient.get(roomKey(id));
  return raw ? JSON.parse(raw) : null;
};
const saveRoom = (room) => redisClient.multi()
  .set(roomKey(room.id), JSON.stringify(room), { EX: ROOM_TTL })
  .expire(codeKey(room.code), ROOM_TTL)
  .exec();

// ponytail: in-process per-room lock (PM2 runs one instance). Read-modify-write
// on the room JSON must not interleave, or two taps lose one. Cluster mode
// would need a Redis lock (SET NX) here instead.
const locks = new Map();
const withRoomLock = (id, fn) => {
  const prev = locks.get(id) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  locks.set(id, tail);
  tail.then(() => { if (locks.get(id) === tail) locks.delete(id); });
  return run;
};

// Display only; identity is always socket.userId.
const profileOf = (socket, p) => ({
  userId: String(socket.userId),
  name: String(p?.name || "").slice(0, 60),
  username: String(p?.username || "").slice(0, 40),
  avatar: typeof p?.avatar === "string" ? p.avatar.slice(0, 500) : "",
});

export const setListenIo = (io) => {
  const onlineOf = async (id) => {
    const sockets = await io.in(ioRoom(id)).fetchSockets();
    return [...new Set(sockets.map((s) => String(s.userId)))];
  };
  const broadcast = async (room) => {
    io.to(ioRoom(room.id)).emit("lt:state", publicState(room, Date.now(), await onlineOf(room.id)));
  };

  /** Remove a member; last one out deletes the room. Caller holds the lock. */
  const removeMember = async (room, uid) => {
    room.members = room.members.filter((m) => m.userId !== uid);
    await redisClient.del(userKey(uid));
    if (!room.members.length) {
      await redisClient.multi().del(roomKey(room.id)).del(codeKey(room.code)).exec();
      return null;
    }
    room.version += 1;
    room.updatedAt = Date.now();
    await saveRoom(room);
    return room;
  };

  /** Leave whatever room this user is in (switching rooms, or explicit leave). */
  const leaveCurrent = async (uid) => {
    const id = await redisClient.get(userKey(uid));
    if (!id) return;
    await withRoomLock(id, async () => {
      const room = await getRoom(id);
      if (!room) return redisClient.del(userKey(uid));
      const left = await removeMember(room, uid);
      // Every socket of this user leaves the io room (other phones too).
      io.in(`user:${uid}`).socketsLeave(ioRoom(id));
      if (left) await broadcast(left);
    });
  };

  io.on("connection", (socket) => {
    const lastActions = [];

    const handler = (fn) => async (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (!socket.userId) return reply({ ok: false, error: "Please log in again." });
      if (!redisClient.isReady) return reply({ ok: false, error: "Listening is unavailable right now. Try again soon." });
      try {
        await fn(payload || {}, reply);
      } catch (e) {
        console.error("Listen socket error:", e);
        reply({ ok: false, error: "Something went wrong. Try again." });
      }
    };

    const enter = async (room, reply) => {
      socket.join(ioRoom(room.id));
      reply({ ok: true, state: publicState(room, Date.now(), await onlineOf(room.id)) });
      await broadcast(room); // others see the new person / online dot
    };

    // Clock sync: client measures RTT and offset from this.
    socket.on("lt:time", (_p, cb) => { if (typeof cb === "function") cb(Date.now()); });

    socket.on("lt:create", handler(async (p, reply) => {
      const uid = String(socket.userId);
      await leaveCurrent(uid);
      const now = Date.now();
      let code;
      // Codes are short: retry on the rare collision instead of overwriting a live room.
      for (let i = 0; i < 5 && !code; i++) {
        const c = newCode();
        if (await redisClient.set(codeKey(c), "pending", { NX: true, EX: ROOM_TTL })) code = c;
      }
      if (!code) return reply({ ok: false, error: "Could not create a room. Try again." });
      const room = newRoom({ id: newId(), code, host: profileOf(socket, p), now });
      await redisClient.multi()
        .set(codeKey(code), room.id, { EX: ROOM_TTL })
        .set(roomKey(room.id), JSON.stringify(room), { EX: ROOM_TTL })
        .set(userKey(uid), room.id, { EX: ROOM_TTL })
        .exec();
      await enter(room, reply);
    }));

    socket.on("lt:join", handler(async (p, reply) => {
      const uid = String(socket.userId);
      const code = String(p.code || "").trim().toUpperCase();
      const id = /^[A-Z0-9]{6}$/.test(code) ? await redisClient.get(codeKey(code)) : null;
      if (!id || id === "pending") return reply({ ok: false, error: "That code doesn't work. Ask your friend for theirs again." });

      // Already in another room: leave it first (outside this room's lock).
      const current = await redisClient.get(userKey(uid));
      if (current && current !== id) await leaveCurrent(uid);

      await withRoomLock(id, async () => {
        const room = await getRoom(id);
        if (!room) return reply({ ok: false, error: "This session has ended." });
        if (!room.members.some((m) => m.userId === uid)) {
          if (room.members.length >= MAX_MEMBERS) return reply({ ok: false, error: `This session is full (${MAX_MEMBERS} people).` });
          for (const m of room.members) {
            if (await isBlockedPair(uid, m.userId)) return reply({ ok: false, error: "You can't join this session." });
          }
          room.members.push(profileOf(socket, p));
          room.version += 1;
        }
        settle(room, Date.now());
        await saveRoom(room);
        await redisClient.set(userKey(uid), room.id, { EX: ROOM_TTL });
        await enter(room, reply);
      });
    }));

    // Reopening the screen / reconnecting: back into my room if I'm still a member.
    socket.on("lt:resume", handler(async (_p, reply) => {
      const uid = String(socket.userId);
      const id = await redisClient.get(userKey(uid));
      if (!id) return reply({ ok: true, state: null });
      await withRoomLock(id, async () => {
        const room = await getRoom(id);
        if (!room || !room.members.some((m) => m.userId === uid)) {
          await redisClient.del(userKey(uid));
          return reply({ ok: true, state: null });
        }
        if (settle(room, Date.now())) await saveRoom(room);
        await enter(room, reply);
      });
    }));

    socket.on("lt:action", handler(async (p, reply) => {
      const uid = String(socket.userId);
      // 8 actions per 2s per socket: plenty for people, stops a stuck loop.
      const now = Date.now();
      while (lastActions.length && now - lastActions[0] > 2000) lastActions.shift();
      if (lastActions.length >= 8) return reply({ ok: false, error: "Slow down a little." });
      lastActions.push(now);

      const id = await redisClient.get(userKey(uid));
      if (!id || id !== p.roomId) return reply({ ok: false, error: "You're not in this session anymore." });
      await withRoomLock(id, async () => {
        const room = await getRoom(id);
        if (!room || !room.members.some((m) => m.userId === uid)) return reply({ ok: false, error: "This session has ended." });
        const res = applyAction(room, p, Date.now(), { newKey, userId: uid });
        if (res.error) return reply({ ok: false, error: res.error });
        if (res.changed) {
          await saveRoom(room);
          await broadcast(room);
        }
        reply({ ok: true });
      });
    }));

    socket.on("lt:leave", handler(async (_p, reply) => {
      await leaveCurrent(String(socket.userId));
      reply({ ok: true });
    }));

    // Dropping offline keeps membership (they can come back); others just see the dot go grey.
    socket.on("disconnecting", () => {
      const ids = [...socket.rooms].filter((r) => r.startsWith("lt:")).map((r) => r.slice(3));
      if (!ids.length || !redisClient.isReady) return;
      setTimeout(() => {
        ids.forEach((id) => getRoom(id).then((room) => room && broadcast(room)).catch(() => {}));
      }, 500); // after socket.io has removed this socket from the room
    });
  });
};
