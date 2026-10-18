import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ['follow', 'tag', 'like', 'comment', 'reply', 'story_like', 'story_comment', 'story_reply', 'split_request', 'split_paid', 'college_reply', 'FyncMedia', 'opportunity', 'hackathon_announcement', 'broadcast'],
        required: true
    },
    // No defaults on the optional fields below: an empty ref or "" on every row
    // was ~100 bytes of nothing. The client already treats missing as empty.
    hackathon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hackathon"
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    },
    shorts: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shorts"
    },
    confession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Confession"
    },
    commentText: {
        type: String
    },
    // Opportunity and hackathon_announcement notifications are written with a
    // `message`, but the field was never declared -- Mongoose strict mode
    // dropped it silently, so every one of them rendered as the client's
    // "sent you a notification." fallback instead of the real text.
    message: {
        type: String
    },
    // Optional artwork shown in the push and beside the in-app row.
    imageUrl: {
        type: String
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Industry-Grade Notification Indexes
notificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 }); // Keyset pagination
notificationSchema.index({ recipient: 1, isRead: 1 });              // Instant unread counts
// Read notifications are dropped 7 days after they were sent. Unread ones stay.
notificationSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { isRead: true } }
);

// Unread ones go after 30 days. Reading bumps updatedAt, but those are already
// gone at 7 days via the index above, so this only ever catches unread rows.
notificationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;