import mongoose from "mongoose";
import { CATEGORIES } from "../utils/sundayPlanRules.js";

const id = { type: mongoose.Schema.Types.ObjectId, ref: "User" };

// A free/potluck Sunday hangout for one college. Lives until Monday 06:00 IST.
const sundayPlanSchema = new mongoose.Schema({
    host: { ...id, required: true },
    college: { type: String, required: true },
    title: { type: String, required: true, maxlength: 60 },
    category: { type: String, enum: CATEGORIES, required: true },
    description: { type: String, maxlength: 300, default: "" },
    place: { type: String, required: true, maxlength: 80 },
    startsAt: { type: Date, required: true },
    capacity: { type: Number, min: 2, max: 50, required: true },
    bring: [{ type: String, maxlength: 24 }],
    attendees: [{ _id: false, user: id, bringing: { type: String, default: null } }],
    // Removed by the host; can't rejoin.
    kicked: [id],
    expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

sundayPlanSchema.index({ college: 1, expiresAt: 1, startsAt: 1 });
sundayPlanSchema.index({ host: 1, expiresAt: 1 });
sundayPlanSchema.index({ startsAt: 1 });
// No media to clean up, so Mongo's TTL monitor does the sweep. Reads also filter
// on expiresAt because the monitor only runs once a minute.
sundayPlanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SundayPlan", sundayPlanSchema);
