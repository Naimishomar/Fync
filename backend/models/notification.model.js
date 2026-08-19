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
    hackathon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hackathon",
        default: null
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        default: null
    },
    shorts: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shorts",
        default: null
    },
    confession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Confession",
        default: null
    },
    commentText: {
        type: String,
        default: ""
    },
    // Opportunity and hackathon_announcement notifications are written with a
    // `message`, but the field was never declared -- Mongoose strict mode
    // dropped it silently, so every one of them rendered as the client's
    // "sent you a notification." fallback instead of the real text.
    message: {
        type: String,
        default: ""
    },
    // Optional artwork shown in the push and beside the in-app row.
    imageUrl: {
        type: String,
        default: ""
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Industry-Grade Notification Indexes
notificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 }); // Keyset pagination
notificationSchema.index({ recipient: 1, isRead: 1 });              // Instant unread counts

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;