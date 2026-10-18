import { customAlphabet } from "nanoid";
import redisClient from "../utils/redis.js";
import { getSocketAcrossCluster } from "../utils/socketCluster.js";
import { recordWin } from "../utils/gameWins.js";
import { isBlockedPair, popNightPartner } from "./safety.controller.js";
import {
    MAX_GUESSES, isAllowed, isSolved, matchStatus, randomAnswer, roundWinner, scoreGuess,
} from "../utils/wordRules.js";

/**
 * Word Duel: 1v1 Wordle race, best of 3. Both players get the same secret word,
 * which stays on the server until the round ends. The server scores every guess;
 * the guesser gets letters + colours, the opponent only the colours.
 *
 * Guesses must be dictionary words, so a random match carries nothing to
 * moderate beyond the person; report/block go through the regular /safety API.
 *
 * Redis (any cluster worker can take the next event), same shape as duo.socket.js:
 *   wd:room:<id>                    JSON { players, wins, match, round, status, secret, used }
 *   wd:room:<id>:m<m>r<r>:<userId>  list of JSON { w, m } guesses
 *   wd:room:<id>:m<m>r<r>:solved    hash userId -> solved-at ms
 *   wd:room:<id>:m<m>r<r>:done      NX guard: a round is closed exactly once
 *   wd:room:<id>:rematch            set of userIds who tapped rematch
 *   wd:user:<userId>                the room a user is in
 */

const ROOM_TTL = 60 * 60;
const CODE_TTL = 10 * 60;
const ROUND_MS = 3 * 60 * 1000;
const BETWEEN_MS = 4000;
const START_MS = 1500;
const QUEUE = "queue:word";
const newCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const newRoomId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

const roomKey = (id) => `wd:room:${id}`;
const roundKey = (id, m, r) => `${roomKey(id)}:m${m}r${r}`;
const userKey = (userId) => `wd:user:${userId}`;
const codeKey = (code) => `wd:code:${code}`;

const getRoom = async (id) => {
    const raw = id && await redisClient.get(roomKey(id));
    return raw ? JSON.parse(raw) : null;
};
const saveRoom = (id, room) => redisClient.set(roomKey(id), JSON.stringify(room), { EX: ROOM_TTL });
const publicUser = (u) => ({ userId: u.userId, name: u.name, username: u.username, avatar: u.avatar });
const readGuesses = async (key) => (await redisClient.lRange(key, 0, -1)).map((s) => JSON.parse(s));

export const setWordDuelIo = (io) => {
    const later = (ms, fn, label) => setTimeout(() => fn().catch((e) => console.error(`WordDuel ${label} error:`, e)), ms);

    const startRound = async (id) => {
        const room = await getRoom(id);
        if (!room || room.status === "over") return;
        room.round += 1;
        room.status = "playing";
        let secret = randomAnswer();
        while (room.used.includes(secret)) secret = randomAnswer();
        room.secret = secret;
        room.used.push(secret);
        await saveRoom(id, room);
        const { match, round } = room;
        io.to(id).emit("word_round", { roomId: id, round, wins: room.wins, endsAt: Date.now() + ROUND_MS, maxGuesses: MAX_GUESSES });
        later(ROUND_MS + 500, () => endRound(id, match, round), "timeout");
    };

    // Someone solved, both used all guesses, or the clock ran out.
    const endRound = async (id, match, round) => {
        const base = roundKey(id, match, round);
        if (!await redisClient.set(`${base}:done`, "1", { NX: true, EX: ROOM_TTL })) return;
        const room = await getRoom(id);
        if (!room || room.match !== match || room.round !== round || room.status !== "playing") return;
        const [a, b] = room.players.map((p) => p.userId);
        const [ga, gb, solved] = await Promise.all([
            readGuesses(`${base}:${a}`), readGuesses(`${base}:${b}`), redisClient.hGetAll(`${base}:solved`),
        ]);
        const side = roundWinner(
            { guesses: ga.map((g) => ({ marks: g.m })), solvedAt: solved[a] ? Number(solved[a]) : null },
            { guesses: gb.map((g) => ({ marks: g.m })), solvedAt: solved[b] ? Number(solved[b]) : null },
        );
        const winnerId = side === "a" ? a : side === "b" ? b : null;
        if (winnerId) room.wins[winnerId] += 1;
        const status = matchStatus(room.wins[a], room.wins[b], round + 1);
        room.status = status.over ? "over" : "between";
        await saveRoom(id, room);
        await redisClient.del([`${base}:${a}`, `${base}:${b}`, `${base}:solved`]);
        io.to(id).emit("word_round_end", {
            roomId: id, round, secret: room.secret, winnerId, wins: room.wins,
            guesses: { [a]: ga, [b]: gb }, solved: { [a]: !!solved[a], [b]: !!solved[b] },
        });
        if (!status.over) return later(BETWEEN_MS, () => startRound(id), "next round");
        const matchWinner = status.winner === "a" ? a : status.winner === "b" ? b : null;
        if (matchWinner) recordWin(matchWinner, "WordDuel");
        later(BETWEEN_MS, async () => io.to(id).emit("word_over", { roomId: id, winnerId: matchWinner, wins: room.wins }), "over");
    };

    const startMatch = async (a, aSocket, b, bSocket) => {
        const id = newRoomId();
        const room = {
            players: [publicUser(a), publicUser(b)],
            wins: { [a.userId]: 0, [b.userId]: 0 },
            match: 0, round: -1, status: "starting", secret: null, used: [],
        };
        await saveRoom(id, room);
        await Promise.all([
            redisClient.set(userKey(a.userId), id, { EX: ROOM_TTL }),
            redisClient.set(userKey(b.userId), id, { EX: ROOM_TTL }),
        ]);
        aSocket.join(id);
        bSocket.join(id);
        aSocket.emit("word_matched", { roomId: id, players: room.players, opponent: publicUser(b) });
        bSocket.emit("word_matched", { roomId: id, players: room.players, opponent: publicUser(a) });
        later(START_MS, () => startRound(id), "start");
    };

    const endRoom = async (id) => {
        const room = await getRoom(id);
        const keys = [roomKey(id), `${roomKey(id)}:rematch`];
        if (room) {
            const base = roundKey(id, room.match, room.round);
            keys.push(`${base}:solved`, ...room.players.map((p) => `${base}:${p.userId}`));
            await Promise.all(room.players.map(async (p) => {
                if ((await redisClient.get(userKey(p.userId))) === id) await redisClient.del(userKey(p.userId));
            }));
        }
        await redisClient.del(keys);
        io.in(id).socketsLeave(id);
    };

    // Leaving for any reason tells the opponent and closes the room. No forfeit
    // win: it would let a second account farm the leaderboard.
    const leave = async (socket, userId) => {
        const id = await redisClient.get(userKey(userId));
        if (!id) return;
        await redisClient.del(userKey(userId));
        socket.to(id).emit("word_left", { roomId: id });
        socket.leave(id);
        await endRoom(id);
    };

    const dropFromQueue = async (userId, socketId) => {
        const entries = await redisClient.lRange(QUEUE, 0, -1);
        const mine = entries.filter((e) => {
            try {
                const q = JSON.parse(e);
                return q.userId === userId && (!socketId || q.socketId === socketId);
            } catch { return false; }
        });
        await Promise.all(mine.map((e) => redisClient.lRem(QUEUE, 0, e)));
    };

    io.on("connection", (socket) => {
        const guard = (fn) => async (payload = {}) => {
            if (!socket.userId) return socket.emit("word_error", "Please log in again.");
            if (!redisClient.isReady) return socket.emit("word_error", "Game service unavailable, try again soon.");
            try {
                await fn(payload || {});
            } catch (e) {
                console.error("WordDuel socket error:", e);
                socket.emit("word_error", "Something went wrong. Try again.");
            }
        };
        // Name/avatar are display only; identity is socket.userId.
        const profile = (p) => ({
            userId: socket.userId,
            socketId: socket.id,
            name: String(p?.name || "").slice(0, 60),
            username: String(p?.username || "").slice(0, 40),
            avatar: typeof p?.avatar === "string" ? p.avatar.slice(0, 500) : "",
        });
        const reset = async () => {
            await leave(socket, socket.userId);
            await dropFromQueue(socket.userId);
        };

        socket.on("word_find", guard(async (p) => {
            const self = profile(p);
            await reset();
            const found = await popNightPartner(redisClient, QUEUE, self.userId, {
                isAlive: (o) => getSocketAcrossCluster(io, o.socketId),
                isBlocked: isBlockedPair,
            });
            if (!found) {
                await redisClient.lPush(QUEUE, JSON.stringify(self));
                return socket.emit("word_searching", {});
            }
            await startMatch(found.opponent, found.socket, self, socket);
        }));

        socket.on("word_create", guard(async (p) => {
            const self = profile(p);
            await reset();
            const code = newCode();
            await redisClient.set(codeKey(code), JSON.stringify(self), { EX: CODE_TTL });
            socket.emit("word_code", { code });
        }));

        socket.on("word_join", guard(async (p) => {
            const code = String(p.code || "").trim().toUpperCase();
            const raw = /^[A-Z0-9]{6}$/.test(code)
                ? (await redisClient.multi().get(codeKey(code)).del(codeKey(code)).exec())[0]
                : null;
            if (!raw) return socket.emit("word_error", "Code expired or wrong. Ask your friend for a new one.");
            const host = JSON.parse(raw);
            const self = profile(p);
            if (host.userId === self.userId) return socket.emit("word_error", "That's your own code — share it with a friend.");
            const hostSocket = await getSocketAcrossCluster(io, host.socketId);
            if (!hostSocket) return socket.emit("word_error", "Your friend went offline. Ask them for a new code.");
            if (await isBlockedPair(host.userId, self.userId)) return socket.emit("word_error", "You can't play with this person.");
            await reset();
            await startMatch(host, hostSocket, self, socket);
        }));

        socket.on("word_guess", guard(async (p) => {
            const word = String(p.word || "").toLowerCase();
            if (!/^[a-z]{5}$/.test(word)) return;
            const id = await redisClient.get(userKey(socket.userId));
            if (!id || id !== p.roomId) return;
            const room = await getRoom(id);
            if (!room || room.status !== "playing" || room.round !== Number(p.round)) return;
            if (!isAllowed(word)) return socket.emit("word_invalid", { roomId: id, round: room.round, word });
            const base = roundKey(id, room.match, room.round);
            if (await redisClient.hExists(`${base}:solved`, socket.userId)) return;
            const myKey = `${base}:${socket.userId}`;
            const marks = scoreGuess(word, room.secret);
            const len = await redisClient.rPush(myKey, JSON.stringify({ w: word, m: marks }));
            if (len > MAX_GUESSES) return redisClient.rPop(myKey); // double tap past the last row
            await redisClient.expire(myKey, ROOM_TTL);
            const row = len - 1;
            socket.emit("word_result", { roomId: id, round: room.round, row, word, marks });
            socket.to(id).emit("word_opp", { roomId: id, round: room.round, row, marks });
            if (isSolved(marks)) {
                await redisClient.hSetNX(`${base}:solved`, socket.userId, String(Date.now()));
                return endRound(id, room.match, room.round);
            }
            if (len < MAX_GUESSES) return;
            // Out of guesses: the round closes once the opponent is out too.
            const opp = room.players.find((x) => x.userId !== socket.userId).userId;
            if ((await redisClient.lLen(`${base}:${opp}`)) >= MAX_GUESSES) await endRound(id, room.match, room.round);
        }));

        socket.on("word_rematch", guard(async (p) => {
            const id = await redisClient.get(userKey(socket.userId));
            if (!id || id !== p.roomId) return;
            const room = await getRoom(id);
            if (!room || room.status !== "over") return;
            const key = `${roomKey(id)}:rematch`;
            await redisClient.sAdd(key, socket.userId);
            await redisClient.expire(key, ROOM_TTL);
            if ((await redisClient.sCard(key)) < 2) return socket.to(id).emit("word_rematch_asked", { roomId: id });
            // DEL returns 1 to exactly one caller: only that one restarts the match.
            if (!await redisClient.del(key)) return;
            room.match += 1;
            room.round = -1;
            room.status = "starting";
            room.used = [];
            room.wins = Object.fromEntries(room.players.map((x) => [x.userId, 0]));
            await saveRoom(id, room);
            io.to(id).emit("word_matched", { roomId: id, players: room.players, rematch: true });
            later(START_MS, () => startRound(id), "rematch");
        }));

        socket.on("word_cancel", guard(reset));

        socket.on("disconnecting", async () => {
            // Copy now: socket.io empties socket.rooms right after this event, before any await resumes.
            const rooms = new Set(socket.rooms);
            if (!socket.userId || !redisClient.isReady) return;
            try {
                await dropFromQueue(socket.userId, socket.id);
                const id = await redisClient.get(userKey(socket.userId));
                if (id && rooms.has(id)) await leave(socket, socket.userId);
            } catch (e) {
                console.error("WordDuel disconnect error:", e);
            }
        });
    });
};
