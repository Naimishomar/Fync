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
}, { timestamps: true });

// Multikey unique: no user id may appear in two couples, i.e. one active couple per user.
coupleSchema.index({ users: 1 }, { unique: true });

export default mongoose.model("Couple", coupleSchema);
