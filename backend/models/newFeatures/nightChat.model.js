import mongoose from "mongoose";

const nightChatSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 21600
    }
});

const NightMessage = mongoose.model("NightMessage", nightChatSchema);
export default NightMessage;