import Message from "../models/chat.model.js";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import { uploadToR2 } from "../utils/r2.js";

let io; // To be set from index.js
export const setChatIo = (socketIo) => {
  io = socketIo;
};

export const sendMedia = async (req, res) => {
  try {
    const { conversationId, type, message } = req.body;
    const senderId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // 1. Upload to R2
    const folder = `chats/${conversationId}`;
    const mediaUrl = await uploadToR2(req.file.buffer, folder, req.file.originalname, req.file.mimetype);

    // 2. Save Message
    let newMessage = await Message.create({
      conversationId,
      sender: senderId,
      message: message || "", // Optional text with media
      messageType: type || "image",
      mediaUrl
    });

    // 3. Update Conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: newMessage._id,
      $inc: { [`unreadCount.${req.body.receiverId}`]: 1 } // Note: frontend should pass receiverId
    });

    newMessage = await Message.findById(newMessage._id)
      .populate("sender", "name username avatar")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name username" }
      });

    // 4. Emit via Socket
    if (io) {
      io.to(conversationId).emit("newMessage", newMessage);
    }

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error("sendMedia error:", error);
    res.status(500).json({ success: false, message: "Failed to send media" });
  }
};

export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1 } = req.query;
  const limit = 20;

  const messages = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("sender", "name avatar username")
    .populate({
      path: "replyTo",
      populate: { path: "sender", select: "name username" }
    })
    .lean();

  res.json({ success: true, messages: messages.reverse() });
};


export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      participants: userId,
      lastMessage: { $exists: true, $ne: null }
    })
      .populate("participants", "name username avatar")
      .populate("lastMessage")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ success: true, conversations });
  } catch (error) {
    console.error("getConversations error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } }
      ]
    }).select("username name avatar");

    res.json({ success: true, users });
  } catch (error) {
    console.error("searchUsers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const startChat = async (req, res) => {
  try {
    const myId = req.user.id;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    if (myId === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot chat with yourself"
      });
    }
    let conversation = await Conversation.findOne({
      participants: { $all: [myId, userId] }
    })
      .populate("participants", "name username avatar")
      .populate("lastMessage");

    if (conversation) {
      return res.status(200).json({
        success: true,
        conversation
      });
    }
    conversation = await Conversation.create({
      participants: [myId, userId],
      unreadCount: {
        [myId]: 0,
        [userId]: 0
      }
    });

    conversation = await Conversation.findById(conversation._id)
      .populate("participants", "name username avatar");

    return res.status(201).json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error("Start chat error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ success: false, message: "Message not found" });

        if (message.sender.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        await Message.findByIdAndDelete(messageId);
        res.json({ success: true, message: "Message deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};
export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversations = await Conversation.find({ participants: userId });
        let total = 0;
        conversations.forEach(c => {
            if (c.unreadCount) {
                const count = (typeof c.unreadCount.get === 'function') ? c.unreadCount.get(userId) : c.unreadCount[userId];
                total += (count || 0);
 }
 });
 res.json({ success: true, count: total });
 } catch (error) {
 res.status(500).json({ success: false });
 }
};
