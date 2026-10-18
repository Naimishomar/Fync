import { customAlphabet } from "nanoid";
import redisClient from "../utils/redis.js";
import { getSocketAcrossCluster } from "../utils/socketCluster.js";
import { isBlockedPair, popNightPartner } from "./safety.controller.js";
import { DUO_GAMES, isDuoGame, pickPrompts, isMatch } from "../utils/duoPrompts.js";

/**
 * Couples Corner: two-player tap games (This or That, Would You Rather, How
 * Well Do You Know Me, Never Have I Ever).
 *
 * Pairing is either a 6-letter invite code (play with your partner) or a
 * per-game random queue. Picks are a fixed choice (0/1), never free text, so a
 * random match carries nothing to moderate beyond the person; report/block use
 * the regular /safety API and blocked pairs are never matched.
 *
 * State lives in Redis so any cluster worker can take the next event:
 *   duo:room:<id>          JSON { game, players, prompts, round, score }
 *   duo:room:<id>:r<n>     hash userId -> choice for round n
 *   duo:room:<id>:done<n>  NX guard so a round is revealed exactly once
 *   duo:user:<userId>      the room a user is in
 */

const ROOM_TTL = 60 * 60;
const CODE_TTL = 10 * 60;
const ROUND_MS = 20000;
const REVEAL_MS = 2600;
const newCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const newRoomId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

const roomKey = (id) => `duo:room:${id}`;
const userKey = (userId) => `duo:user:${userId}`;
const queueKey = (game) => `queue:duo:${game}`;
const codeKey = (code) => `duo:code:${code}`;
const myCodeKey = (userId) => `duo:mycode:${userId}`;

const getRoom = async (id) => {
    const raw = id && await redisClient.get(roomKey(id));
    return raw ? JSON.parse(raw) : null;
};
const saveRoom = (id, room) => redisClient.set(roomKey(id), JSON.stringify(room), { EX: ROOM_TTL });

const publicUser = (u) => ({ userId: u.userId, name: u.name, username: u.username, avatar: u.avatar });

export const setDuoIo = (io) => {
    const roundPayload = (id, room) => ({
        roomId: id,
        round: room.round,
        total: room.prompts.length,
        options: room.prompts[room.round],
        // knowMe: this player answers for themselves, the other one guesses.
        subject: room.game === "knowMe" ? room.players[room.round % 2] : null,
        endsAt: Date.now() + ROUND_MS,
    });

    const startRound = async (id, room) => {
        io.to(id).emit("duo_round", roundPayload(id, room));
        const round = room.round;
        setTimeout(() => reveal(id, round).catch((e) => console.error("Duo timeout error:", e)), ROUND_MS + 500);
    };

    // Called when both picks are in, or when the round clock runs out.
    const reveal = async (id, round) => {
        const won = await redisClient.set(`${roomKey(id)}:done${round}`, "1", { NX: true, EX: ROOM_TTL });
        if (!won) return;
        const room = await getRoom(id);
        if (!room || room.round !== round) return;
        const picks = await redisClient.hGetAll(`${roomKey(id)}:r${round}`);
        const parsed = Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, Number(v)]));
        const match = isMatch(parsed, room.players.map((p) => p.userId));
        room.score += match ? 1 : 0;
        room.round += 1;
        await saveRoom(id, room);
        io.to(id).emit("duo_reveal", { roomId: id, round, picks: parsed, match, score: room.score });

        setTimeout(async () => {
            try {
                if (room.round < room.prompts.length) return startRound(id, room);
                io.to(id).emit("duo_over", { roomId: id, score: room.score, total: room.prompts.length });
                await endRoom(id, room);
            } catch (e) {
                console.error("Duo next round error:", e);
            }
        }, REVEAL_MS);
    };

    const endRoom = async (id, room) => {
        const keys = [roomKey(id)];
        for (let r = 0; r < room.prompts.length; r++) keys.push(`${roomKey(id)}:r${r}`, `${roomKey(id)}:done${r}`);
        await redisClient.del(keys);
        await Promise.all(room.players.map(async (p) => {
            // Only clear the pointer if it still points here (they may have moved on).
            if ((await redisClient.get(userKey(p.userId))) === id) await redisClient.del(userKey(p.userId));
        }));
        io.in(id).socketsLeave(id);
    };

    const startMatch = async (game, a, aSocket, b, bSocket) => {
        const id = newRoomId();
        const room = {
            game,
            players: [publicUser(a), publicUser(b)],
            prompts: pickPrompts(game),
            round: 0,
            score: 0,
        };
        await saveRoom(id, room);
        await Promise.all([
            redisClient.set(userKey(a.userId), id, { EX: ROOM_TTL }),
            redisClient.set(userKey(b.userId), id, { EX: ROOM_TTL }),
        ]);
        aSocket.join(id);
        bSocket.join(id);
        aSocket.emit("duo_matched", { roomId: id, game, players: room.players, opponent: publicUser(b) });
        bSocket.emit("duo_matched", { roomId: id, game, players: room.players, opponent: publicUser(a) });
        setTimeout(() => startRound(id, room).catch((e) => console.error("Duo start error:", e)), 1500);
    };

    // Leaving a room (or the queue) for any reason tells the partner.
    const leave = async (socket, userId) => {
        const id = await redisClient.get(userKey(userId));
        if (!id) return;
        await redisClient.del(userKey(userId));
        const room = await getRoom(id);
        socket.to(id).emit("duo_left", { roomId: id });
        socket.leave(id);
        if (room) await endRoom(id, room);
    };

    // socketId set: drop only that socket's entries (another device may still be searching).
    // A cancelled (or replaced) invite must stop working at once, not at its TTL.
    const dropCode = async (userId) => {
        const code = await redisClient.get(myCodeKey(userId));
        if (code) await redisClient.del([codeKey(code), myCodeKey(userId)]);
    };

    const dropFromQueues = async (userId, socketId) => {
        // Queue entries are JSON with the socket id, so match on the userId field.
        await Promise.all(Object.keys(DUO_GAMES).map(async (game) => {
            const entries = await redisClient.lRange(queueKey(game), 0, -1);
            const mine = entries.filter((e) => {
                try {
                    const q = JSON.parse(e);
                    return q.userId === userId && (!socketId || q.socketId === socketId);
                } catch { return false; }
            });
            await Promise.all(mine.map((e) => redisClient.lRem(queueKey(game), 0, e)));
        }));
    };

    io.on("connection", (socket) => {
        const me = () => ({
            userId: socket.userId,
            socketId: socket.id,
        });
        const guard = (fn) => async (payload = {}) => {
            if (!socket.userId) return socket.emit("duo_error", "Please log in again.");
            if (!redisClient.isReady) return socket.emit("duo_error", "Game service unavailable, try again soon.");
            try {
                await fn(payload);
            } catch (e) {
                console.error("Duo socket error:", e);
                socket.emit("duo_error", "Something went wrong. Try again.");
            }
        };
        // Name/avatar come from the client for display only; identity is socket.userId.
        const profile = (p) => ({
            ...me(),
            name: String(p?.name || "").slice(0, 60),
            username: String(p?.username || "").slice(0, 40),
            avatar: typeof p?.avatar === "string" ? p.avatar.slice(0, 500) : "",
        });

        socket.on("duo_find", guard(async (p) => {
            if (!isDuoGame(p.game)) return socket.emit("duo_error", "Unknown game.");
            const self = profile(p);
            await leave(socket, self.userId);
            await dropFromQueues(self.userId);
            const found = await popNightPartner(redisClient, queueKey(p.game), self.userId, {
                isAlive: (o) => getSocketAcrossCluster(io, o.socketId),
                isBlocked: isBlockedPair,
            });
            if (!found) {
                await redisClient.lPush(queueKey(p.game), JSON.stringify(self));
                return socket.emit("duo_searching", { game: p.game });
            }
            await startMatch(p.game, found.opponent, found.socket, self, socket);
        }));

        socket.on("duo_create", guard(async (p) => {
            if (!isDuoGame(p.game)) return socket.emit("duo_error", "Unknown game.");
            const self = profile(p);
            await leave(socket, self.userId);
            await dropFromQueues(self.userId);
            await dropCode(self.userId);
            const code = newCode();
            await redisClient.set(codeKey(code), JSON.stringify({ ...self, game: p.game }), { EX: CODE_TTL });
            await redisClient.set(myCodeKey(self.userId), code, { EX: CODE_TTL });
            socket.emit("duo_code", { code, game: p.game, expiresIn: CODE_TTL });
        }));

        socket.on("duo_join", guard(async (p) => {
            const code = String(p.code || "").trim().toUpperCase();
            // GET+DEL in one transaction: two people racing for one code can't both get the host.
            const raw = /^[A-Z0-9]{6}$/.test(code)
                ? (await redisClient.multi().get(codeKey(code)).del(codeKey(code)).exec())[0]
                : null;
            if (!raw) return socket.emit("duo_error", "Code expired or wrong. Ask your partner for a new one.");
            const host = JSON.parse(raw);
            await redisClient.del(myCodeKey(host.userId));
            const self = profile(p);
            if (host.userId === self.userId) return socket.emit("duo_error", "That's your own code — share it with your partner.");
            const hostSocket = await getSocketAcrossCluster(io, host.socketId);
            if (!hostSocket) return socket.emit("duo_error", "Your partner went offline. Ask them to create a new code.");
            if (await isBlockedPair(host.userId, self.userId)) return socket.emit("duo_error", "You can't play with this person.");
            await leave(socket, self.userId);
            await dropFromQueues(self.userId);
            await startMatch(host.game, host, hostSocket, self, socket);
        }));

        socket.on("duo_pick", guard(async (p) => {
            const choice = Number(p.choice);
            if (choice !== 0 && choice !== 1) return;
            const id = await redisClient.get(userKey(socket.userId));
            if (!id || id !== p.roomId) return;
            const room = await getRoom(id);
            if (!room || room.round !== Number(p.round)) return;
            const key = `${roomKey(id)}:r${room.round}`;
            // First pick sticks: no changing your answer after seeing the partner's speed.
            await redisClient.hSetNX(key, socket.userId, String(choice));
            await redisClient.expire(key, ROOM_TTL);
            socket.to(id).emit("duo_partner_picked", { roomId: id, round: room.round });
            if ((await redisClient.hLen(key)) >= 2) await reveal(id, room.round);
        }));

        socket.on("duo_cancel", guard(async () => {
            await dropCode(socket.userId);
            await dropFromQueues(socket.userId);
            await leave(socket, socket.userId);
        }));

        // "disconnecting" still has socket.rooms, so only the device actually in the
        // game ends it; the same account open on another phone doesn't.
        socket.on("disconnecting", async () => {
            // Copy now: socket.io empties socket.rooms right after this event, before any await resumes.
            const rooms = new Set(socket.rooms);
            if (!socket.userId || !redisClient.isReady) return;
            try {
                await dropFromQueues(socket.userId, socket.id);
                const id = await redisClient.get(userKey(socket.userId));
                if (id && rooms.has(id)) await leave(socket, socket.userId);
            } catch (e) {
                console.error("Duo disconnect error:", e);
            }
        });
    });
};
