import cron from "node-cron";
import SundayPlan from "../models/sundayPlan.model.js";
import User from "../models/user.model.js";
import { sendPushNotification } from "./notification.js";
import { mapLimit } from "./r2Upload.js";
import { sundayWindow } from "./sundayPlanRules.js";

const PUSH_CONCURRENCY = 5;
const BATCH = 200;
const TZ = { timezone: "Asia/Kolkata" };

/** Saturday 18:00: "Kal Sunday hai" to every user in a college that has plans. */
export const saturdayReminder = async () => {
    const { start, end } = sundayWindow();
    const counts = await SundayPlan.aggregate([
        { $match: { startsAt: { $gte: start, $lt: end } } },
        { $group: { _id: "$college", n: { $sum: 1 } } },
    ]);
    let sent = 0;
    for (const { _id: college, n } of counts) {
        const body = `${n} plan${n === 1 ? "" : "s"} in your college this Sunday. Join one or host your own`;
        // Streamed in batches so a big college never sits in memory at once.
        const cursor = User.find({ college, expoPushToken: { $nin: [null, ""] } }).select("expoPushToken").lean().cursor({ batchSize: BATCH });
        let batch = [];
        const flush = async () => {
            await mapLimit(batch, PUSH_CONCURRENCY, (u) => sendPushNotification(u.expoPushToken, "Kal Sunday hai 🎉", body, { type: "plan", screen: "SundayPlans" }).catch(() => {}));
            sent += batch.length;
            batch = [];
        };
        for await (const u of cursor) {
            batch.push(u);
            if (batch.length >= BATCH) await flush();
        }
        if (batch.length) await flush();
    }
    return sent;
};

/** Sunday 10:00: remind hosts and attendees of today's plans. */
export const sundayReminder = async () => {
    const { start, end } = sundayWindow();
    const plans = await SundayPlan.find({ startsAt: { $gte: start, $lt: end } }).select("host attendees.user title startsAt").lean();
    const jobs = [];
    for (const p of plans) {
        const time = p.startsAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
        for (const id of [p.host, ...p.attendees.map((a) => a.user)]) jobs.push({ id, title: p.title, time, planId: String(p._id) });
    }
    for (let i = 0; i < jobs.length; i += BATCH) {
        const slice = jobs.slice(i, i + BATCH);
        const users = await User.find({ _id: { $in: slice.map((j) => j.id) }, expoPushToken: { $nin: [null, ""] } }).select("expoPushToken").lean();
        const tokens = new Map(users.map((u) => [String(u._id), u.expoPushToken]));
        await mapLimit(slice.filter((j) => tokens.has(String(j.id))), PUSH_CONCURRENCY, (j) =>
            sendPushNotification(tokens.get(String(j.id)), "Today's the day 🎉", `"${j.title}" at ${j.time}`, { type: "plan", screen: "PlanDetail", planId: j.planId }).catch(() => {}));
    }
    return jobs.length;
};

export const initSundayPlans = () => {
    const run = (name, fn) => async () => {
        try { console.log(`🎉 Sunday Plans ${name}: ${await fn()} pushes`); } catch (e) { console.error(`❌ Sunday Plans ${name} failed:`, e.message); }
    };
    cron.schedule("0 18 * * 6", run("Saturday reminder", saturdayReminder), TZ);
    cron.schedule("0 10 * * 0", run("Sunday reminder", sundayReminder), TZ);
};
