import Message from "../models/chat.model.js";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import { uploadToR2 } from "../utils/r2.js";
import { mintSupabaseToken, isSupabaseAuthConfigured, supabaseTokenTtlSeconds } from "../utils/supabaseToken.js";

/**
 * Hands the client a Supabase-signed JWT carrying its Fync user id, so
 * row-level-security policies can identify the caller. See
 * utils/supabaseToken.js and docs/supabase-rls.sql.
 */
export const getRealtimeToken = async (req, res) => {
    if (!isSupabaseAuthConfigured()) {
        // Not configured yet: say so plainly rather than 500ing. The client
        // falls back to the anon key, which is exactly today's behaviour.
        return res.status(200).json({ success: false, configured: false, token: null });
    }
    const token = mintSupabaseToken(req.user.id);
    return res.status(200).json({
        success: true,
        configured: true,
        token,
        expiresIn: supabaseTokenTtlSeconds,
    });
};

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

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    // Only participants may send media to a conversation
    if (!(conversation.participants || []).some(p => String(p) === String(senderId))) {
      return res.status(403).json({ success: false, message: "Not a participant" });
    }

    // Upload to R2 and hand the URL back. Since the chat moved to Supabase the
    // client writes the message row itself, so the Mongo Message/Conversation
    // writes that used to happen here were never read by anything — they only
    // added two round trips to every media send. The socket "newMessage" emit
    // went the same way: the client listens to Supabase realtime now.
    const folder = `chats/${conversationId}`;
    const mediaUrl = await uploadToR2(req.file.buffer, folder, req.file.originalname, req.file.mimetype);

    res.json({
      success: true,
      message: {
        conversationId,
        sender: senderId,
        message: message || "",
        messageType: type || "image",
        mediaUrl
      }
    });
  } catch (error) {
    console.error("sendMedia error:", error);
    res.status(500).json({ success: false, message: "Failed to send media" });
  }
};

export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1 } = req.query;
  const limit = 20;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

  const userId = String(req.user?.id || req.user?._id);
  if (!(conversation.participants || []).some(p => String(p) === userId)) {
    return res.status(403).json({ success: false, message: "Not a participant" });
  }

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
    if (!q) return res.json({ success: true, users: [] });

    const safeQ = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      $or: [
        { username: { $regex: safeQ, $options: "i" } },
        { name: { $regex: safeQ, $options: "i" } }
      ]
    }).select("username name avatar").limit(20).lean();

    res.json({ success: true, users });
  } catch (error) {
    console.error("searchUsers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

import { sendPushNotification } from "../services/push.service.js";

export const notifyUser = async (req, res) => {
  try {
    const { receiverId, title, body, data } = req.body;
    if (!receiverId) return res.status(400).json({ success: false, message: "receiverId is required" });

    const receiver = await User.findById(receiverId).select('fcmTokens');
    if (!receiver || !receiver.fcmTokens || receiver.fcmTokens.length === 0) {
      return res.status(200).json({ success: true, message: "User has no active devices for push" });
    }

    // Fire and forget (Zero backend load)
    sendPushNotification(receiver.fcmTokens, {
      title: title || "New Message",
      body: body || "You have received a new message.",
      data: data || {}
    });

    return res.status(200).json({ success: true, message: "Notification dispatched" });
  } catch (error) {
    console.error("notifyUser error:", error);
    return res.status(500).json({ success: false, message: "Failed to dispatch notification" });
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
