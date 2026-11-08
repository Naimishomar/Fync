import mongoose from "mongoose";
import { KINDS, GENDERS, FOODS, AMENITIES, HABITS } from "../utils/stayRules.js";

// PG & Roommates listing. Deliberately no TTL index: a TTL delete would orphan
// the R2 photos, so utils/stayCleanup.js sweeps expired docs and their media.
const staySchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    college: { type: String, required: true },
    kind: { type: String, enum: KINDS, required: true },
    title: { type: String, required: true, maxlength: 70 },
    rent: { type: Number, required: true },
    deposit: { type: Number, default: null },
    area: { type: String, required: true, maxlength: 80 },
    distanceKm: { type: Number, default: null },
    forGender: { type: String, enum: GENDERS, default: "any" },
    food: { type: String, enum: FOODS, default: "none" },
    amenities: [{ type: String, enum: AMENITIES }],
    moveIn: { type: Date, default: null },
    budget: { type: Number, default: null },
    habits: [{ type: String, enum: HABITS }],
    description: { type: String, default: "", maxlength: 500 },
    photos: [String],
    status: { type: String, enum: ["active", "filled"], default: "active" },
    renewed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

staySchema.index({ college: 1, expiresAt: 1, createdAt: -1 });
staySchema.index({ owner: 1 });
// The cleanup sweep: expired docs, oldest first, without a collection scan.
staySchema.index({ expiresAt: 1 });

export default mongoose.model("Stay", staySchema);
