import redisClient from './redis.js';

/**
 * Who is on a call, in Redis.
 *
 * There was no server-side call state at all: "don't ring someone who is
 * already talking" lived entirely in the caller's client, which made it both
 * bypassable and racy. Two people tapping call on the same idle user at the
 * same moment both saw them free and both rang them, and a client that crashed
 * mid-call left the other side stuck with no way to be reached again.
 *
 * The claim is a single atomic `SET NX`, so exactly one caller can ever win a
 * given user, and every key carries a TTL so a crashed or force-quit client
 * cannot strand someone as permanently busy.
 */

const key = (userId) => `call:busy:${String(userId)}`;

/** A call that is ringing but not yet answered. Short, so a missed call frees up. */
export const RINGING_TTL_SECONDS = 60;

/** An answered call. Long enough for a real conversation, short enough to self-heal. */
export const CONNECTED_TTL_SECONDS = 4 * 60 * 60;

/**
 * Atomically reserve both parties for a call.
 *
 * Returns { ok: true } when the caller now owns both sides, or
 * { ok: false, busy: 'caller' | 'callee' } naming who was already engaged.
 */
export const claimCall = async (callerId, calleeId) => {
    const caller = String(callerId);
    const callee = String(calleeId);
    if (caller === callee) return { ok: false, busy: 'callee' };

    // Callee first: that is the contended side, and losing it means we never
    // touch the caller's key at all.
    const gotCallee = await redisClient.set(key(callee), caller, {
        NX: true,
        EX: RINGING_TTL_SECONDS,
    });
    if (!gotCallee) return { ok: false, busy: 'callee' };

    const gotCaller = await redisClient.set(key(caller), callee, {
        NX: true,
        EX: RINGING_TTL_SECONDS,
    });
    if (!gotCaller) {
        // The caller was already engaged (a second device, a stale call).
        // Release the callee rather than leaving them locked to a call that
        // will never connect.
        await releaseIfPeer(callee, caller);
        return { ok: false, busy: 'caller' };
    }

    return { ok: true };
};

/** Extend both sides once the call is actually answered. */
export const confirmCall = async (userA, userB) => {
    try {
        await Promise.all([
            redisClient.expire(key(userA), CONNECTED_TTL_SECONDS),
            redisClient.expire(key(userB), CONNECTED_TTL_SECONDS),
        ]);
    } catch {
        // Losing the extension only risks an early expiry, not correctness.
    }
};

/**
 * Release `userId`, but only if they are still paired with `peerId`.
 *
 * A blind DEL would let a stale "call ended" from a previous conversation tear
 * down the call the user has since started with someone else.
 */
export const releaseIfPeer = async (userId, peerId) => {
    try {
        const current = await redisClient.get(key(userId));
        if (current && String(current) === String(peerId)) {
            await redisClient.del(key(userId));
            return true;
        }
    } catch {
        // Redis down: presence degrades, calls still work.
    }
    return false;
};

/** Tear down both sides of a call. Returns the peer id that was released, if any. */
export const endCall = async (userId) => {
    try {
        const peer = await redisClient.get(key(userId));
        await redisClient.del(key(userId));
        if (peer) await releaseIfPeer(peer, userId);
        return peer ? String(peer) : null;
    } catch {
        return null;
    }
};

/** The id of whoever this user is on a call with, or null. */
export const getPeer = async (userId) => {
    try {
        return await redisClient.get(key(userId));
    } catch {
        return null;
    }
};

/** Which of `userIds` are currently on a call. Returns a Set of id strings. */
export const filterBusy = async (userIds) => {
    const ids = userIds.map(String);
    if (ids.length === 0) return new Set();
    try {
        // One round trip for the whole list rather than a GET per user.
        const values = await redisClient.mGet(ids.map(key));
        return new Set(ids.filter((_, i) => values[i]));
    } catch {
        return new Set();
    }
};
