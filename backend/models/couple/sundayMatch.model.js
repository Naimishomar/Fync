import mongoose from "mongoose";

// One weekly Sunday Match pair. Visible to a and b only while active and not expired.
const sundayMatchSchema = new mongoose.Schema({
    weekKey: { type: String, required: true }, // IST date of that Sunday, "YYYY-MM-DD"
    a: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    b: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    college: { type: String, required: true },
    score: { type: Number, default: 0 },
    sharedInterests: [{ type: String }],
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    aUnmatched: { type: Boolean, default: false },
    bUnmatched: { type: Boolean, default: false },
    // Reported pairs are never paired again (cooldown doesn't apply).
    reported: { type: Boolean, default: false },
}, { timestamps: true });

// One match per person per week; also the lookup for "my current match".
sundayMatchSchema.index({ a: 1, weekKey: 1 }, { unique: true });
sundayMatchSchema.index({ b: 1, weekKey: 1 }, { unique: true });
// Cron: recent + reported pairs per college.
sundayMatchSchema.index({ college: 1, createdAt: -1 });
sundayMatchSchema.index({ college: 1, reported: 1 });

export default mongoose.model("SundayMatch", sundayMatchSchema);
