import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, { timestamps: true });

// The list query filters on participants and sorts by updatedAt. A single-field
// index on participants serves the filter but leaves the sort to be done in
// memory over every matching document; the compound index covers both.
conversationSchema.index({ participants: 1, updatedAt: -1 });


export default mongoose.model("Conversation", conversationSchema);
