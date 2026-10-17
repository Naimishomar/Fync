import User from "../models/user.model.js";
import Report from "../models/report.model.js";
import Confession from "../models/newFeatures/confession.model.js";
import Comment from "../models/comment.model.js";
import redisClient from "../utils/redis.js";

/**
 * Report + block, the UGC safety baseline Play and the App Store require.
 *
 * Two kinds of block:
 *  - explicit: User.blockedUsers. The user chose a named person, so it is listed
 *    back to them and enforced on DMs.
 *  - anonymous: a Redis set written when someone reports their 12 AM Club 1v1
 *    partner. It only stops the pair being matched again. It is never listed or
 *    applied to DMs, because either would tell one side who the other was.
 */

export const REPORT_LIMIT = 20;
export const REPORT_WINDOW_SECONDS = 60 * 60;
// Same lifetime as the rest of the club's Redis data: a report has to land
// before sunrise wipes the evidence anyway.
export const NIGHT_MAPPING_TTL_SECONDS = 8 * 60 * 60;
const ANON_BLOCK_TTL_SECONDS = 30 * 24 * 60 * 60;

const TARGET_TYPES = ["night_message", "night_user", "confession", "confession_comment", "user", "chat_message"];

export const isObjectId = (id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

const anonBlockKey = (userId) => `safety:anon_block:${userId}`;
const nightMsgKey = (messageId) => `night_msg:${messageId}`;
export const nightPartnerKey = (userId) => `night_1v1_partner:${userId}`;

/** Fixed-window limit: true while `userId` still has a report left this hour. */
export const takeReportSlot = async (redis, userId, limit = REPORT_LIMIT) => {
    const key = `safety:reports:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, REPORT_WINDOW_SECONDS);
    return count <= limit;
};

/** Either side explicitly blocked the other. Used for DMs. */
export const isExplicitlyBlocked = async (a, b) => {
    if (!a || !b) return false;
    return Boolean(await User.exists({
        $or: [{ _id: a, blockedUsers: b }, { _id: b, blockedUsers: a }],
    }));
};

/** Explicit or anonymous block in either direction. Used for night matching. */
export const isBlockedPair = async (a, b) => {
    if (!a || !b) return false;
    const hidden = await Promise.all([
        redisClient.sIsMember(anonBlockKey(a), String(b)),
        redisClient.sIsMember(anonBlockKey(b), String(a)),
    ]).then((r) => r.some(Boolean)).catch(() => false);
    return hidden || isExplicitlyBlocked(a, b);
};

/**
 * Pop the first queued night-1v1 partner who is online and not blocked.
 *
 * Blocked entries are pushed back where they were, so they keep their place
 * for whoever searches next. Stale self entries and dead sockets are dropped,
 * as before. Returns { opponent, socket } or null when nobody fits.
 */
export const popNightPartner = async (redis, queueKey, userId, { isAlive, isBlocked }) => {
    const skipped = [];
    try {
        for (;;) {
            const str = await redis.rPop(queueKey);
            if (!str) return null;
            const opponent = JSON.parse(str);
            if (String(opponent.userId) === String(userId)) continue;
            const socket = await isAlive(opponent);
            if (!socket) continue;
            if (await isBlocked(userId, opponent.userId)) {
                skipped.push(str);
                continue;
            }
            return { opponent, socket };
        }
    } finally {
        // rPop takes from the right; pushing back reversed restores the order.
        if (skipped.length) await redis.rPush(queueKey, skipped.reverse());
    }
};

/** Keep who really sent an anonymous night message, for reports only. */
export const rememberNightMessage = (messageId, senderId, text, fileUrl) =>
    redisClient.set(
        nightMsgKey(messageId),
        JSON.stringify({ senderId: String(senderId), text: text || "", fileUrl: fileUrl || "" }),
        { EX: NIGHT_MAPPING_TTL_SECONDS },
    ).catch(() => { /* reporting this message degrades, delivery does not */ });

const fail = (status, message) => ({ ok: false, status, message });

/**
 * Resolve the target server-side and file a Report.
 * Shared by POST /safety/report and the night chat socket events.
 */
export const fileReport = async ({ reporterId, targetType, targetId, reason, snapshot, targetUserId }) => {
    if (!reporterId) return fail(401, "Unauthorized");
    if (!TARGET_TYPES.includes(targetType)) return fail(400, "Invalid targetType");

    let targetUser = null;
    let text = "";
    let storedId = targetId == null ? "" : String(targetId);

    if (targetType === "night_message") {
        const raw = targetId && await redisClient.get(nightMsgKey(String(targetId)));
        if (!raw) return fail(404, "Message has expired");
        const msg = JSON.parse(raw);
        targetUser = msg.senderId;
        text = [msg.text, msg.fileUrl].filter(Boolean).join(" ");
    } else if (targetType === "night_user") {
        targetUser = await redisClient.get(nightPartnerKey(reporterId));
        if (!targetUser) return fail(404, "No recent partner to report");
        storedId = "";
    } else if (targetType === "confession") {
        if (!isObjectId(storedId)) return fail(400, "Invalid targetId");
        const c = await Confession.findById(storedId).select("user content").lean();
        if (!c) return fail(404, "Confession not found");
        targetUser = c.user;
        text = c.content;
    } else if (targetType === "confession_comment") {
        if (!isObjectId(storedId)) return fail(400, "Invalid targetId");
        const c = await Comment.findOne({ _id: storedId, postType: "Confession" }).select("commentor text").lean();
        if (!c) return fail(404, "Comment not found");
        targetUser = c.commentor;
        text = c.text;
    } else if (targetType === "user") {
        if (!isObjectId(storedId) || !(await User.exists({ _id: storedId }))) return fail(404, "User not found");
        targetUser = storedId;
    } else {
        // chat_message: DMs live in Supabase, which the server cannot read, so the
        // sender and text come from the reporter and are marked as such.
        if (!storedId) return fail(400, "Invalid targetId");
        if (!isObjectId(targetUserId) || !(await User.exists({ _id: targetUserId }))) return fail(404, "User not found");
        targetUser = targetUserId;
        text = snapshot ? `[reporter-supplied] ${String(snapshot)}` : "";
    }

    if (String(targetUser) === String(reporterId)) return fail(400, "You cannot report yourself");

    try {
        if (!(await takeReportSlot(redisClient, reporterId))) return fail(429, "Too many reports. Try again later.");
    } catch {
        // Redis down: accept the report rather than drop a safety signal.
    }

    await Report.create({
        reporter: reporterId,
        targetType,
        targetId: storedId,
        targetUser,
        snapshot: String(text || "").slice(0, 2000),
        reason: String(reason || "").trim().slice(0, 300) || "Inappropriate content",
    });

    // Reporting a 1v1 partner also means never meeting them again.
    if (targetType === "night_user") {
        try {
            await redisClient.sAdd(anonBlockKey(reporterId), String(targetUser));
            await redisClient.expire(anonBlockKey(reporterId), ANON_BLOCK_TTL_SECONDS);
        } catch (err) {
            console.error("Anon block failed:", err.message);
        }
    }

    return { ok: true, status: 201, message: "Report submitted. Thanks for keeping Fync safe." };
};

export const report = async (req, res) => {
    try {
        const { targetType, targetId, reason, snapshot, targetUserId } = req.body || {};
        const r = await fileReport({ reporterId: req.user.id, targetType, targetId, reason, snapshot, targetUserId });
        return res.status(r.status).json({ success: r.ok, message: r.message });
    } catch (error) {
        console.error("Report error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const blockUser = async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!isObjectId(userId)) return res.status(400).json({ success: false, message: "Invalid userId" });
        if (userId === String(req.user.id)) return res.status(400).json({ success: false, message: "You cannot block yourself" });
        if (!(await User.exists({ _id: userId }))) return res.status(404).json({ success: false, message: "User not found" });

        await User.updateOne({ _id: req.user.id }, { $addToSet: { blockedUsers: userId } });
        return res.status(200).json({ success: true, message: "User blocked" });
    } catch (error) {
        console.error("Block error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isObjectId(userId)) return res.status(400).json({ success: false, message: "Invalid userId" });

        await User.updateOne({ _id: req.user.id }, { $pull: { blockedUsers: userId } });
        return res.status(200).json({ success: true, message: "User unblocked" });
    } catch (error) {
        console.error("Unblock error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getBlocked = async (req, res) => {
    try {
        const me = await User.findById(req.user.id)
            .select("blockedUsers")
            .populate("blockedUsers", "name username avatar")
            .lean();
        return res.status(200).json({ success: true, users: me?.blockedUsers || [] });
    } catch (error) {
        console.error("Get blocked error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
