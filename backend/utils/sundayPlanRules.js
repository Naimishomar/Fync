/** Rules for Sunday Plans. Pure, so they can be tested without a DB. */
import { istDateKey, istDayStart } from "./eventTime.js";

export const CATEGORIES = ["movie", "potluck", "sports", "jam", "games", "chai", "study", "other"];
export const MAX_ACTIVE_PER_HOST = 2;
export const MIN_CAP = 2;
export const MAX_CAP = 50;
export const MAX_BRING = 8;
const HOUR = 3600000;
const IST = 5.5 * HOUR;

/** IST weekday, 0 = Sunday. */
const istDay = (t) => new Date(t.getTime() + IST).getUTCDay();

/**
 * The Sunday plans are for right now: today if it is Sunday in IST, else the
 * coming one. start/end bound that IST day; plans expire Monday 06:00 IST.
 */
export const sundayWindow = (now = new Date()) => {
    const today = istDayStart(istDateKey(now));
    const start = new Date(today.getTime() + ((7 - istDay(now)) % 7) * 24 * HOUR);
    return { start, end: new Date(start.getTime() + 24 * HOUR), expiresAt: new Date(start.getTime() + 30 * HOUR) };
};

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Validate a create body. Returns { error } or { plan } with normalised fields. */
export const parsePlan = (body = {}, now = new Date()) => {
    const title = clean(body.title, 60);
    if (title.length < 3) return { error: "Give your plan a title" };
    const category = CATEGORIES.includes(body.category) ? body.category : null;
    if (!category) return { error: "Pick a vibe" };
    const place = clean(body.place, 80);
    if (place.length < 2) return { error: "Where is it? Keep it to common areas" };
    const description = String(body.description ?? "").trim().slice(0, 300);
    const capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < MIN_CAP || capacity > MAX_CAP) {
        return { error: `Capacity must be ${MIN_CAP} to ${MAX_CAP}` };
    }
    const startsAt = new Date(body.startsAt);
    const w = sundayWindow(now);
    if (Number.isNaN(startsAt.getTime()) || startsAt < w.start || startsAt >= w.end) {
        return { error: "Plans are for this Sunday only" };
    }
    if (startsAt <= now) return { error: "That time has already passed" };
    const raw = Array.isArray(body.bring) ? body.bring : [];
    const bring = [...new Set(raw.map((b) => clean(b, 24)).filter(Boolean))].slice(0, MAX_BRING);
    return { plan: { title, category, place, description, capacity, startsAt, bring, expiresAt: w.expiresAt } };
};

/** Why a join is refused, or null. `plan.attendees` is the full list. */
export const joinError = ({ plan, me, blocked, bringing, now = new Date() }) => {
    if (!plan || plan.expiresAt <= now) return "Plan not found";
    if (!me.college || plan.college !== me.college) return "This plan is for another college";
    if (String(plan.host) === String(me._id)) return "You're hosting this one";
    if (blocked) return "You can't join this plan";
    if ((plan.kicked || []).some((k) => String(k) === String(me._id))) return "The host removed you from this plan";
    if (plan.attendees.some((a) => String(a.user) === String(me._id))) return "You're already in";
    if (plan.attendees.length + 1 >= plan.capacity) return "This plan is full";
    if (bringing) {
        if (!plan.bring.includes(bringing)) return "That isn't on the bring list";
        if (plan.attendees.some((a) => a.bringing === bringing)) return `Someone's already bringing ${bringing}`;
    }
    return null;
};
