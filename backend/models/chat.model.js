import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  message: {
    type: String,
    required: false // Optional for media-only messages
  },
  messageType: {
    type: String,
    enum: ["text", "image", "video", "file"],
    default: "text"
  },
  mediaUrl: {
    type: String,
    default: ""
  },
  seen: {
    type: Boolean,
    default: false
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null
  }
}, { timestamps: true });

export default mongoose.model("Message", messageSchema);
