import cron from "node-cron";
import SundayMatch from "../models/couple/sundayMatch.model.js";
import SundayMatchProfile from "../models/couple/sundayMatchProfile.model.js";
import User from "../models/user.model.js";
import { sendPushNotification } from "./notification.js";
import { istDateKey } from "./eventTime.js";
import { COOLDOWN_WEEKS, MATCH_DAYS, pairKey, pairUp } from "./sundayMatchRules.js";

const DAY = 86400000;

/** Pair one college for this week. Safe to re-run: people already matched this week are skipped. */
const runCollege = async (college, weekKey, now) => {
    const profiles = await SundayMatchProfile.find({ college, optedIn: true })
        .select("user intent interestedIn interests vibes priority").lean();
    if (profiles.length < 2) {
        if (profiles.length) await SundayMatchProfile.updateOne({ _id: profiles[0]._id }, { $set: { priority: true } });
        return 0;
    }
    const ids = profiles.map((p) => p.user);
    const [users, history] = await Promise.all([
        // Still a student at this college (they may have changed college since opting in).
        User.find({ _id: { $in: ids }, college, user_access: "user" })
            .select("gender blockedUsers expoPushToken").lean(),
        SundayMatch.find({
            college,
            $or: [{ createdAt: { $gte: new Date(now - COOLDOWN_WEEKS * 7 * DAY) } }, { reported: true }],
        }).select("a b weekKey").lean(),
    ]);
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const excluded = new Set();
    const busy = new Set();
    for (const m of history) {
        excluded.add(pairKey(m.a, m.b));
        if (m.weekKey === weekKey) { busy.add(String(m.a)); busy.add(String(m.b)); }
    }
    for (const u of users) for (const b of u.blockedUsers || []) excluded.add(pairKey(u._id, b));

    const pool = profiles
        .filter((p) => byId.has(String(p.user)) && !busy.has(String(p.user)))
        .map((p) => ({ ...p, id: String(p.user), gender: byId.get(String(p.user)).gender }));
    const { pairs, unmatched } = pairUp(pool, excluded, weekKey);
    if (!pairs.length && !unmatched.length) return 0;

    const expiresAt = new Date(now + MATCH_DAYS * DAY);
    const res = await SundayMatch.insertMany(
        pairs.map((p) => ({ ...p, weekKey, college, expiresAt })),
        { ordered: false },
    ).catch((err) => { // duplicate-key on a re-run: keep the ones that landed
        if (!err.insertedDocs) throw err;
        return err.insertedDocs;
    });
    const matched = pairs.flatMap((p) => [p.a, p.b]);
    await Promise.all([
        SundayMatchProfile.updateMany({ user: { $in: matched } }, { $set: { priority: false } }),
        SundayMatchProfile.updateMany({ user: { $in: unmatched } }, { $set: { priority: true } }),
    ]);
    const inserted = new Set(res.map((m) => `${m.a}|${m.b}`));
    for (const p of pairs) {
        if (!inserted.has(`${p.a}|${p.b}`)) continue;
        for (const id of [p.a, p.b]) {
            const token = byId.get(id)?.expoPushToken;
            if (token) {
                await sendPushNotification(token, "Your Sunday match is here 💞", "Tap to see who you matched with this week",
                    { type: "sunday_match", screen: "SundayMatch" }).catch(() => {});
            }
        }
    }
    return inserted.size;
};

/** Pair every college. Colleges run one at a time to keep memory bounded. */
export const runSundayMatch = async (now = Date.now()) => {
    const weekKey = istDateKey(new Date(now));
    const colleges = await SundayMatchProfile.distinct("college", { optedIn: true });
    let total = 0;
    for (const college of colleges) {
        try {
            total += await runCollege(college, weekKey, now);
        } catch (err) {
            console.error(`❌ Sunday Match failed for ${college}:`, err.message);
        }
    }
    return total;
};

export const initSundayMatchCron = () => {
    cron.schedule("0 19 * * 0", async () => {
        try {
            const n = await runSundayMatch();
            console.log(`💞 Sunday Match: ${n} pairs`);
        } catch (err) {
            console.error("❌ Sunday Match cron failed:", err.message);
        }
    }, { timezone: "Asia/Kolkata" });
};
