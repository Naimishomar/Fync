import mongoose from "mongoose";

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

// A 24-hour post seen only by the author's college. Expired stories are hidden
// by every read (expiresAt > now) and swept, image included, by
// utils/storyCleanup.js. No Mongo TTL index: it would drop the document and
// leave its R2 image behind.
const storySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    college: { type: String, default: null },
    image: { type: String, default: null },
    text: { type: String, trim: true, maxlength: 300, default: "" },
    bg: { type: String, default: "#F97316" },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + STORY_TTL_MS) },
}, { timestamps: true });

storySchema.index({ college: 1, expiresAt: 1 });
storySchema.index({ user: 1, expiresAt: 1 });
storySchema.index({ expiresAt: 1 });

export default mongoose.model("Story", storySchema);
