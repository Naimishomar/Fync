import mongoose from "mongoose";

// Sunday Match opt-in profile, one per user. Validation lives in utils/sundayMatchRules.js.
const sundayMatchProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    college: { type: String, required: true },
    optedIn: { type: Boolean, default: false },
    intent: { type: String, enum: ["friendship", "dating"], required: true },
    interestedIn: { type: String, enum: ["men", "women", "everyone", null], default: null },
    interests: [{ type: String }],
    vibes: [{ type: Number }],
    ageConfirmedAt: { type: Date, required: true },
    // Left out last week: picks first next week.
    priority: { type: Boolean, default: false },
}, { timestamps: true });

sundayMatchProfileSchema.index({ college: 1, optedIn: 1 });

export default mongoose.model("SundayMatchProfile", sundayMatchProfileSchema);
