import mongoose from "mongoose";

const collegeChatSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    collegeName: {
        type: String,
        required: true,
    },
    messageType: {
        type: String,
        enum: ["text", "image", "video", "file", "voice"],
        default: "text",
        required: true,
    },
    content: {
        type: String,
        default: "",
        maxlength: 10000,
    },
    mediaUrl: {
        type: String,
        default: "",
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CollegeChat",
        default: null
    }
}, { timestamps: true });


// Equality, then sort: the list query sorts on createdAt and only range-filters
// expiresAt. The old { collegeName, expiresAt, createdAt } put the range before
// the sort key, so Mongo could not use it for the sort.
collegeChatSchema.index({ collegeName: 1, createdAt: 1 });

export default mongoose.model("CollegeChat", collegeChatSchema);
