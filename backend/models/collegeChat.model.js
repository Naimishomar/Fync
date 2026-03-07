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
    }
}, { timestamps: true });

export default mongoose.model("CollegeChat", collegeChatSchema);
