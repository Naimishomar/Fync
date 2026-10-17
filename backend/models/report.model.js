import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Exactly one of post / short / targetType is set.
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: function () { return !this.short && !this.targetType; }
    },
    short: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shorts"
    },
    // Everything reported through /safety (12 AM Club, confessions, users, DMs).
    // Night chat is wiped at sunrise and DMs live in Supabase, so `snapshot`
    // keeps what was said for the admin, and `targetUser` is the real author
    // the server resolved (never shown to the reporter for anonymous targets).
    targetType: {
        type: String,
        enum: ["night_message", "night_user", "confession", "confession_comment", "user", "chat_message"]
    },
    targetId: { type: String },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    snapshot: { type: String, maxlength: 2000 },
    reason: {
        type: String,
        required: true,
        default: "Inappropriate content"
    },
    status: {
        type: String,
        enum: ["pending", "resolved", "dismissed"],
        default: "pending"
    }
}, { timestamps: true });

const Report = mongoose.model("Report", reportSchema);
export default Report;
