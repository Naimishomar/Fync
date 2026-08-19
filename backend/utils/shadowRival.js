import cron from "node-cron";
import User from "../models/user.model.js";
import ShadowRival from "../models/newFeatures/shadowRival.model.js";
import { sendPushNotification } from "../services/push.service.js";

// A rival that has not moved in this long is a dead account. Both sides are
// dissolved and re-matched rather than left staring at two flat bars.
const DEAD_AFTER_DAYS = 14;
// Only users seen recently enter the matching pool, for the same reason.
const ACTIVE_WITHIN_DAYS = 14;

// ── Pure helpers (unit tested in shadowRival.test.js) ────────────────────────

// Seasons are derived, not configured: Jan–Jun and Jul–Dec. `revealAt` is the
// first instant of the next season, which is when identities unlock.
export const currentSeason = (now = new Date()) => {
    const year = now.getUTCFullYear();
    const isSpring = now.getUTCMonth() < 6;
    return {
        season: `${year}-${isSpring ? 'SPRING' : 'FALL'}`,
        revealAt: isSpring ? new Date(Date.UTC(year, 6, 1)) : new Date(Date.UTC(year + 1, 0, 1)),
    };
};

// Everything here is already scraped for other features: coding profiles by
// codingCron, commits by github.service, streak by streak.js. The user uploads
// nothing.
export const snapshot = (user) => ({
    solved: user?.codingStats?.totalSolved || 0,
    commits: user?.githubStats?.totalCommits || 0,
    streak: user?.streakCount || 0,
});

export const progress = (start, now) => ({
    solved: Math.max(0, now.solved - start.solved),
    commits: Math.max(0, now.commits - start.commits),
    streak: Math.max(0, now.streak - start.streak),
});

export const totalProgress = (p) => p.solved + p.commits + p.streak;

// Best-of-three rather than a weighted sum: solved, commits and streak are in
// different units, and any weighting would be a number nobody can defend.
// A 1-1-1 split leaves the lead where it was.
export const leaderOf = (pa, pb, previous = null) => {
    const wins = ['solved', 'commits', 'streak'].reduce(
        (acc, k) => acc + (pa[k] > pb[k] ? 1 : pa[k] < pb[k] ? -1 : 0), 0
    );
    if (wins > 0) return 'a';
    if (wins < 0) return 'b';
    return previous;
};

// Year is the only hard constraint: a rival from another college is fine, and
// cross-college matching is what keeps the pool deep enough to find someone your
// size. Comparability comes from the strength sort below, not from the cohort.
// An odd user out is left unpaired and picked up by tomorrow's run.
//
// `shadowRival.avoid` holds the rivals a user has already had this season, so a
// rematch cannot hand back the same person and the nightly run cannot quietly
// undo one. Neighbours are therefore *candidates*, not guaranteed partners: when
// the nearest one is excluded we walk forward to the next acceptable user, which
// widens the strength gap by the minimum the exclusions allow.
// ponytail: O(n·k) with k = avoid-list length, which is bounded by the rematch
// budget. A user with hundreds of exclusions would degrade to O(n²).
export const pairUp = (users) => {
    const cohorts = new Map();
    for (const u of users) {
        const key = String(u.year);
        if (!cohorts.has(key)) cohorts.set(key, []);
        cohorts.get(key).push(u);
    }

    const avoids = (x, y) => {
        const xa = x.shadowRival?.avoid || [];
        const ya = y.shadowRival?.avoid || [];
        return xa.some((id) => String(id) === String(y._id))
            || ya.some((id) => String(id) === String(x._id));
    };

    const pairs = [];
    for (const cohort of cohorts.values()) {
        const strength = (u) => {
            const s = snapshot(u);
            return s.solved + s.commits;
        };
        cohort.sort((x, y) => strength(x) - strength(y));

        const used = new Set();
        for (let i = 0; i < cohort.length; i++) {
            if (used.has(i)) continue;
            for (let j = i + 1; j < cohort.length; j++) {
                if (used.has(j) || avoids(cohort[i], cohort[j])) continue;
                pairs.push([cohort[i], cohort[j]]);
                used.add(i);
                used.add(j);
                break;
            }
        }
    }
    return pairs;
};

// A user is worth matching only if at least one metric can actually move for
// them, and they have opened the app recently.
export const eligibilityFilter = (now = new Date()) => ({
    isBanned: { $ne: true },
    "shadowRival.optOut": { $ne: true },
    updatedAt: { $gte: new Date(now.getTime() - ACTIVE_WITHIN_DAYS * 86400000) },
    $or: [
        { "codingProfiles.leetcode": { $nin: [null, ""] } },
        { "codingProfiles.gfg": { $nin: [null, ""] } },
        { githubUsername: { $nin: [null, ""] } },
    ],
});

// ── Jobs ─────────────────────────────────────────────────────────────────────

const MATCH_FIELDS = "year codingStats githubStats streakCount shadowRival";

export const runPairing = async (now = new Date()) => {
    const { season, revealAt } = currentSeason(now);

    const paired = await ShadowRival.find({ season }).select("a b").lean();
    const taken = new Set(paired.flatMap((p) => [String(p.a), String(p.b)]));

    const candidates = (await User.find(eligibilityFilter(now)).select(MATCH_FIELDS).lean())
        .filter((u) => !taken.has(String(u._id)))
        // Exclusions expire with the season. Normalising here means pairUp can
        // read `avoid` directly without knowing what season it is.
        .map((u) => ({ ...u, shadowRival: { avoid: seasonState(u, season).avoid } }));

    const pairs = pairUp(candidates);
    for (const [x, y] of pairs) {
        try {
            await ShadowRival.create({
                season, revealAt,
                a: x._id, b: y._id,
                startA: snapshot(x), startB: snapshot(y),
                lastMoveA: now, lastMoveB: now,
            });
        } catch (err) {
            // Duplicate key: another worker paired one of them first. Skip.
            if (err.code !== 11000) console.error("Shadow Rival pairing error:", err.message);
        }
    }
    console.log(`👥 Shadow Rival: ${pairs.length} new pairs for ${season}`);
    return pairs.length;
};

const push = async (userId, body, title = "Your Shadow moved 👤") => {
    const user = await User.findById(userId).select("fcmTokens shadowRival.optOut").lean();
    // Opting out silences the pushes too, not just the pairing.
    if (!user || user.shadowRival?.optOut) return;
    const tokens = user.fcmTokens?.filter(Boolean) || [];
    if (!tokens.length) return;
    // No Notification document: that model requires a sender, and naming one
    // would break the anonymity the whole feature rests on.
    await sendPushNotification(tokens, {
        title,
        body,
        data: { screen: "ShadowRival" },
    });
};

// How many history points to keep. One per nightly run, so a little over a
// season — enough to draw the whole race and no more.
const HISTORY_CAP = 200;

export const runNightlyCheck = async (now = new Date()) => {
    const dead = new Date(now.getTime() - DEAD_AFTER_DAYS * 86400000);

    // Deliberately NOT filtered by season. `revealAt` is the first instant of the
    // *next* season, so on reveal day a rivalry's season string is already stale
    // — scoping this query to the current season would skip the reveal entirely.
    const rivalries = await ShadowRival.find({ revealNotified: false });
    for (const r of rivalries) {
        const [ua, ub] = await Promise.all([
            User.findById(r.a).select(MATCH_FIELDS).lean(),
            User.findById(r.b).select(MATCH_FIELDS).lean(),
        ]);
        if (!ua || !ub) { await r.deleteOne(); continue; }

        const pa = progress(r.startA, snapshot(ua));
        const pb = progress(r.startB, snapshot(ub));
        const ta = totalProgress(pa), tb = totalProgress(pb);

        // One point per run, oldest dropped. `$slice` is applied by the update
        // below rather than trimming in JS, so a doc edited by two workers cannot
        // grow past the cap.
        r.history.push({ d: now, a: ta, b: tb });
        if (r.history.length > HISTORY_CAP) r.history = r.history.slice(-HISTORY_CAP);

        if (ta > r.lastTotalA) { r.lastTotalA = ta; r.lastMoveA = now; }
        if (tb > r.lastTotalB) { r.lastTotalB = tb; r.lastMoveB = now; }

        const next = leaderOf(pa, pb, r.leader);

        if (now >= new Date(r.revealAt)) {
            // Reveal day. The pair is kept — the identity card and the final
            // chart are the payoff the whole season was building to — but it
            // stops being tracked and both users return to the pool.
            r.leader = next;
            r.revealNotified = true;
            await r.save();
            await Promise.all([
                push(r.a, "Your Shadow Rival is revealed. See who it was.", "Reveal day 🎭"),
                push(r.b, "Your Shadow Rival is revealed. See who it was.", "Reveal day 🎭"),
            ]);
            continue;
        }

        if (next !== r.leader && next) {
            const behind = next === 'a' ? r.b : r.a;
            await push(behind, "Your Shadow Rival just took the lead. Take it back.");
            r.leader = next;
        }
        await r.save();

        if (r.lastMoveA < dead || r.lastMoveB < dead) {
            // A dead rival is dissolved, but both sides remember each other so
            // the next pairing run does not hand back the same flat bars.
            await Promise.all([
                User.updateOne({ _id: r.a }, { $addToSet: { "shadowRival.avoid": r.b } }),
                User.updateOne({ _id: r.b }, { $addToSet: { "shadowRival.avoid": r.a } }),
            ]);
            await r.deleteOne();
        }
    }
    console.log(`🕶️  Shadow Rival: checked ${rivalries.length} rivalries`);
};

// How many times a user may reroll their rival in one season. One: enough to
// escape a bad match, few enough that nobody can shop for a weak opponent.
export const REMATCH_BUDGET = Number(process.env.SHADOW_RIVAL_REMATCH_BUDGET || 1);

// `rematchesUsed` and `avoid` are per-season. Rather than a job that clears them
// every six months, they carry the season they belong to and reset on read.
export const seasonState = (user, season) => {
    const state = user?.shadowRival || {};
    return state.season === season
        ? { rematchesUsed: state.rematchesUsed || 0, avoid: state.avoid || [] }
        : { rematchesUsed: 0, avoid: [] };
};

/**
 * Dissolve a user's current pair and find them a new rival immediately, rather
 * than making them wait for the nightly run.
 * @returns {{status: 'rematched'|'waiting', error?: string}}
 */
export const rematch = async (userId, now = new Date()) => {
    const { season, revealAt } = currentSeason(now);

    const me = await User.findById(userId).select(`${MATCH_FIELDS} shadowRival`).lean();
    if (!me) return { error: "User not found" };
    if (me.shadowRival?.optOut) return { error: "You have opted out of Shadow Rival" };

    const state = seasonState(me, season);
    if (state.rematchesUsed >= REMATCH_BUDGET) {
        return { error: `No rematches left this season (${REMATCH_BUDGET} per season)` };
    }

    const current = await ShadowRival.findOne({ season, $or: [{ a: userId }, { b: userId }] });
    const oldRival = current
        ? (String(current.a) === String(userId) ? current.b : current.a)
        : null;

    // Both sides remember each other before the pair is torn down, so neither the
    // reroll nor the nightly run can pair them again this season.
    if (current) {
        await Promise.all([
            User.updateOne({ _id: current.a }, {
                $set: { "shadowRival.season": season },
                $addToSet: { "shadowRival.avoid": current.b },
            }),
            User.updateOne({ _id: current.b }, {
                $set: { "shadowRival.season": season },
                $addToSet: { "shadowRival.avoid": current.a },
            }),
        ]);
        await current.deleteOne();
    }

    // The budget is spent whether or not a partner is available right now —
    // otherwise a user could reroll repeatedly whenever the pool is empty.
    await User.updateOne({ _id: userId }, {
        $set: { "shadowRival.season": season, "shadowRival.rematchesUsed": state.rematchesUsed + 1 },
    });

    const avoid = [...state.avoid.map(String), ...(oldRival ? [String(oldRival)] : [])];

    const paired = await ShadowRival.find({ season }).select("a b").lean();
    const taken = new Set(paired.flatMap((p) => [String(p.a), String(p.b)]));

    const partner = (await User.find({
        ...eligibilityFilter(now),
        _id: { $ne: userId },
        year: me.year,
    }).select(MATCH_FIELDS).lean())
        .filter((u) => !taken.has(String(u._id)) && !avoid.includes(String(u._id)))
        .filter((u) => !(u.shadowRival?.avoid || []).some((id) => String(id) === String(userId)))
        // Closest in strength, same rule the batch pairing uses.
        .sort((x, y) => {
            const strength = (u) => snapshot(u).solved + snapshot(u).commits;
            const mine = strength(me);
            return Math.abs(strength(x) - mine) - Math.abs(strength(y) - mine);
        })[0];

    if (!partner) return { status: 'waiting' };

    try {
        await ShadowRival.create({
            season, revealAt,
            a: me._id, b: partner._id,
            startA: snapshot(me), startB: snapshot(partner),
            lastMoveA: now, lastMoveB: now,
        });
    } catch (err) {
        // Someone else claimed the partner between the read and the write.
        if (err.code === 11000) return { status: 'waiting' };
        throw err;
    }
    return { status: 'rematched' };
};

const initShadowRival = () => {
    cron.schedule('0 1 * * *', () => runNightlyCheck().catch((e) => console.error("Shadow Rival nightly error:", e.message)));
    cron.schedule('0 3 * * *', () => runPairing().catch((e) => console.error("Shadow Rival pairing error:", e.message)));
};

export default initShadowRival;
