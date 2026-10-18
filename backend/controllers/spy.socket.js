import { customAlphabet } from "nanoid";
import redisClient from "../utils/redis.js";
import { isBlockedPair } from "./safety.controller.js";
import { recordWin } from "../utils/gameWins.js";
import { MIN_PLAYERS, MAX_PLAYERS, deal, checkClue, tally, winner, guessMatches } from "../utils/spyRules.js";

/**
 * Who's the Spy: 4-8 player social deduction.
 *
 * Lobbies are joined by a 6-letter code (host starts) or filled from the public
 * pool (auto-starts at 6, or at 4+ after a 25s wait). Clues are one word, letters
 * only, checked server-side; votes are taps. Report/block use the /safety API
 * and a blocked pair never lands in the same lobby.
 *
 * State lives in Redis so any cluster worker can take the next event. Every
 * mutation runs under a short per-room lock (withRoom) and timers carry a `seq`
 * token, so a stale timer or a racing event on another worker is a no-op.
 *   spy:room:<id>     JSON room (secret words included; never sent as-is)
 *   spy:code:<CODE>   roomId for private lobbies
 *   spy:user:<uid>    the room a user is in
 *   spy:public        set of public lobbies still filling
 */

const ROOM_TTL = 2 * 60 * 60;
const CLUE_MS = 25000;
const VOTE_MS = 30000;
const GUESS_MS = 20000;
const REVEAL_MS = 4500;
const AUTO_START_MS = 25000;
const AUTO_START_FULL = 6;
const newCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const newId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

const roomKey = (id) => `spy:room:${id}`;
const codeKey = (code) => `spy:code:${code}`;
const userKey = (uid) => `spy:user:${uid}`;
const userRoom = (uid) => `spyu:${uid}`;
const PUBLIC = "spy:public";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getRoom = async (id) => {
    const raw = id && await redisClient.get(roomKey(id));
    return raw ? JSON.parse(raw) : null;
};

// ponytail: spin lock per key; rooms are tiny and events are human-paced.
const withLock = async (key, fn) => {
    const lock = `${key}:lock`;
    const token = newId();
    for (let i = 0; !(await redisClient.set(lock, token, { NX: true, PX: 5000 })); i++) {
        if (i > 100) throw new Error(`spy lock timeout ${key}`);
        await sleep(30);
    }
    try {
        return await fn();
    } finally {
        if ((await redisClient.get(lock)) === token) await redisClient.del(lock);
    }
};

const publicUser = (u) => ({ userId: u.userId, name: u.name, username: u.username, avatar: u.avatar });
const aliveIds = (room) => room.players.filter((p) => p.alive).map((p) => p.userId);

export const setSpyIo = (io) => {
    /** Load, mutate and save a room under its lock. fn returns false to skip saving. */
    const withRoom = (id, fn) => withLock(roomKey(id), async () => {
        const room = await getRoom(id);
        if (!room) return null;
        const res = await fn(room);
        if (room.deleted) {
            await redisClient.del(roomKey(id));
            if (room.code) await redisClient.del(codeKey(room.code));
            await redisClient.sRem(PUBLIC, id);
        } else if (res !== false) {
            await redisClient.set(roomKey(id), JSON.stringify(room), { EX: ROOM_TTL });
        }
        return room;
    });

    const snapshot = (room) => ({
        roomId: room.id,
        code: room.code,
        isPublic: room.isPublic,
        host: room.host,
        players: room.players.map((p) => ({ ...publicUser(p), alive: p.alive !== false })),
        status: room.status,
        phase: room.phase,
        round: room.round,
        turn: room.turn,
        endsIn: room.endsAt ? Math.max(0, room.endsAt - Date.now()) : null,
        clues: room.clues || [],
        voted: Object.keys(room.votes || {}),
        result: room.result,
        guesser: room.guesser,
        over: room.over,
    });
    const broadcast = (room) => io.to(room.id).emit("spy_room", snapshot(room));

    // Every phase change bumps seq, so only the newest timer acts.
    const setTimer = (room, ms, fn) => {
        room.seq = (room.seq || 0) + 1;
        room.endsAt = Date.now() + ms;
        const seq = room.seq;
        setTimeout(() => {
            withRoom(room.id, (r) => (r.seq === seq ? fn(r) : false)).catch((e) => console.error("Spy timer error:", e));
        }, ms + 300);
    };
    const clearTimer = (room) => {
        room.seq = (room.seq || 0) + 1;
        room.endsAt = null;
    };

    const startGame = (room) => {
        if (room.players.length < MIN_PLAYERS) {
            room.autoStart = false;
            clearTimer(room);
            return broadcast(room);
        }
        const ids = room.players.map((p) => p.userId);
        room.game = deal(ids);
        room.players.forEach((p) => { p.alive = true; });
        Object.assign(room, { status: "playing", round: 0, clues: [], over: null, autoStart: false });
        redisClient.sRem(PUBLIC, room.id).catch(() => {});
        for (const id of ids) {
            io.to(userRoom(id)).emit("spy_word", {
                roomId: room.id,
                word: room.game.spies.includes(id) ? room.game.spyWord : room.game.civWord,
            });
        }
        nextRound(room);
    };

    const nextRound = (room) => {
        room.round += 1;
        const alive = aliveIds(room);
        const k = (room.round - 1) % alive.length;
        room.order = [...alive.slice(k), ...alive.slice(0, k)];
        room.turnIdx = -1;
        room.result = null;
        room.guesser = null;
        nextTurn(room);
    };

    const nextTurn = (room) => {
        const alive = new Set(aliveIds(room));
        do room.turnIdx += 1; while (room.turnIdx < room.order.length && !alive.has(room.order[room.turnIdx]));
        if (room.turnIdx >= room.order.length) return startVote(room);
        room.phase = "clue";
        room.turn = room.order[room.turnIdx];
        setTimer(room, CLUE_MS, (r) => {
            r.clues.push({ round: r.round, userId: r.turn, text: null });
            nextTurn(r);
        });
        broadcast(room);
    };

    const startVote = (room) => {
        room.phase = "vote";
        room.turn = null;
        room.votes = {};
        setTimer(room, VOTE_MS, resolveVote);
        broadcast(room);
    };

    const resolveVote = (room) => {
        const out = tally(room.votes, aliveIds(room));
        const wasSpy = !!out && room.game.spies.includes(out);
        room.result = { votes: room.votes, out, wasSpy, guess: null };
        room.votes = {};
        if (out) room.players.find((p) => p.userId === out).alive = false;
        if (wasSpy) {
            room.phase = "guess";
            room.guesser = out;
            setTimer(room, GUESS_MS, (r) => afterGuess(r, ""));
            return broadcast(room);
        }
        afterReveal(room);
    };

    const afterGuess = (room, guess) => {
        const correct = guessMatches(guess, room.game.civWord);
        room.result.guess = { text: guess || null, correct };
        room.guesser = null;
        if (correct) return finish(room, "spies", { reason: "guess" });
        afterReveal(room);
    };

    const afterReveal = (room) => {
        const alive = aliveIds(room);
        const w = winner(alive, room.game.spies);
        if (w) return finish(room, w, { reason: "votes" });
        if (alive.length < 3) return finish(room, null, { reason: "players" });
        room.phase = "reveal";
        setTimer(room, REVEAL_MS, nextRound);
        broadcast(room);
    };

    const finish = (room, side, { reason, record = true }) => {
        clearTimer(room);
        const { civWord, spyWord, spies } = room.game;
        room.status = "over";
        room.phase = null;
        room.turn = null;
        room.over = { winner: side, civWord, spyWord, spies, reason };
        if (side && record) {
            for (const p of room.players) {
                if ((side === "spies") === spies.includes(p.userId)) recordWin(p.userId, "Spy");
            }
        }
        broadcast(room);
    };

    /** Remove a player from the room (leave, kick by disconnect, block). */
    const dropPlayer = (room, uid) => {
        const before = room.players.length;
        room.players = room.players.filter((p) => p.userId !== uid);
        if (room.players.length === before) return false;
        if (!room.players.length) {
            room.deleted = true;
            return;
        }
        if (room.host === uid) room.host = room.players[0].userId;
        if (room.status !== "playing") {
            if (room.autoStart && room.players.length < MIN_PLAYERS) {
                room.autoStart = false;
                clearTimer(room);
            }
            if (room.isPublic && room.status === "lobby") redisClient.sAdd(PUBLIC, room.id).catch(() => {});
            return broadcast(room);
        }
        if (room.votes) {
            delete room.votes[uid];
            for (const [v, t] of Object.entries(room.votes)) if (t === uid) delete room.votes[v];
        }
        if (room.phase === "guess") {
            if (room.guesser === uid) return afterGuess(room, "");
            return broadcast(room); // the guess resolves first, then afterReveal re-checks
        }
        const alive = aliveIds(room);
        // A walk-out decides nothing on the leaderboard: no wins recorded.
        const w = winner(alive, room.game.spies);
        if (w) return finish(room, w, { reason: "left", record: false });
        if (alive.length < 3) return finish(room, null, { reason: "players" });
        if (room.phase === "clue" && room.turn === uid) return nextTurn(room);
        if (room.phase === "vote" && Object.keys(room.votes).length >= alive.length) return resolveVote(room);
        broadcast(room);
    };

    const leave = async (socket, uid) => {
        const id = await redisClient.get(userKey(uid));
        if (!id) return;
        await redisClient.del(userKey(uid));
        socket.leave(id);
        await withRoom(id, (room) => dropPlayer(room, uid));
    };

    const addPlayer = async (socket, room, self) => {
        room.players.push({ ...self, alive: true });
        await redisClient.set(userKey(self.userId), room.id, { EX: ROOM_TTL });
        socket.join(room.id);
    };

    const blockedWithAny = async (room, uid) =>
        (await Promise.all(room.players.map((p) => isBlockedPair(p.userId, uid)))).some(Boolean);

    const newRoom = (self, isPublic) => ({
        id: newId(),
        code: isPublic ? null : newCode(),
        isPublic,
        host: self.userId,
        players: [],
        status: "lobby",
        seq: 0,
    });

    // Public pool: fill the first open lobby that fits, or open a new one.
    const autoFill = (room) => {
        if (room.players.length >= AUTO_START_FULL) return startGame(room);
        if (room.players.length >= MIN_PLAYERS && !room.autoStart) {
            room.autoStart = true;
            setTimer(room, AUTO_START_MS, startGame);
        }
        if (room.players.length >= MAX_PLAYERS) redisClient.sRem(PUBLIC, room.id).catch(() => {});
        broadcast(room);
    };

    io.on("connection", (socket) => {
        if (socket.userId) socket.join(userRoom(socket.userId));
        const guard = (fn) => async (payload = {}) => {
            if (!socket.userId) return socket.emit("spy_error", "Please log in again.");
            if (!redisClient.isReady) return socket.emit("spy_error", "Game service unavailable, try again soon.");
            try {
                await fn(payload || {});
            } catch (e) {
                console.error("Spy socket error:", e);
                socket.emit("spy_error", "Something went wrong. Try again.");
            }
        };
        // Name/avatar are display only; identity is socket.userId.
        const profile = (p) => ({
            userId: socket.userId,
            name: String(p?.name || "").slice(0, 60),
            username: String(p?.username || "").slice(0, 40),
            avatar: typeof p?.avatar === "string" ? p.avatar.slice(0, 500) : "",
        });
        const myRoom = async (roomId) => {
            const id = await redisClient.get(userKey(socket.userId));
            return id && id === roomId ? id : null;
        };

        socket.on("spy_create", guard(async (p) => {
            const self = profile(p);
            await leave(socket, self.userId);
            const room = newRoom(self, false);
            await addPlayer(socket, room, self);
            await redisClient.set(roomKey(room.id), JSON.stringify(room), { EX: ROOM_TTL });
            await redisClient.set(codeKey(room.code), room.id, { EX: ROOM_TTL });
            broadcast(room);
        }));

        socket.on("spy_join", guard(async (p) => {
            const code = String(p.code || "").trim().toUpperCase();
            const id = /^[A-Z0-9]{6}$/.test(code) ? await redisClient.get(codeKey(code)) : null;
            if (!id) return socket.emit("spy_error", "Code expired or wrong. Ask for a new one.");
            const self = profile(p);
            if ((await redisClient.get(userKey(self.userId))) === id) return;
            await leave(socket, self.userId);
            let err = null;
            await withRoom(id, async (room) => {
                if (room.status === "playing") err = "That game already started. Wait for the next round.";
                else if (room.players.length >= MAX_PLAYERS) err = "Lobby is full (8 players).";
                else if (await blockedWithAny(room, self.userId)) err = "You can't join this lobby.";
                if (err) return false;
                await addPlayer(socket, room, self);
                broadcast(room);
            });
            if (err) socket.emit("spy_error", err);
        }));

        socket.on("spy_find", guard(async (p) => {
            const self = profile(p);
            await leave(socket, self.userId);
            await withLock(PUBLIC, async () => {
                for (const id of await redisClient.sMembers(PUBLIC)) {
                    let joined = false;
                    await withRoom(id, async (room) => {
                        if (room.status !== "lobby" || room.players.length >= MAX_PLAYERS) {
                            await redisClient.sRem(PUBLIC, id);
                            return false;
                        }
                        if (await blockedWithAny(room, self.userId)) return false;
                        await addPlayer(socket, room, self);
                        joined = true;
                        autoFill(room);
                    }).then((r) => { if (!r) return redisClient.sRem(PUBLIC, id); });
                    if (joined) return;
                }
                const room = newRoom(self, true);
                await addPlayer(socket, room, self);
                await redisClient.set(roomKey(room.id), JSON.stringify(room), { EX: ROOM_TTL });
                await redisClient.sAdd(PUBLIC, room.id);
                broadcast(room);
            });
        }));

        socket.on("spy_start", guard(async (p) => {
            const id = await myRoom(p.roomId);
            if (!id) return;
            let err = null;
            await withRoom(id, (room) => {
                if (room.host !== socket.userId) err = "Only the host can start.";
                else if (room.status === "playing") return false;
                else if (room.players.length < MIN_PLAYERS) err = `Need at least ${MIN_PLAYERS} players.`;
                if (err) return false;
                startGame(room);
            });
            if (err) socket.emit("spy_error", err);
        }));

        socket.on("spy_clue", guard(async (p) => {
            const id = await myRoom(p.roomId);
            if (!id) return;
            let err = null;
            await withRoom(id, (room) => {
                if (room.status !== "playing" || room.phase !== "clue" || room.turn !== socket.userId) return false;
                const word = room.game.spies.includes(socket.userId) ? room.game.spyWord : room.game.civWord;
                const c = checkClue(p.text, word);
                if (!c.ok) {
                    err = c.error;
                    return false;
                }
                room.clues.push({ round: room.round, userId: socket.userId, text: c.clue });
                nextTurn(room);
            });
            if (err) socket.emit("spy_error", err);
        }));

        socket.on("spy_vote", guard(async (p) => {
            const id = await myRoom(p.roomId);
            if (!id) return;
            await withRoom(id, (room) => {
                const alive = aliveIds(room);
                const target = String(p.target || "");
                if (room.status !== "playing" || room.phase !== "vote") return false;
                if (!alive.includes(socket.userId) || !alive.includes(target) || target === socket.userId) return false;
                if (room.votes[socket.userId]) return false; // first vote sticks
                room.votes[socket.userId] = target;
                if (Object.keys(room.votes).length >= alive.length) return resolveVote(room);
                broadcast(room);
            });
        }));

        socket.on("spy_guess", guard(async (p) => {
            const id = await myRoom(p.roomId);
            if (!id) return;
            await withRoom(id, (room) => {
                if (room.status !== "playing" || room.phase !== "guess" || room.guesser !== socket.userId) return false;
                afterGuess(room, String(p.text || "").trim().slice(0, 30));
            });
        }));

        socket.on("spy_leave", guard(async () => {
            await leave(socket, socket.userId);
        }));

        // Only the device actually in the lobby leaves it on disconnect.
        socket.on("disconnecting", async () => {
            if (!socket.userId || !redisClient.isReady) return;
            // Copy now: socket.io empties socket.rooms right after this event fires,
            // so after the first await it would always be empty.
            const rooms = new Set(socket.rooms);
            try {
                const id = await redisClient.get(userKey(socket.userId));
                if (id && rooms.has(id)) await leave(socket, socket.userId);
            } catch (e) {
                console.error("Spy disconnect error:", e);
            }
        });
    });
};
