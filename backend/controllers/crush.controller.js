import mongoose from "mongoose";
import CrushPick from "../models/couple/crushPick.model.js";
import User from "../models/user.model.js";
import { sendPushNotification } from "../utils/notification.js";
import { escapeRegExp } from "../utils/escapeRegExp.js";
import { isExplicitlyBlocked, isObjectId } from "./safety.controller.js";
import { MAX_PICKS, canRemove, unlockAt, pickError } from "../utils/crushRules.js";

const CARD = "name username avatar college year";
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const firstName = (u) => String(u?.name || "Someone").split(" ")[0];

/**
 * GET /couple/crush — my picks, my matches, and how many people secretly
 * picked me. Admirers are only ever a count: who they are stays hidden until
 * it is mutual.
 */
export const getCrush = async (req, res) => {
    try {
        const me = req.user._id;
        const [picks, admirers] = await Promise.all([
            CrushPick.find({ from: me }).sort({ createdAt: 1 }).populate("to", CARD).lean(),
            CrushPick.countDocuments({ to: me, matchedAt: null }),
        ]);
        const live = picks.filter((p) => p.to);
        res.json({
            success: true,
            max: MAX_PICKS,
            admirers,
            picks: live.map((p) => ({
                user: p.to,
                matched: Boolean(p.matchedAt),
                matchedAt: p.matchedAt,
                createdAt: p.createdAt,
                unlockAt: unlockAt(p.createdAt),
            })),
        });
    } catch (err) {
        console.error("getCrush:", err.message);
        fail(res, 500, "Could not load your picks");
    }
};

/** GET /couple/crush/search?q= — people from my college to pick from. */
export const searchCollege = async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        if (!req.user.college || q.length < 2) return res.json({ success: true, users: [] });
        const esc = escapeRegExp(q.slice(0, 40));
        const users = await User.find({
            _id: { $ne: req.user._id },
            college: req.user.college,
            user_access: "user",
            $or: [{ username: new RegExp("^" + esc, "i") }, { name: new RegExp("(?:^|\\s)" + esc, "i") }],
        }).select(CARD).limit(15).lean();
        res.json({ success: true, users });
    } catch (err) {
        console.error("crush search:", err.message);
        fail(res, 500, "Search failed");
    }
};

/** POST /couple/crush { userId } — pick someone; match if they picked me too. */
export const pickCrush = async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!isObjectId(userId)) return fail(res, 400, "Invalid user");
        const meId = req.user._id;
        const [target, myPickCount, alreadyPicked, blocked] = await Promise.all([
            User.findById(userId).select("college expoPushToken name").lean(),
            CrushPick.countDocuments({ from: meId }),
            CrushPick.exists({ from: meId, to: userId }),
            isExplicitlyBlocked(String(meId), userId),
        ]);
        const why = pickError({ me: { _id: meId, college: req.user.college }, target, myPickCount, alreadyPicked, blocked });
        if (why) return fail(res, 400, why);

        try {
            await CrushPick.create({ from: meId, to: userId, college: req.user.college });
        } catch (err) {
            if (err?.code === 11000) return fail(res, 400, "Already in your picks");
            throw err;
        }

        // Mutual? Mark both sides matched in one go; the update is conditional
        // so two simultaneous picks can't both claim the match notification.
        const now = new Date();
        const theirs = await CrushPick.findOneAndUpdate(
            { from: userId, to: meId, matchedAt: null },
            { $set: { matchedAt: now } },
        );
        let matched = false;
        if (theirs) {
            matched = true;
            await CrushPick.updateOne({ from: meId, to: userId }, { $set: { matchedAt: now } });
            const meDoc = await User.findById(meId).select("expoPushToken name").lean();
            const push = (to, other) => to?.expoPushToken && sendPushNotification(
                to.expoPushToken, "It's a match 💘", `You and ${firstName(other)} picked each other on Dil Se`,
                { type: "crush", screen: "CrushMatch" },
            ).catch(() => {});
            push(target, meDoc);
            push(meDoc, target);
        }
        res.status(201).json({ success: true, matched });
    } catch (err) {
        console.error("pickCrush:", err.message);
        fail(res, 500, "Could not save your pick");
    }
};

/** DELETE /couple/crush/:userId — drop a pick, once its 7-day lock is over. */
export const removeCrush = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isObjectId(userId)) return fail(res, 400, "Invalid user");
        const pick = await CrushPick.findOne({ from: req.user._id, to: userId });
        if (!pick) return fail(res, 404, "Not in your picks");
        if (!canRemove(pick.createdAt)) {
            return fail(res, 400, `You can change this pick after ${unlockAt(pick.createdAt).toDateString()}`);
        }
        await pick.deleteOne();
        // Un-matching also clears their side, so it can't stay "matched" alone.
        if (pick.matchedAt) {
            await CrushPick.updateOne({ from: userId, to: req.user._id }, { $set: { matchedAt: null } });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("removeCrush:", err.message);
        fail(res, 500, "Could not remove pick");
    }
};
