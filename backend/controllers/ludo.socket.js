import { randomInt } from "node:crypto";
import { customAlphabet } from "nanoid";
import redisClient from "../utils/redis.js";
import { getSocketAcrossCluster } from "../utils/socketCluster.js";
import { isBlockedPair, popNightPartner } from "./safety.controller.js";
import { recordWin } from "../utils/gameWins.js";
import { newGame, roll, move, botPick } from "../utils/ludoRules.js";

/**
 * Ludo: 1v1 random queue, 4-player random queue (bots fill empty seats after
 * 20s once 2+ are waiting), and friends rooms by 6-letter code (2-4 players,
 * host starts). The server rolls every die; clients only send "roll" and
 * "move token t". AFK (3 timeouts) or disconnected players become bots.
 *
 * Redis (any cluster worker can take the next event):
 *   ludo:room:<id>        JSON { mode, players, game, seq, autoSeat, humans, rematch }
 *   ludo:room:<id>:lock   per-room mutex around read-modify-write
 *   ludo:user:<userId>    room the user is in
 *   ludo:code:<code>      friends lobby host id; ludo:code:<code>:m hash userId -> profile
 *   ludo:lobby:<userId>   lobby code the user sits in
 *   queue:ludo:2 / queue:ludo:4
 * `seq` bumps on every state change; timers carry the seq they were set for and
 * do nothing if the game moved on.
 */

const ROOM_TTL = 2 * 60 * 60;
const CODE_TTL = 15 * 60;
const TURN_MS = 15000;
const FILL_MS = 20000;
const BOT_ROLL_MS = 900;
const BOT_MOVE_MS = 700;
const MAX_TIMEOUTS = 3;
const newCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const newRoomId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

const roomKey = (id) => `ludo:room:${id}`;
const userKey = (userId) => `ludo:user:${userId}`;
const codeKey = (code) => `ludo:code:${code}`;
const membersKey = (code) => `ludo:code:${code}:m`;
const lobbyUserKey = (userId) => `ludo:lobby:${userId}`;
const lobbyRoom = (code) => `ludo-lobby:${code}`;
const QUEUES = { 2: "queue:ludo:2", 4: "queue:ludo:4" };
const Q4_LOCK = "ludo:q4lock";

const getRoom = async (id) => {
    const raw = id && await redisClient.get(roomKey(id));
    return raw ? JSON.parse(raw) : null;
};
const saveRoom = (id, room) => redisClient.set(roomKey(id), JSON.stringify(room), { EX: ROOM_TTL });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ponytail: the lock's DEL isn't token-checked; fine while handlers finish well under 3s.
const withLock = async (key, fn, tries = 60) => {
    for (let i = 0; i < tries; i++) {
        if (await redisClient.set(key, "1", { NX: true, PX: 3000 })) {
            try { return await fn(); } finally { await redisClient.del(key); }
        }
        await sleep(50);
    }
    return undefined;
};

const publicUser = (u) => ({ userId: u.userId, name: u.name, username: u.username, avatar: u.avatar });
const publicPlayers = (room) => room.players.map((p) => ({ ...publicUser(p), bot: p.bot, left: p.left }));

const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

export const setLudoIo = (io) => {
    const emitState = (id, room, event, extra = {}) =>
        io.to(id).emit(event, { roomId: id, seq: room.seq, game: room.game, turnMs: TURN_MS, ...extra });

    // Arm the next timer for whoever is to act. Duplicate timers are harmless: seq gates them.
    const schedule = (id, room) => {
        const g = room.game;
        if (g.phase === "over") return;
        const p = room.players[g.turn];
        const auto = p.bot || room.autoSeat === g.turn;
        let delay = TURN_MS + 300;
        if (auto) delay = g.phase === "roll" ? BOT_ROLL_MS : BOT_MOVE_MS;
        else if (g.phase === "move" && g.movable.length === 1) delay = BOT_MOVE_MS; // only one choice: play it
        const seq = room.seq;
        setTimeout(() => tick(id, seq).catch((e) => console.error("Ludo tick error:", e)), delay);
    };

    // Applies one roll or move and persists. Caller holds the room lock.
    const step = async (id, room, token) => {
        const g = room.game;
        const before = g.turn;
        if (g.phase === "roll") {
            const r = roll(g, randomInt(1, 7));
            room.game = r.game;
            room.seq++;
            emitState(id, room, "ludo_rolled", { seat: before, dice: r.dice, forfeit: r.forfeit, passed: r.passed });
        } else {
            const r = move(g, token ?? botPick(g));
            room.game = r.game;
            room.seq++;
            emitState(id, room, "ludo_moved", { seat: r.seat, token: r.token, from: r.from, to: r.to, captured: r.captured, extra: r.extra });
        }
        if (room.game.turn !== before) room.autoSeat = null;
        if (room.game.phase === "over") {
            const w = room.players[room.game.winner];
            // Wins only count against at least one other person, so a bot room can't farm the board.
            if (w.userId && !w.bot && room.humans >= 2) recordWin(w.userId, "Ludo");
            room.rematch = [];
            io.to(id).emit("ludo_over", { roomId: id, winner: room.game.winner, players: publicPlayers(room) });
        }
        await saveRoom(id, room);
        schedule(id, room);
    };

    // Timer fired: bot plays, a forced single move plays, or a human timed out.
    const tick = (id, seq) => withLock(`${roomKey(id)}:lock`, async () => {
        const room = await getRoom(id);
        if (!room || room.seq !== seq || room.game.phase === "over") return;
        const g = room.game;
        const p = room.players[g.turn];
        const forced = g.phase === "move" && g.movable.length === 1;
        if (!p.bot && room.autoSeat !== g.turn && !forced) {
            p.timeouts = (p.timeouts || 0) + 1;
            room.autoSeat = g.turn; // the rest of this turn plays itself
            if (p.timeouts >= MAX_TIMEOUTS) {
                p.bot = true;
                io.to(id).emit("ludo_bot", { roomId: id, seat: g.turn, players: publicPlayers(room) });
            }
        }
        await step(id, room);
    });

    const endRoom = async (id, room) => {
        await redisClient.del(roomKey(id));
        await Promise.all(room.players.filter((p) => p.userId).map(async (p) => {
            if ((await redisClient.get(userKey(p.userId))) === id) await redisClient.del(userKey(p.userId));
        }));
        io.in(id).socketsLeave(id);
    };

    const startRematchIfReady = async (id, room) => {
        const here = room.players.filter((p) => p.userId && !p.left).map((p) => p.userId);
        if (!here.length || !here.every((u) => room.rematch.includes(u))) return false;
        room.players.forEach((p) => { p.bot = !p.userId || p.left; p.timeouts = 0; });
        room.humans = here.length;
        room.game = newGame(room.players.length);
        room.rematch = [];
        room.autoSeat = null;
        room.seq++;
        await saveRoom(id, room);
        io.to(id).emit("ludo_start", { roomId: id, mode: room.mode, players: publicPlayers(room), game: room.game, seq: room.seq, turnMs: TURN_MS });
        setTimeout(() => schedule(id, room), 1200);
        return true;
    };

    // entries: [{ profile, socket }] of humans; seats left over become bots.
    const startRoom = async (mode, entries, seats) => {
        const id = newRoomId();
        shuffle(entries);
        const players = entries.map((e) => ({ ...publicUser(e.profile), bot: false, left: false, timeouts: 0 }));
        for (let i = 1; players.length < seats; i++) {
            players.push({ userId: null, name: `Bot ${i}`, username: "", avatar: "", bot: true, left: false, timeouts: 0 });
        }
        const room = { mode, players, game: newGame(seats), seq: 0, autoSeat: null, humans: entries.length, rematch: [] };
        await saveRoom(id, room);
        await Promise.all(entries.map((e) => redisClient.set(userKey(e.profile.userId), id, { EX: ROOM_TTL })));
        const payload = { roomId: id, mode, players: publicPlayers(room), game: room.game, seq: 0, turnMs: TURN_MS };
        // Emit per socket: a remote join goes through the adapter and may not land before io.to(id).
        for (const e of entries) {
            e.socket.join(id);
            e.socket.emit("ludo_start", payload);
        }
        setTimeout(() => schedule(id, room), 1500);
    };

    // A player who leaves (or drops) is replaced by a bot; last human out closes the room.
    const leave = async (socket, userId) => {
        const id = await redisClient.get(userKey(userId));
        if (!id) return;
        await redisClient.del(userKey(userId));
        socket.leave(id);
        await withLock(`${roomKey(id)}:lock`, async () => {
            const room = await getRoom(id);
            if (!room) return;
            const p = room.players.find((x) => x.userId === userId);
            if (!p) return;
            p.left = true;
            p.bot = true;
            if (!room.players.some((x) => x.userId && !x.left)) return endRoom(id, room);
            io.to(id).emit("ludo_left", { roomId: id, seat: room.players.indexOf(p), players: publicPlayers(room) });
            if (room.game.phase === "over") {
                if (!(await startRematchIfReady(id, room))) await saveRoom(id, room);
                return;
            }
            room.seq++; // kill the 15s human timer, let the bot play now
            await saveRoom(id, room);
            schedule(id, room);
        });
    };

    const dropFromQueues = async (userId, socketId) => {
        await Promise.all(Object.values(QUEUES).map(async (q) => {
            const entries = await redisClient.lRange(q, 0, -1);
            const mine = entries.filter((e) => {
                try {
                    const x = JSON.parse(e);
                    return x.userId === userId && (!socketId || x.socketId === socketId);
                } catch { return false; }
            });
            await Promise.all(mine.map((e) => redisClient.lRem(q, 0, e)));
        }));
    };

    // 4p queue: start with 4, or with 2-3 + bots once the oldest has waited FILL_MS.
    const tryForm4 = () => withLock(Q4_LOCK, async () => {
        const raw = (await redisClient.lRange(QUEUES[4], 0, -1)).reverse(); // oldest first
        const chosen = [];
        for (const s of raw) {
            let e;
            try { e = JSON.parse(s); } catch { e = null; }
            const sock = e && await getSocketAcrossCluster(io, e.socketId);
            if (!sock) { await redisClient.lRem(QUEUES[4], 0, s); continue; }
            if (chosen.length >= 4 || chosen.some((c) => c.profile.userId === e.userId)) continue;
            let blocked = false;
            for (const c of chosen) if (await isBlockedPair(c.profile.userId, e.userId)) { blocked = true; break; }
            if (!blocked) chosen.push({ profile: e, socket: sock, raw: s });
        }
        const waited = chosen.length ? Date.now() - Math.min(...chosen.map((c) => c.profile.at)) : 0;
        if (chosen.length < 4 && !(chosen.length >= 2 && waited >= FILL_MS)) return;
        await Promise.all(chosen.map((c) => redisClient.lRem(QUEUES[4], 0, c.raw)));
        await startRoom("random4", chosen, 4);
    }, 1);

    const leaveLobby = async (socket, userId) => {
        const code = await redisClient.get(lobbyUserKey(userId));
        if (!code) return;
        await redisClient.del(lobbyUserKey(userId));
        socket.leave(lobbyRoom(code));
        const host = await redisClient.get(codeKey(code));
        if (host === userId) {
            const members = Object.keys(await redisClient.hGetAll(membersKey(code)));
            await redisClient.del([codeKey(code), membersKey(code), ...members.map(lobbyUserKey)]);
            io.to(lobbyRoom(code)).emit("ludo_lobby_closed", { code });
            io.in(lobbyRoom(code)).socketsLeave(lobbyRoom(code));
            return;
        }
        await redisClient.hDel(membersKey(code), userId);
        await broadcastLobby(code);
    };

    const broadcastLobby = async (code) => {
        const host = await redisClient.get(codeKey(code));
        if (!host) return;
        const members = Object.values(await redisClient.hGetAll(membersKey(code))).map((s) => publicUser(JSON.parse(s)));
        io.to(lobbyRoom(code)).emit("ludo_lobby", { code, hostId: host, members });
    };

    io.on("connection", (socket) => {
        const guard = (fn) => async (payload = {}) => {
            if (!socket.userId) return socket.emit("ludo_error", "Please log in again.");
            if (!redisClient.isReady) return socket.emit("ludo_error", "Game service unavailable, try again soon.");
            try {
                await fn(payload || {});
            } catch (e) {
                console.error("Ludo socket error:", e);
                socket.emit("ludo_error", "Something went wrong. Try again.");
            }
        };
        // Name/avatar are display-only; identity is socket.userId.
        const profile = (p) => ({
            userId: socket.userId,
            socketId: socket.id,
            name: String(p?.name || "").slice(0, 60),
            username: String(p?.username || "").slice(0, 40),
            avatar: typeof p?.avatar === "string" ? p.avatar.slice(0, 500) : "",
        });
        const reset = async () => {
            await leave(socket, socket.userId);
            await leaveLobby(socket, socket.userId);
            await dropFromQueues(socket.userId);
        };

        socket.on("ludo_find", guard(async (p) => {
            const size = Number(p.size) === 4 ? 4 : 2;
            const self = profile(p);
            await reset();
            if (size === 2) {
                const found = await popNightPartner(redisClient, QUEUES[2], self.userId, {
                    isAlive: (o) => getSocketAcrossCluster(io, o.socketId),
                    isBlocked: isBlockedPair,
                });
                if (!found) {
                    await redisClient.lPush(QUEUES[2], JSON.stringify(self));
                    return socket.emit("ludo_searching", { size });
                }
                return startRoom("random2", [{ profile: found.opponent, socket: found.socket }, { profile: self, socket }], 2);
            }
            await redisClient.lPush(QUEUES[4], JSON.stringify({ ...self, at: Date.now() }));
            socket.emit("ludo_searching", { size, fillMs: FILL_MS });
            await tryForm4();
            setTimeout(() => tryForm4().catch((e) => console.error("Ludo fill error:", e)), FILL_MS + 300);
        }));

        socket.on("ludo_create", guard(async (p) => {
            const self = profile(p);
            await reset();
            const code = newCode();
            await redisClient.set(codeKey(code), self.userId, { EX: CODE_TTL });
            await redisClient.hSet(membersKey(code), self.userId, JSON.stringify(self));
            await redisClient.expire(membersKey(code), CODE_TTL);
            await redisClient.set(lobbyUserKey(self.userId), code, { EX: CODE_TTL });
            socket.join(lobbyRoom(code));
            await broadcastLobby(code);
        }));

        socket.on("ludo_join", guard(async (p) => {
            const code = String(p.code || "").trim().toUpperCase();
            const host = /^[A-Z0-9]{6}$/.test(code) ? await redisClient.get(codeKey(code)) : null;
            if (!host) return socket.emit("ludo_error", "Code expired or wrong. Ask for a new one.");
            const self = profile(p);
            if (host === self.userId) return socket.emit("ludo_error", "That's your own room code — share it with friends.");
            if (await isBlockedPair(host, self.userId)) return socket.emit("ludo_error", "You can't join this room.");
            await reset();
            await redisClient.hSet(membersKey(code), self.userId, JSON.stringify(self));
            await redisClient.expire(membersKey(code), CODE_TTL);
            if ((await redisClient.hLen(membersKey(code))) > 4) {
                await redisClient.hDel(membersKey(code), self.userId);
                return socket.emit("ludo_error", "That room is full (4 players).");
            }
            await redisClient.set(lobbyUserKey(self.userId), code, { EX: CODE_TTL });
            socket.join(lobbyRoom(code));
            await broadcastLobby(code);
        }));

        socket.on("ludo_start_room", guard(async () => {
            const code = await redisClient.get(lobbyUserKey(socket.userId));
            if (!code || (await redisClient.get(codeKey(code))) !== socket.userId) return socket.emit("ludo_error", "Only the host can start.");
            const raw = await redisClient.hGetAll(membersKey(code));
            const entries = [];
            for (const s of Object.values(raw)) {
                const e = JSON.parse(s);
                const sock = await getSocketAcrossCluster(io, e.socketId);
                if (sock) entries.push({ profile: e, socket: sock });
            }
            if (entries.length < 2) return socket.emit("ludo_error", "Need at least 2 players to start.");
            // DEL returns how many keys went: only one start wins a double tap.
            if (!(await redisClient.del(codeKey(code)))) return;
            await redisClient.del([membersKey(code), ...Object.keys(raw).map(lobbyUserKey)]);
            io.in(lobbyRoom(code)).socketsLeave(lobbyRoom(code));
            await startRoom("friends", entries, entries.length);
        }));

        const myTurn = (room) => {
            const p = room?.players[room.game.turn];
            return room && p && p.userId === socket.userId && !p.left && room.game.phase !== "over" ? p : null;
        };

        socket.on("ludo_roll", guard(async (p) => {
            const id = await redisClient.get(userKey(socket.userId));
            if (!id || id !== p.roomId) return;
            await withLock(`${roomKey(id)}:lock`, async () => {
                const room = await getRoom(id);
                const me = myTurn(room);
                if (!me || room.game.phase !== "roll") return;
                me.timeouts = 0;
                me.bot = false;
                await step(id, room);
            });
        }));

        socket.on("ludo_move", guard(async (p) => {
            const id = await redisClient.get(userKey(socket.userId));
            if (!id || id !== p.roomId) return;
            const t = Number(p.token);
            await withLock(`${roomKey(id)}:lock`, async () => {
                const room = await getRoom(id);
                const me = myTurn(room);
                if (!me || room.game.phase !== "move" || !room.game.movable.includes(t)) return;
                me.timeouts = 0;
                me.bot = false;
                await step(id, room, t);
            });
        }));

        // "I'm back": take control again after AFK autoplay.
        socket.on("ludo_resume", guard(async (p) => {
            const id = await redisClient.get(userKey(socket.userId));
            if (!id || id !== p.roomId) return;
            await withLock(`${roomKey(id)}:lock`, async () => {
                const room = await getRoom(id);
                const me = room?.players.find((x) => x.userId === socket.userId && !x.left);
                if (!me || !me.bot) return;
                me.bot = false;
                me.timeouts = 0;
                const seat = room.players.indexOf(me);
                if (room.autoSeat === seat) room.autoSeat = null;
                room.seq++;
                await saveRoom(id, room);
                io.to(id).emit("ludo_bot", { roomId: id, seat, players: publicPlayers(room) });
                schedule(id, room);
            });
        }));

        socket.on("ludo_rematch", guard(async (p) => {
            const id = await redisClient.get(userKey(socket.userId));
            if (!id || id !== p.roomId) return;
            await withLock(`${roomKey(id)}:lock`, async () => {
                const room = await getRoom(id);
                if (!room || room.game.phase !== "over") return;
                if (!room.rematch.includes(socket.userId)) room.rematch.push(socket.userId);
                if (await startRematchIfReady(id, room)) return;
                await saveRoom(id, room);
                io.to(id).emit("ludo_rematch_vote", { roomId: id, votes: room.rematch });
            });
        }));

        socket.on("ludo_leave", guard(reset));

        socket.on("disconnecting", async () => {
            if (!socket.userId || !redisClient.isReady) return;
            // Snapshot now: socket.io empties socket.rooms right after this sync tick.
            const rooms = new Set(socket.rooms);
            try {
                await dropFromQueues(socket.userId, socket.id);
                const code = await redisClient.get(lobbyUserKey(socket.userId));
                if (code && rooms.has(lobbyRoom(code))) await leaveLobby(socket, socket.userId);
                const id = await redisClient.get(userKey(socket.userId));
                if (id && rooms.has(id)) await leave(socket, socket.userId);
            } catch (e) {
                console.error("Ludo disconnect error:", e);
            }
        });
    });
};
