import SundayPlan from "../models/sundayPlan.model.js";
import User from "../models/user.model.js";
import Report from "../models/report.model.js";
import redisClient from "../utils/redis.js";
import { sendPushNotification } from "../utils/notification.js";
import { isExplicitlyBlocked, isObjectId, takeReportSlot } from "./safety.controller.js";
import { MAX_ACTIVE_PER_HOST, parsePlan, joinError } from "../utils/sundayPlanRules.js";

const CARD = "name username avatar";
const LIST_LIMIT = 60;
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const firstName = (u) => String(u?.name || "Someone").split(" ")[0];
const push = (u, title, body, data) => u?.expoPushToken
    && sendPushNotification(u.expoPushToken, title, body, { screen: "PlanDetail", ...data }).catch(() => {});

/** A live plan in my college, or null. */
const findLive = (id, college, extra = {}) => isObjectId(id) && college
    ? SundayPlan.findOne({ _id: id, college, expiresAt: { $gt: new Date() }, ...extra })
    : null;

const myStatus = (p, me) => String(p.host) === me ? "host"
    : p.attendees.some((a) => String(a.user) === me) ? "going" : null;

/** GET /plans — this week's plans for my college, soonest first. */
export const listPlans = async (req, res) => {
    try {
        const college = req.user.college;
        if (!college) return res.json({ success: true, plans: [] });
        const me = req.user._id;
        const plans = await SundayPlan.find({ college, expiresAt: { $gt: new Date() } })
            .select("-kicked -description").sort({ startsAt: 1 }).limit(LIST_LIMIT).lean();
        if (!plans.length) return res.json({ success: true, plans: [] });

        const hostIds = [...new Set(plans.map((p) => String(p.host)))];
        const faceIds = plans.flatMap((p) => p.attendees.slice(0, 5).map((a) => String(a.user)));
        const [meDoc, blockingMe, users] = await Promise.all([
            User.findById(me).select("blockedUsers").lean(),
            User.find({ _id: { $in: hostIds }, blockedUsers: me }).distinct("_id"),
            User.find({ _id: { $in: [...new Set([...hostIds, ...faceIds])] } }).select(CARD).lean(),
        ]);
        const hidden = new Set([...(meDoc?.blockedUsers || []), ...blockingMe].map(String));
        const byId = new Map(users.map((u) => [String(u._id), u]));
        const myId = String(me);

        res.json({
            success: true,
            plans: plans.filter((p) => !hidden.has(String(p.host)) && byId.has(String(p.host))).map((p) => ({
                _id: p._id, title: p.title, category: p.category, place: p.place, startsAt: p.startsAt,
                capacity: p.capacity, going: p.attendees.length + 1,
                host: byId.get(String(p.host)),
                faces: p.attendees.slice(0, 5).map((a) => byId.get(String(a.user))).filter(Boolean),
                status: myStatus(p, myId),
            })),
        });
    } catch (err) {
        console.error("listPlans:", err.message);
        fail(res, 500, "Could not load plans");
    }
};

/** POST /plans */
export const createPlan = async (req, res) => {
    try {
        const college = req.user.college;
        if (!college) return fail(res, 400, "Add your college to your profile to host a plan");
        const { plan, error } = parsePlan(req.body || {});
        if (error) return fail(res, 400, error);
        const active = await SundayPlan.countDocuments({ host: req.user._id, expiresAt: { $gt: new Date() } });
        if (active >= MAX_ACTIVE_PER_HOST) return fail(res, 400, `You can host up to ${MAX_ACTIVE_PER_HOST} plans at a time`);
        const doc = await SundayPlan.create({ ...plan, host: req.user._id, college });
        res.status(201).json({ success: true, plan: { _id: doc._id } });
    } catch (err) {
        console.error("createPlan:", err.message);
        fail(res, 500, "Could not create plan");
    }
};

/** GET /plans/:id — detail with every attendee. */
export const getPlan = async (req, res) => {
    try {
        const p = await findLive(req.params.id, req.user.college)?.select("-kicked").lean();
        if (!p) return fail(res, 404, "Plan not found");
        if (await isExplicitlyBlocked(req.user.id, String(p.host))) return fail(res, 404, "Plan not found");
        const users = await User.find({ _id: { $in: [p.host, ...p.attendees.map((a) => a.user)] } }).select(CARD).lean();
        const byId = new Map(users.map((u) => [String(u._id), u]));
        res.json({
            success: true,
            plan: {
                ...p,
                host: byId.get(String(p.host)) || { _id: p.host, name: "Fync user" },
                attendees: p.attendees.map((a) => ({ user: byId.get(String(a.user)), bringing: a.bringing })).filter((a) => a.user),
                going: p.attendees.length + 1,
                status: myStatus(p, req.user.id),
            },
        });
    } catch (err) {
        console.error("getPlan:", err.message);
        fail(res, 500, "Could not load plan");
    }
};

/** POST /plans/:id/join { bringing? } */
export const joinPlan = async (req, res) => {
    try {
        const me = req.user._id;
        const bringing = req.body?.bringing ? String(req.body.bringing).trim() : null;
        const plan = await findLive(req.params.id, req.user.college)?.select("host college capacity bring attendees kicked expiresAt title").lean();
        if (!plan) return fail(res, 404, "Plan not found");
        const blocked = await isExplicitlyBlocked(req.user.id, String(plan.host));
        const why = joinError({ plan, me: { _id: me, college: req.user.college }, blocked, bringing });
        if (why) return fail(res, 400, why);

        // Re-check capacity, duplicates and the claim inside the write, so two
        // people racing for the last spot (or the last speaker) can't both win.
        const cond = {
            _id: plan._id, "attendees.user": { $ne: me }, kicked: { $ne: me },
            $expr: { $lt: [{ $add: [{ $size: "$attendees" }, 1] }, "$capacity"] },
        };
        if (bringing) cond["attendees.bringing"] = { $ne: bringing };
        const ok = await SundayPlan.updateOne(cond, { $push: { attendees: { user: me, bringing } } });
        if (!ok.modifiedCount) return fail(res, 409, bringing ? "Just missed it: full, or someone claimed that" : "Just missed it: the plan filled up");

        // At most one "joined" push per plan per 10 min.
        redisClient.set(`plans:joinpush:${plan._id}`, "1", { NX: true, EX: 600 }).then(async (fresh) => {
            if (!fresh) return;
            const host = await User.findById(plan.host).select("expoPushToken").lean();
            push(host, "Sunday Plans 🎉", `${firstName(req.user)} joined "${plan.title}"`, { type: "plan", planId: String(plan._id) });
        }).catch(() => {});
        res.json({ success: true });
    } catch (err) {
        console.error("joinPlan:", err.message);
        fail(res, 500, "Could not join");
    }
};

/** POST /plans/:id/leave */
export const leavePlan = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 404, "Plan not found");
        await SundayPlan.updateOne({ _id: req.params.id }, { $pull: { attendees: { user: req.user._id } } });
        res.json({ success: true });
    } catch (err) {
        console.error("leavePlan:", err.message);
        fail(res, 500, "Could not leave");
    }
};

/** POST /plans/:id/kick { userId } — host only. */
export const kickAttendee = async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!isObjectId(req.params.id) || !isObjectId(userId)) return fail(res, 400, "Invalid request");
        const r = await SundayPlan.updateOne(
            { _id: req.params.id, host: req.user._id },
            { $pull: { attendees: { user: userId } }, $addToSet: { kicked: userId } },
        );
        if (!r.matchedCount) return fail(res, 404, "Plan not found");
        res.json({ success: true });
    } catch (err) {
        console.error("kickAttendee:", err.message);
        fail(res, 500, "Could not remove");
    }
};

/** DELETE /plans/:id — host only; tells everyone who was going. */
export const cancelPlan = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 404, "Plan not found");
        const plan = await SundayPlan.findOneAndDelete({ _id: req.params.id, host: req.user._id }).select("title attendees expiresAt").lean();
        if (!plan) return fail(res, 404, "Plan not found");
        res.json({ success: true });
        if (plan.expiresAt > new Date() && plan.attendees.length) {
            const users = await User.find({ _id: { $in: plan.attendees.map((a) => a.user) }, expoPushToken: { $nin: [null, ""] } })
                .select("expoPushToken").lean();
            users.forEach((u) => push(u, "Plan cancelled", `"${plan.title}" was cancelled by the host`, { type: "plan", screen: "SundayPlans" }));
        }
    } catch (err) {
        console.error("cancelPlan:", err.message);
        if (!res.headersSent) fail(res, 500, "Could not cancel");
    }
};

/** POST /plans/:id/report { reason? } — files against the host with the plan text. */
export const reportPlan = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 404, "Plan not found");
        const p = await SundayPlan.findOne({ _id: req.params.id, college: req.user.college }).select("host title place description").lean();
        if (!p) return fail(res, 404, "Plan not found");
        if (String(p.host) === req.user.id) return fail(res, 400, "You cannot report yourself");
        try {
            if (!(await takeReportSlot(redisClient, req.user.id))) return fail(res, 429, "Too many reports. Try again later.");
        } catch { /* Redis down: still accept the report */ }
        await Report.create({
            reporter: req.user._id,
            targetType: "user",
            targetId: String(p.host),
            targetUser: p.host,
            snapshot: `[sunday_plan ${p._id}] ${p.title} @ ${p.place}\n${p.description || ""}`.slice(0, 2000),
            reason: String(req.body?.reason || "").trim().slice(0, 300) || "Inappropriate plan",
        });
        res.status(201).json({ success: true, message: "Report submitted. Thanks for keeping Fync safe." });
    } catch (err) {
        console.error("reportPlan:", err.message);
        fail(res, 500, "Could not report");
    }
};
