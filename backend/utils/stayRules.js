/** Rules for PG & Roommates. Pure, so they can be tested without a DB. */
export const KINDS = ["pg", "flat", "roommate"];
export const GENDERS = ["male", "female", "any"];
export const FOODS = ["veg", "nonveg", "both", "none"];
export const AMENITIES = ["wifi", "ac", "laundry", "food", "power-backup", "parking", "gym", "attached-bathroom", "furnished", "housekeeping"];
export const HABITS = ["early-bird", "night-owl", "non-smoker", "clean", "studious", "social"];
export const MAX_ACTIVE = 3;
export const MAX_PHOTOS = 4;
export const PAGE = 20;
export const MIN_RENT = 500;
export const MAX_RENT = 200000;
const DAY = 86400000;
export const LIFE_MS = 30 * DAY;

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** Multipart sends arrays as repeated keys, a lone value or a comma string. */
export const list = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : String(v).split(","))
    .map((x) => String(x).trim()).filter(Boolean);
const subset = (v, allowed) => [...new Set(list(v).filter((x) => allowed.includes(x)))];
const num = (v) => (v === "" || v == null ? null : Number(v));
const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/** Validate a listing body. Returns { error } or { stay } with normalised fields. */
export const parseStay = (body = {}, now = new Date()) => {
    const kind = KINDS.includes(body.kind) ? body.kind : null;
    if (!kind) return { error: "Pick PG, flat or roommate" };
    const title = clean(body.title, 70);
    if (title.length < 3) return { error: "Give your listing a title" };
    const rent = num(body.rent);
    if (!intIn(rent, MIN_RENT, MAX_RENT)) return { error: `Rent must be ₹${MIN_RENT} to ₹${MAX_RENT} a month` };
    const deposit = num(body.deposit);
    if (deposit != null && !intIn(deposit, 0, 1000000)) return { error: "Deposit looks off" };
    const area = clean(body.area, 80);
    if (area.length < 2) return { error: "Which area or locality?" };
    let distanceKm = num(body.distanceKm);
    if (distanceKm != null) {
        if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 50) return { error: "Distance must be 0 to 50 km" };
        distanceKm = Math.round(distanceKm * 10) / 10;
    }
    const stay = {
        kind, title, rent, deposit, area, distanceKm,
        forGender: GENDERS.includes(body.forGender) ? body.forGender : "any",
        food: FOODS.includes(body.food) ? body.food : "none",
        amenities: subset(body.amenities, AMENITIES),
        description: String(body.description ?? "").trim().slice(0, 500),
        moveIn: null, budget: null, habits: [],
    };
    if (kind === "roommate") {
        if (body.moveIn) {
            const d = new Date(body.moveIn);
            if (Number.isNaN(d.getTime()) || d.getTime() < now.getTime() - 60 * DAY || d.getTime() > now.getTime() + 365 * DAY) {
                return { error: "Move-in date looks off" };
            }
            stay.moveIn = d;
        }
        const budget = num(body.budget);
        if (budget != null && !intIn(budget, MIN_RENT, MAX_RENT)) return { error: `Budget must be ₹${MIN_RENT} to ₹${MAX_RENT}` };
        stay.budget = budget;
        stay.habits = subset(body.habits, HABITS);
    }
    return { stay };
};

/** Renewing adds 30 days, once per listing. */
export const renewError = (stay, now = new Date()) => {
    if (!stay || stay.expiresAt <= now) return "Listing not found";
    if (stay.renewed) return "You've already renewed this listing once";
    return null;
};

const ID = /^[a-f\d]{24}$/i;
/**
 * Mongo filter + sort for GET /stays. Cursor is "<value>_<id>" of the last row:
 * createdAt ms for newest, rent for cheapest. Unknown filter values are ignored.
 */
export const listQuery = (q = {}, college, now = new Date()) => {
    const filter = { college, status: "active", expiresAt: { $gt: now } };
    if (KINDS.includes(q.kind)) filter.kind = q.kind;
    const maxRent = Number(q.maxRent);
    if (Number.isFinite(maxRent) && maxRent > 0) filter.rent = { $lte: maxRent };
    if (q.gender === "male" || q.gender === "female") filter.forGender = { $in: [q.gender, "any"] };
    if (q.food === "veg" || q.food === "nonveg") filter.food = { $in: [q.food, "both"] };
    const am = subset(q.amenities, AMENITIES);
    if (am.length) filter.amenities = { $all: am };

    const cheapest = q.sort === "cheapest";
    const sort = cheapest ? { rent: 1, _id: 1 } : { createdAt: -1, _id: -1 };
    const [v, id] = String(q.cursor || "").split("_");
    if (id && ID.test(id) && Number.isFinite(Number(v))) {
        const val = cheapest ? Number(v) : new Date(Number(v));
        const op = cheapest ? "$gt" : "$lt";
        const key = cheapest ? "rent" : "createdAt";
        filter.$or = [{ [key]: { [op]: val } }, { [key]: val, _id: { [op]: id } }];
    }
    return { filter, sort, cursorOf: (s) => `${cheapest ? s.rent : new Date(s.createdAt).getTime()}_${s._id}` };
};
