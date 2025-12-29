import Message from "../models/chat.model.js";
import Conversation from "../models/conversation.model.js";

export const socketController = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join", ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(conversationId);
    });

    socket.on("sendMessage", async ({ conversationId, senderId, text }) => {
      try {
        if (!conversationId || !senderId || !text?.trim()) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;
        const receiverId = conversation.participants.find(
          id => id.toString() !== senderId
        );

        if (!receiverId) return;

        let message = await Message.create({
          conversationId,
          sender: senderId,
          message: text.trim()
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          $inc: { [`unreadCount.${receiverId}`]: 1 }
        });

        message = await message.populate(
          "sender",
          "name username avatar"
        );

        io.to(conversationId).emit("newMessage", message);
      } catch (err) {
        console.error("sendMessage error:", err);
      }
    });

    socket.on("markSeen", async ({ conversationId, userId }) => {
      try {
        if (!conversationId || !userId) return;

        await Conversation.findByIdAndUpdate(conversationId, {
          [`unreadCount.${userId}`]: 0
        });
      } catch (err) {
        console.error("markSeen error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};
