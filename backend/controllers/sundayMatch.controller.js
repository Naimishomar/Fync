import SundayMatch from "../models/couple/sundayMatch.model.js";
import SundayMatchProfile from "../models/couple/sundayMatchProfile.model.js";
import User from "../models/user.model.js";
import { fileReport } from "./safety.controller.js";
import { INTERESTS, MAX_INTERESTS, VIBES, nextSundayAt, profileError } from "../utils/sundayMatchRules.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const PROFILE = "optedIn intent interestedIn interests vibes priority";
const REASONS = ["Made me uncomfortable", "Fake profile", "Harassment", "Under 18", "Spam", "Something else"];

const currentMatch = (me) => SundayMatch.findOne({
    $or: [{ a: me }, { b: me }], status: "active", expiresAt: { $gt: new Date() },
}).sort({ createdAt: -1 });

/** GET /couple/sunday — my profile, my current match (other person's card only), next drop time. */
export const getSunday = async (req, res) => {
    try {
        const me = req.user._id;
        const [profile, match] = await Promise.all([
            SundayMatchProfile.findOne({ user: me }).select(PROFILE).lean(),
            currentMatch(me).lean(),
        ]);
        let card = null;
        if (match) {
            const other = await User.findById(String(match.a) === String(me) ? match.b : match.a)
                .select("name username avatar year").lean();
            if (other) {
                card = { user: other, sharedInterests: match.sharedInterests, intent: profile?.intent, expiresAt: match.expiresAt };
            }
        }
        res.json({
            success: true,
            profile,
            match: card,
            nextAt: nextSundayAt(),
            options: { interests: INTERESTS, maxInterests: MAX_INTERESTS, vibes: VIBES, reasons: REASONS },
        });
    } catch (err) {
        console.error("getSunday:", err.message);
        fail(res, 500, "Could not load Sunday Match");
    }
};

/** PUT /couple/sunday/profile — save quiz answers and opt in. */
export const saveProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("college gender dob").lean();
        const why = profileError(req.body, user);
        if (why) return fail(res, 400, why);
        const { intent, interestedIn, interests, vibes } = req.body;
        const profile = await SundayMatchProfile.findOneAndUpdate(
            { user: req.user._id },
            {
                $set: {
                    college: user.college, optedIn: true, intent,
                    interestedIn: intent === "dating" ? interestedIn : null,
                    interests, vibes, ageConfirmedAt: new Date(),
                },
            },
            { upsert: true, new: true, projection: PROFILE },
        ).lean();
        res.json({ success: true, profile });
    } catch (err) {
        console.error("saveProfile:", err.message);
        fail(res, 500, "Could not save preferences");
    }
};

/** POST /couple/sunday/optout — stop getting new matches. A current match stays until unmatched/expired. */
export const optOut = async (req, res) => {
    try {
        await SundayMatchProfile.updateOne({ user: req.user._id }, { $set: { optedIn: false, priority: false } });
        res.json({ success: true });
    } catch (err) {
        console.error("sunday optOut:", err.message);
        fail(res, 500, "Could not pause");
    }
};

/** End my current match for both sides. Returns the match (before update) or null. */
const endMatch = async (me, extra = {}) => {
    const match = await currentMatch(me).select("a b").lean();
    if (!match) return null;
    const side = String(match.a) === String(me) ? "aUnmatched" : "bUnmatched";
    await SundayMatch.updateOne({ _id: match._id }, { $set: { status: "ended", [side]: true, ...extra } });
    return match;
};

/** POST /couple/sunday/unmatch */
export const unmatch = async (req, res) => {
    try {
        if (!(await endMatch(req.user._id))) return fail(res, 404, "No active match");
        res.json({ success: true });
    } catch (err) {
        console.error("sunday unmatch:", err.message);
        fail(res, 500, "Could not unmatch");
    }
};

/** POST /couple/sunday/report { reason } — files a user report, ends the match, never pairs them again. */
export const reportMatch = async (req, res) => {
    try {
        const reason = String(req.body?.reason || "").trim().slice(0, 200);
        if (!reason) return fail(res, 400, "Pick a reason");
        const me = req.user._id;
        const match = await endMatch(me, { reported: true });
        if (!match) return fail(res, 404, "No active match");
        const other = String(match.a) === String(me) ? match.b : match.a;
        const r = await fileReport({ reporterId: req.user.id, targetType: "user", targetId: String(other), reason: `[Sunday Match] ${reason}` });
        // Match is already ended and blocked from re-pairing even if the report itself was rate-limited.
        res.status(r.ok ? 201 : r.status).json({ success: r.ok, message: r.message });
    } catch (err) {
        console.error("sunday report:", err.message);
        fail(res, 500, "Could not report");
    }
};
