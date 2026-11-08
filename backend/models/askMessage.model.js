import mongoose from "mongoose";

// "Ask me anything": an anonymous message to `to`. No sender id, no IP, no media;
// senderHash is a daily-salted hash (utils/askRules.js) used only for rate limits
// and blocking. Mongo's TTL monitor deletes the doc at expiresAt (7 days).
const askMessageSchema = new mongoose.Schema({
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 300 },
    senderHash: { type: String, required: true },
    answer: { type: String, maxlength: 300, default: null },
    answeredAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

askMessageSchema.index({ to: 1, createdAt: -1 });
askMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Per-user settings, kept out of user.model.js. blocked: sender hashes, each with its own expiry.
const askSettingsSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    paused: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    blocked: [{ _id: false, h: String, exp: Date }],
});

export const AskSettings = mongoose.model("AskSettings", askSettingsSchema);
export default mongoose.model("AskMessage", askMessageSchema);
