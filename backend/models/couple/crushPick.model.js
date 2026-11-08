import mongoose from "mongoose";

// "Dil Se": a secret pick of someone in your college. Revealed to either side
// only when it is mutual (matchedAt set on both picks).
const crushPickSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    college: { type: String, required: true },
    matchedAt: { type: Date, default: null },
}, { timestamps: true });

crushPickSchema.index({ from: 1, to: 1 }, { unique: true });
crushPickSchema.index({ to: 1, matchedAt: 1 });

export default mongoose.model("CrushPick", crushPickSchema);
