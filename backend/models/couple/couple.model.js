import mongoose from "mongoose";

const ref = { type: mongoose.Schema.Types.ObjectId, ref: "User" };

const bucketItemSchema = new mongoose.Schema({
    text: { type: String, required: true, maxlength: 120 },
    addedBy: ref,
    doneBy: { ...ref, default: null },
    doneAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

const coupleSchema = new mongoose.Schema({
    users: { type: [ref], required: true },
    since: { type: String, required: true }, // IST "YYYY-MM-DD"
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastBothAnsweredDay: { type: String, default: null },
    bucket: { type: [bucketItemSchema], default: [] },
    // Partners who agreed to appear on the public couples leaderboard. A couple
    // is listed only when both ids are here: being a couple is private.
    showOnBoard: { type: [ref], default: [] },
}, { timestamps: true });

// Multikey unique: no user id may appear in two couples, i.e. one active couple per user.
coupleSchema.index({ users: 1 }, { unique: true });

coupleSchema.index({ lastBothAnsweredDay: 1, streak: -1 });
coupleSchema.index({ bestStreak: -1 });

export default mongoose.model("Couple", coupleSchema);
