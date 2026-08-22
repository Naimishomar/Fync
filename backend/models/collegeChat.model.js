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


// Covers the list query's filter AND its sort; without it the sort ran in
// memory over every matching document.
collegeChatSchema.index({ collegeName: 1, expiresAt: 1, createdAt: 1 });

export default mongoose.model("CollegeChat", collegeChatSchema);
