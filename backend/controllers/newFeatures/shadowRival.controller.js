import User from '../../models/user.model.js';
import ShadowRival from '../../models/newFeatures/shadowRival.model.js';
import {
    currentSeason, snapshot, progress, totalProgress, leaderOf, eligibilityFilter,
    rematch, seasonState, REMATCH_BUDGET,
} from '../../utils/shadowRival.js';

const STAT_FIELDS = "codingStats githubStats streakCount";
const REVEAL_FIELDS = "name username avatar major year college";

// Everything returned here is derived from stats the app already scrapes, so the
// user never uploads or logs anything.
export const getMyRival = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const { season } = currentSeason(now);

        // Deliberately not scoped to the current season. `revealAt` is the first
        // instant of the *next* season, so on reveal day the season string has
        // already rolled over — filtering by it would hide the reveal from the
        // person who spent six months earning it.
        const rivalry = await ShadowRival.findOne({ $or: [{ a: userId }, { b: userId }] })
            .sort({ createdAt: -1 })
            .lean();

        const me = await User.findById(userId).select("shadowRival").lean();
        const state = seasonState(me, season);
        const meta = {
            optOut: !!me?.shadowRival?.optOut,
            rematchesLeft: Math.max(0, REMATCH_BUDGET - state.rematchesUsed),
        };

        if (meta.optOut) {
            return res.status(200).json({
                success: true, status: 'opted_out', ...meta,
                message: "You are out of Shadow Rival. Opt back in whenever you want a match.",
            });
        }

        if (!rivalry) {
            // Unpaired: either waiting for the nightly run, or nothing about them
            // can be measured yet.
            const eligible = await User.exists({ _id: userId, ...eligibilityFilter(now) });
            return res.status(200).json({
                success: true,
                status: eligible ? 'waiting' : 'ineligible',
                ...meta,
                message: eligible
                    ? "Finding someone your size. Check back tomorrow."
                    : "Link a LeetCode, GFG or GitHub profile to get a Shadow Rival.",
            });
        }

        const iAmA = String(rivalry.a) === String(userId);
        const [meId, rivalId] = iAmA ? [rivalry.a, rivalry.b] : [rivalry.b, rivalry.a];
        const [myStart, rivalStart] = iAmA ? [rivalry.startA, rivalry.startB] : [rivalry.startB, rivalry.startA];

        const [meDoc, rivalDoc] = await Promise.all([
            User.findById(meId).select(STAT_FIELDS).lean(),
            User.findById(rivalId).select(`${STAT_FIELDS} ${REVEAL_FIELDS}`).lean(),
        ]);
        if (!rivalDoc) {
            return res.status(200).json({ success: true, status: 'waiting', ...meta, message: "Re-matching you." });
        }

        const mine = progress(myStart, snapshot(meDoc));
        const theirs = progress(rivalStart, snapshot(rivalDoc));
        const leader = leaderOf(iAmA ? mine : theirs, iAmA ? theirs : mine, rivalry.leader);

        const revealed = now >= new Date(rivalry.revealAt);

        return res.status(200).json({
            success: true,
            status: revealed ? 'revealed' : 'active',
            season: rivalry.season,
            revealAt: rivalry.revealAt,
            ...meta,
            // A finished season is read-only: no rerolling a rival you already know.
            rematchesLeft: revealed ? 0 : meta.rematchesLeft,
            me: { ...mine, total: totalProgress(mine) },
            rival: { ...theirs, total: totalProgress(theirs) },
            leading: leader === null ? null : (leader === 'a') === iAmA,
            // Oriented so `me` is always the caller, whichever slot they hold.
            history: (rivalry.history || []).map((point) => ({
                d: point.d,
                me: iAmA ? point.a : point.b,
                rival: iAmA ? point.b : point.a,
            })),
            // Identity is withheld until the season ends — that reveal is the payoff.
            identity: revealed ? {
                name: rivalDoc.name,
                username: rivalDoc.username,
                avatar: rivalDoc.avatar,
                major: rivalDoc.major,
                year: rivalDoc.year,
                college: rivalDoc.college,
            } : null,
        });
    } catch (error) {
        console.error("Get shadow rival error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Opting out dissolves the current pair immediately — leaving a partner racing a
// ghost is worse than no rival at all.
export const setOptOut = async (req, res) => {
    try {
        const userId = req.user.id;
        const optOut = req.body.optOut === true || req.body.optOut === 'true';

        await User.updateOne({ _id: userId }, { $set: { "shadowRival.optOut": optOut } });

        if (optOut) {
            const { season } = currentSeason();
            const current = await ShadowRival.findOne({ season, $or: [{ a: userId }, { b: userId }] });
            if (current) {
                // The abandoned partner remembers them, so the next pairing run
                // does not hand them straight back once they opt in again.
                const other = String(current.a) === String(userId) ? current.b : current.a;
                await User.updateOne({ _id: other }, {
                    $set: { "shadowRival.season": season },
                    $addToSet: { "shadowRival.avoid": userId },
                });
                await current.deleteOne();
            }
        }

        return res.status(200).json({
            success: true,
            optOut,
            message: optOut
                ? "You're out. Your rival has been re-pooled."
                : "You're back in. A rival will be assigned on the next run.",
        });
    } catch (error) {
        console.error("Shadow rival opt-out error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const requestRematch = async (req, res) => {
    try {
        const result = await rematch(req.user.id);
        if (result.error) return res.status(400).json({ success: false, message: result.error });

        return res.status(200).json({
            success: true,
            status: result.status,
            message: result.status === 'rematched'
                ? "New Shadow assigned. Progress starts from zero."
                : "Old rival released. Nobody free right now — you'll be matched on the next run.",
        });
    } catch (error) {
        console.error("Shadow rival rematch error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
