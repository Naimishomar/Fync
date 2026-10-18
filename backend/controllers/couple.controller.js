import crypto from "crypto";
import Couple from "../models/couple/couple.model.js";
import CoupleAnswer from "../models/couple/coupleAnswer.model.js";
import CoupleNote from "../models/couple/coupleNote.model.js";
import User from "../models/user.model.js";
import redisClient from "../utils/redis.js";
import { sendPushNotification } from "../utils/notification.js";
import { istDateKey } from "../utils/eventTime.js";
import { isExplicitlyBlocked, isObjectId } from "./safety.controller.js";
import { COUPLE_QUESTIONS } from "../utils/coupleQuestions.js";
import { isDateKey, dayDiff, nextStreak, liveStreak, togetherStats, questionIndex } from "../utils/coupleRules.js";

/**
 * Couple Space. Every handler is scoped to the caller's own couple doc
 * (found by req.user.id), so a user can never read or write another couple.
 */

const CODE_TTL = 600;
const NUDGE_GAP = 300;
const MAX_BUCKET = 100;
const codeKey = (c) => `couple:code:${c}`;
const myCodeKey = (u) => `couple:mycode:${u}`;
const nudgeLockKey = (u) => `couple:nudge:lock:${u}`;
const nudgeCountKey = (u, day) => `couple:nudge:n:${u}:${day}`;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

const PUBLIC = "name username avatar user_access";
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const oops = (res, where, err) => {
    console.error(`couple.${where}:`, err);
    return fail(res, 500, "Internal server error");
};
const firstName = (u) => String(u?.name || u?.username || "Your partner").split(" ")[0];
const questionFor = (day) => COUPLE_QUESTIONS[questionIndex(day, COUPLE_QUESTIONS.length)];

const findCouple = (uid) => Couple.findOne({ users: uid });
const partnerOf = (couple, uid) => couple.users.find((u) => String(u) !== String(uid));

/** Loads the caller's couple or answers 404. */
const mine = async (req, res) => {
    const couple = await findCouple(req.user.id);
    if (!couple) fail(res, 404, "You are not linked with a partner");
    return couple;
};

const pushPartner = async (couple, uid, title, body) => {
    try {
        const p = await User.findById(partnerOf(couple, uid)).select("expoPushToken").lean();
        if (p?.expoPushToken) await sendPushNotification(p.expoPushToken, title, body, { type: "couple", screen: "CoupleSpace" });
    } catch (err) {
        console.error("couple push:", err.message);
    }
};

/* ------------------------------------------------------------ link / unlink */

export const createCode = async (req, res) => {
    try {
        const uid = String(req.user.id);
        if (await findCouple(uid)) return fail(res, 409, "You are already linked");
        const old = await redisClient.get(myCodeKey(uid));
        if (old) await redisClient.del(codeKey(old));
        let code = "";
        for (let i = 0; i < 5; i++) {
            code = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
            if (await redisClient.set(codeKey(code), uid, { NX: true, EX: CODE_TTL })) break;
            code = "";
        }
        if (!code) return fail(res, 503, "Could not create a code, try again");
        await redisClient.set(myCodeKey(uid), code, { EX: CODE_TTL });
        return res.json({ success: true, code, expiresIn: CODE_TTL });
    } catch (err) {
        return oops(res, "createCode", err);
    }
};

export const joinCode = async (req, res) => {
    try {
        const uid = String(req.user.id);
        const code = String(req.body?.code || "").trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) return fail(res, 400, "Enter the 6-character code");
        const owner = await redisClient.get(codeKey(code));
        if (!owner) return fail(res, 404, "Code expired or wrong. Ask your partner for a new one.");
        if (owner === uid) return fail(res, 400, "That's your own code. Send it to your partner.");
        // Single use: only the request whose DEL actually removed the key may link.
        if ((await redisClient.del(codeKey(code))) !== 1) return fail(res, 404, "Code already used");
        await redisClient.del(myCodeKey(owner));
        if (await isExplicitlyBlocked(uid, owner)) return fail(res, 403, "You can't link with this person");
        if (await Couple.exists({ users: { $in: [uid, owner] } })) return fail(res, 409, "One of you is already linked");
        const couple = await Couple.create({ users: [owner, uid], since: istDateKey() });
        pushPartner(couple, uid, "You're linked 💞", `${firstName(req.user)} joined your Couple Space`);
        return res.status(201).json({ success: true, coupleId: couple._id });
    } catch (err) {
        if (err?.code === 11000) return fail(res, 409, "One of you is already linked");
        return oops(res, "joinCode", err);
    }
};

export const unlink = async (req, res) => {
    try {
        const couple = await mine(req, res);
        if (!couple) return;
        await Promise.all([
            Couple.deleteOne({ _id: couple._id }),
            CoupleAnswer.deleteMany({ couple: couple._id }),
            CoupleNote.deleteMany({ couple: couple._id }),
        ]);
        return res.json({ success: true });
    } catch (err) {
        return oops(res, "unlink", err);
    }
};

export const setSince = async (req, res) => {
    try {
        const since = String(req.body?.since || "");
        if (!isDateKey(since)) return fail(res, 400, "Date must be YYYY-MM-DD");
        const today = istDateKey();
        if (since > today) return fail(res, 400, "That date is in the future");
        if (dayDiff(since, today) > 365 * 30) return fail(res, 400, "That's a little too long ago");
        const couple = await mine(req, res);
        if (!couple) return;
        couple.since = since;
        await couple.save();
        return res.json({ success: true, since });
    } catch (err) {
        return oops(res, "setSince", err);
    }
};

/* ---------------------------------------------------------------- dashboard */

export const getSpace = async (req, res) => {
    try {
        const uid = String(req.user.id);
        const couple = await Couple.findOne({ users: uid }).populate("users", PUBLIC).lean();
        if (!couple) {
            const code = await redisClient.get(myCodeKey(uid)).catch(() => null);
            const ttl = code ? await redisClient.ttl(myCodeKey(uid)).catch(() => 0) : 0;
            return res.json({ success: true, linked: false, pendingCode: code ? { code, expiresIn: ttl } : null });
        }
        const me = couple.users.find((u) => String(u._id) === uid);
        const partner = couple.users.find((u) => String(u._id) !== uid);
        const today = istDateKey();
        const [answers, unreadNotes, counts] = await Promise.all([
            CoupleAnswer.find({ couple: couple._id, day: today }).lean(),
            CoupleNote.countDocuments({ couple: couple._id, from: { $ne: uid }, readAt: null }),
            redisClient.mGet([nudgeCountKey(uid, today), nudgeCountKey(String(partner?._id), today)]).catch(() => [0, 0]),
        ]);
        const myAns = answers.find((a) => String(a.user) === uid);
        const theirAns = answers.find((a) => String(a.user) !== uid);
        return res.json({
            success: true,
            linked: true,
            couple: { id: couple._id, since: couple.since, createdAt: couple.createdAt, me, partner },
            together: togetherStats(couple.since, today),
            streak: liveStreak(couple.streak, couple.lastBothAnsweredDay, today),
            bestStreak: couple.bestStreak,
            answeredToday: couple.lastBothAnsweredDay === today,
            today: {
                day: today,
                question: questionFor(today),
                mine: myAns?.text ?? null,
                partnerAnswered: Boolean(theirAns),
                // Hidden until you answer: no peeking.
                partner: myAns ? theirAns?.text ?? null : null,
            },
            nudges: { sentToday: Number(counts?.[0] || 0), receivedToday: Number(counts?.[1] || 0) },
            unreadNotes,
            bucket: couple.bucket,
        });
    } catch (err) {
        return oops(res, "getSpace", err);
    }
};

/* ----------------------------------------------------------- daily question */

export const answer = async (req, res) => {
    try {
        const uid = String(req.user.id);
        const text = String(req.body?.text || "").trim();
        if (!text) return fail(res, 400, "Write an answer first");
        if (text.length > 300) return fail(res, 400, "Keep it under 300 characters");
        const couple = await mine(req, res);
        if (!couple) return;
        const today = istDateKey();
        try {
            await CoupleAnswer.create({ couple: couple._id, user: uid, day: today, text });
        } catch (err) {
            if (err?.code === 11000) return fail(res, 409, "You already answered today");
            throw err;
        }
        const theirs = await CoupleAnswer.findOne({ couple: couple._id, day: today, user: { $ne: uid } }).lean();
        let streak = liveStreak(couple.streak, couple.lastBothAnsweredDay, today);
        if (theirs) {
            const next = nextStreak(couple.streak, couple.lastBothAnsweredDay, today);
            // Conditional on the value we read, so two simultaneous answers bump once.
            const r = await Couple.updateOne(
                { _id: couple._id, lastBothAnsweredDay: couple.lastBothAnsweredDay },
                { $set: { streak: next, lastBothAnsweredDay: today }, $max: { bestStreak: next } },
            );
            if (r.modifiedCount) streak = next;
            else streak = (await Couple.findById(couple._id).select("streak").lean())?.streak ?? next;
        }
        pushPartner(couple, uid, "💌 Daily question",
            theirs ? `${firstName(req.user)} answered too. See what they said!` : `${firstName(req.user)} answered today's question 💌`);
        return res.json({ success: true, mine: text, partner: theirs?.text ?? null, streak, answeredToday: Boolean(theirs) });
    } catch (err) {
        return oops(res, "answer", err);
    }
};

/** Past days (newest first). A day's answers show only if you answered it too. */
export const history = async (req, res) => {
    try {
        const uid = String(req.user.id);
        const couple = await mine(req, res);
        if (!couple) return;
        const before = isDateKey(req.query.before) ? req.query.before : istDateKey();
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
        const rows = await CoupleAnswer.find({ couple: couple._id, day: { $lt: before } })
            .sort({ day: -1 }).limit(limit * 2).lean();
        const byDay = new Map();
        for (const a of rows) {
            const d = byDay.get(a.day) || { day: a.day, question: questionFor(a.day), mine: null, partner: null };
            if (String(a.user) === uid) d.mine = a.text; else d.partner = a.text;
            byDay.set(a.day, d);
        }
        const days = [...byDay.values()].slice(0, limit).map((d) => ({ ...d, partner: d.mine ? d.partner : d.partner ? "🔒" : null }));
        return res.json({ success: true, days, nextBefore: days.length ? days[days.length - 1].day : null });
    } catch (err) {
        return oops(res, "history", err);
    }
};

/* -------------------------------------------------------------- bucket list */

export const addBucket = async (req, res) => {
    try {
        const text = String(req.body?.text || "").trim();
        if (!text) return fail(res, 400, "Write something first");
        if (text.length > 120) return fail(res, 400, "Keep it under 120 characters");
        const couple = await mine(req, res);
        if (!couple) return;
        // Size guard inside the update so concurrent adds can't pass 100.
        const updated = await Couple.findOneAndUpdate(
            { _id: couple._id, [`bucket.${MAX_BUCKET - 1}`]: { $exists: false } },
            { $push: { bucket: { text, addedBy: req.user.id } } },
            { new: true, projection: { bucket: 1 } },
        ).lean();
        if (!updated) return fail(res, 400, `Bucket list is full (${MAX_BUCKET} items)`);
        return res.status(201).json({ success: true, bucket: updated.bucket });
    } catch (err) {
        return oops(res, "addBucket", err);
    }
};

export const toggleBucket = async (req, res) => {
    try {
        if (!isObjectId(req.params.itemId)) return fail(res, 400, "Bad item");
        const couple = await mine(req, res);
        if (!couple) return;
        const item = couple.bucket.id(req.params.itemId);
        if (!item) return fail(res, 404, "Item not found");
        const done = typeof req.body?.done === "boolean" ? req.body.done : !item.doneAt;
        // Positional update: a concurrent delete can't shift us onto another item.
        const updated = await Couple.findOneAndUpdate(
            { _id: couple._id, "bucket._id": item._id },
            { $set: { "bucket.$.doneAt": done ? new Date() : null, "bucket.$.doneBy": done ? req.user.id : null } },
            { new: true, projection: { bucket: 1 } },
        ).lean();
        if (!updated) return fail(res, 404, "Item not found");
        return res.json({ success: true, bucket: updated.bucket });
    } catch (err) {
        return oops(res, "toggleBucket", err);
    }
};

export const deleteBucket = async (req, res) => {
    try {
        if (!isObjectId(req.params.itemId)) return fail(res, 400, "Bad item");
        const couple = await mine(req, res);
        if (!couple) return;
        const updated = await Couple.findByIdAndUpdate(
            couple._id, { $pull: { bucket: { _id: req.params.itemId } } }, { new: true, projection: { bucket: 1 } },
        ).lean();
        return res.json({ success: true, bucket: updated?.bucket ?? [] });
    } catch (err) {
        return oops(res, "deleteBucket", err);
    }
};

/* -------------------------------------------------------------------- nudge */

export const nudge = async (req, res) => {
    try {
        const uid = String(req.user.id);
        const couple = await mine(req, res);
        if (!couple) return;
        if (!(await redisClient.set(nudgeLockKey(uid), "1", { NX: true, EX: NUDGE_GAP }))) {
            const wait = await redisClient.ttl(nudgeLockKey(uid)).catch(() => NUDGE_GAP);
            return res.status(429).json({ success: false, message: "You just sent one 💭 Try again in a bit", retryIn: wait });
        }
        const key = nudgeCountKey(uid, istDateKey());
        const sentToday = await redisClient.incr(key);
        if (sentToday === 1) await redisClient.expire(key, 2 * 86400);
        pushPartner(couple, uid, "Thinking of you 💭", `${firstName(req.user)} is thinking of you`);
        return res.json({ success: true, sentToday, retryIn: NUDGE_GAP });
    } catch (err) {
        return oops(res, "nudge", err);
    }
};

/* --------------------------------------------------------------- love notes */

export const listNotes = async (req, res) => {
    try {
        const couple = await mine(req, res);
        if (!couple) return;
        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
        const filter = { couple: couple._id };
        const before = req.query.before ? new Date(String(req.query.before)) : null;
        if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
        const notes = await CoupleNote.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
        return res.json({ success: true, notes });
    } catch (err) {
        return oops(res, "listNotes", err);
    }
};

export const sendNote = async (req, res) => {
    try {
        const text = String(req.body?.text || "").trim();
        if (!text) return fail(res, 400, "Write a note first");
        if (text.length > 280) return fail(res, 400, "Keep it under 280 characters");
        const couple = await mine(req, res);
        if (!couple) return;
        // ponytail: fixed per-user cap via Redis counter; tune if couples hit it.
        const rk = `couple:note:n:${req.user.id}:${istDateKey()}`;
        const n = await redisClient.incr(rk).catch(() => 0);
        if (n === 1) redisClient.expire(rk, 2 * 86400).catch(() => {});
        if (n > 100) return fail(res, 429, "That's a lot of love for one day 💕 Try tomorrow");
        const note = await CoupleNote.create({ couple: couple._id, from: req.user.id, text });
        pushPartner(couple, req.user.id, `💌 Note from ${firstName(req.user)}`, text.length > 80 ? `${text.slice(0, 77)}…` : text);
        return res.status(201).json({ success: true, note });
    } catch (err) {
        return oops(res, "sendNote", err);
    }
};

export const markNotesRead = async (req, res) => {
    try {
        const couple = await mine(req, res);
        if (!couple) return;
        await CoupleNote.updateMany({ couple: couple._id, from: { $ne: req.user.id }, readAt: null }, { $set: { readAt: new Date() } });
        return res.json({ success: true });
    } catch (err) {
        return oops(res, "markNotesRead", err);
    }
};

