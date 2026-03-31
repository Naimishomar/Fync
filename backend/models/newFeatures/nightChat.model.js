import mongoose from "mongoose";

const nightChatSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        trim: true
    },
    messageType: {
        type: String,
        enum: ['text', 'image'],
        default: 'text'
    },
    fileUrl: {
        type: String
    },
    replyTo: {
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: "NightMessage" },
        text: String,
        senderName: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 21600 // 6 hours
    }
});

const NightMessage = mongoose.model("NightMessage", nightChatSchema);
export default NightMessage;