/** Rules for "Sunday Match" (weekly opt-in matchmaking). Pure, so they can be tested without a DB. */
import { istDateKey, istInstant } from "./eventTime.js";

export const INTERESTS = [
    "music", "gaming", "coding", "cricket", "movies", "anime", "gym", "travel",
    "food", "dance", "books", "photography", "startups", "fashion", "art", "football",
    "debate", "memes", "singing", "standup", "badminton", "poetry", "volunteering", "podcasts",
];
export const MAX_INTERESTS = 8;
export const VIBES = [
    { q: "Ideal Sunday", options: ["Long brunch", "Netflix in bed", "Out exploring", "Grinding a project"] },
    { q: "Night owl or early bird", options: ["Night owl 🦉", "Early bird 🐦", "Depends on the day"] },
    { q: "Chai or coffee", options: ["Chai ☕", "Coffee", "Neither, juice"] },
];
export const INTENTS = ["friendship", "dating"];
export const INTERESTED_IN = ["men", "women", "everyone"];
export const MATCH_DAYS = 7;
export const COOLDOWN_WEEKS = 4;
const DAY = 86400000;

/** Next Sunday 19:00 IST strictly after `now`. */
export const nextSundayAt = (now = new Date()) => {
    for (let i = 0; i < 8; i++) {
        const key = istDateKey(new Date(now.getTime() + i * DAY));
        const at = istInstant(key, "19:00");
        if (new Date(`${key}T00:00:00Z`).getUTCDay() === 0 && at > now) return at;
    }
};

export const ageOn = (dob, now = new Date()) => {
    const d = new Date(dob);
    let age = now.getUTCFullYear() - d.getUTCFullYear();
    if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age--;
    return age;
};

/** Why a profile save is refused, or null. `body` is the client input, `user` the auth'd user doc. */
export const profileError = (body, user, now = new Date()) => {
    const { intent, interestedIn, interests, vibes, ageConfirmed } = body || {};
    if (!user?.college) return "Add your college to your profile first";
    if (ageConfirmed !== true) return "You must confirm you are 18 or older";
    if (user.dob && ageOn(user.dob, now) < 18) return "Sunday Match is for 18+ only";
    if (!INTENTS.includes(intent)) return "Pick friendship or dating";
    if (intent === "dating" && !INTERESTED_IN.includes(interestedIn)) return "Pick who you're interested in";
    if (intent === "dating" && !user.gender) return "Add your gender to your profile first";
    if (!Array.isArray(interests) || !interests.length || interests.length > MAX_INTERESTS
        || new Set(interests).size !== interests.length || !interests.every((t) => INTERESTS.includes(t))) {
        return `Pick 1 to ${MAX_INTERESTS} interests`;
    }
    if (!Array.isArray(vibes) || vibes.length !== VIBES.length
        || !vibes.every((v, i) => Number.isInteger(v) && v >= 0 && v < VIBES[i].options.length)) {
        return "Answer all 3 vibe questions";
    }
    return null;
};

const WANTS = { men: ["Male"], women: ["Female"], everyone: ["Male", "Female", "Other"] };
const accepts = (p, q) => (WANTS[p.interestedIn] || []).includes(q.gender);

/** Can these two be paired at all (ignoring blocks/history)? */
export const compatible = (p, q) =>
    p.intent === q.intent && (p.intent !== "dating" || (accepts(p, q) && accepts(q, p)));

export const sharedInterests = (p, q) => p.interests.filter((t) => q.interests.includes(t));
export const score = (p, q) =>
    sharedInterests(p, q).length * 2 + p.vibes.filter((v, i) => v === q.vibes[i]).length;

export const pairKey = (a, b) => (String(a) < String(b) ? `${a}|${b}` : `${b}|${a}`);

// FNV-1a: deterministic per-week order, so the same people don't always pick first.
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/**
 * Greedy weekly pairing. profiles: [{ id, intent, interestedIn, gender, interests, vibes, priority }].
 * excluded: Set of pairKey (blocks, recent/reported matches). Priority people (unmatched last week) pick first;
 * each picks their best-scoring free partner, ties broken by lower id. Returns { pairs, unmatched }.
 * ponytail: O(n²) per college, fine for a few thousand opted-in per college; bucket by intent/gender if it grows.
 */
export const pairUp = (profiles, excluded = new Set(), weekKey = "") => {
    const order = [...profiles].sort((x, y) =>
        (y.priority ? 1 : 0) - (x.priority ? 1 : 0)
        || hash(x.id + weekKey) - hash(y.id + weekKey)
        || (x.id < y.id ? -1 : 1));
    const taken = new Set();
    const pairs = [];
    for (const p of order) {
        if (taken.has(p.id)) continue;
        let best = null, bestScore = -1;
        for (const q of order) {
            if (q.id === p.id || taken.has(q.id) || !compatible(p, q) || excluded.has(pairKey(p.id, q.id))) continue;
            const s = score(p, q);
            if (s > bestScore || (s === bestScore && q.id < best.id)) { best = q; bestScore = s; }
        }
        if (!best) continue;
        taken.add(p.id); taken.add(best.id);
        pairs.push({ a: p.id, b: best.id, score: bestScore, sharedInterests: sharedInterests(p, best) });
    }
    return { pairs, unmatched: profiles.filter((p) => !taken.has(p.id)).map((p) => p.id) };
};
