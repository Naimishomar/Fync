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
    video: { type: String, default: null },
    text: { type: String, trim: true, maxlength: 300, default: "" },
    bg: { type: String, default: "#F97316" },
    // "Ask me anything" sticker: viewers can send the author an anonymous
    // question (same inbox and rate limits as the public /ask/:username link).
    ask: { type: Boolean, default: false },
    // Background music from Audius (streamed from Audius by the app, never
    // stored here). Only the track id + display text; the app builds the
    // stream URL from the id, so no client-supplied URL is ever played.
    music: {
        type: new mongoose.Schema({
            id: { type: String, match: /^[A-Za-z0-9]{1,20}$/ },
            title: { type: String, maxlength: 120 },
            artist: { type: String, maxlength: 80 },
        }, { _id: false }),
        default: null,
    },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + STORY_TTL_MS) },
}, { timestamps: true });

storySchema.index({ college: 1, expiresAt: 1 });
storySchema.index({ user: 1, expiresAt: 1 });
storySchema.index({ expiresAt: 1 });

export default mongoose.model("Story", storySchema);
