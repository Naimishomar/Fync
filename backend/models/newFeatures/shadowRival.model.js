import mongoose from "mongoose";

// A snapshot of the three passively-collected metrics, taken when the pair is
// formed. Progress is always `current - start`, so no time series is stored.
const snapshotSchema = new mongoose.Schema({
    solved: { type: Number, default: 0 },   // codingStats.totalSolved
    commits: { type: Number, default: 0 },  // githubStats.totalCommits
    streak: { type: Number, default: 0 },   // streakCount
}, { _id: false });

const shadowRivalSchema = new mongoose.Schema({
    season: { type: String, required: true, index: true },
    a: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    b: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startA: { type: snapshotSchema, required: true },
    startB: { type: snapshotSchema, required: true },
    // Stamped by the nightly job whenever that side's progress increases. A side
    // that has not moved in 14 days is a dead account: the pair is dissolved and
    // both users are re-matched, invisibly, because the rival is anonymous.
    lastMoveA: { type: Date, default: Date.now },
    lastMoveB: { type: Date, default: Date.now },
    // Last totals seen by the nightly job, so "did this side move?" is a
    // comparison instead of a stored history.
    lastTotalA: { type: Number, default: 0 },
    lastTotalB: { type: Number, default: 0 },
    // Last computed leader ('a' | 'b' | null). Only a *change* pushes a
    // notification, so nobody gets pinged nightly for a lead they already hold.
    leader: { type: String, enum: ['a', 'b', null], default: null },
    revealAt: { type: Date, required: true },
    // Reveal day fires once. Without this flag the nightly job would re-push the
    // same notification every night for the rest of the season.
    revealNotified: { type: Boolean, default: false },
    // One point per nightly run, capped at a season's worth. A separate
    // time-series collection would be the "proper" answer, but 180 numbers
    // inline is a few hundred bytes and needs no join to draw the chart.
    history: {
        type: [{
            d: { type: Date, required: true },
            a: { type: Number, required: true },
            b: { type: Number, required: true },
        }],
        default: [],
    },
}, { timestamps: true });

// One pair per user per season, enforced on both slots.
shadowRivalSchema.index({ season: 1, a: 1 }, { unique: true });
shadowRivalSchema.index({ season: 1, b: 1 }, { unique: true });

const ShadowRival = mongoose.model("ShadowRival", shadowRivalSchema);
export default ShadowRival;
