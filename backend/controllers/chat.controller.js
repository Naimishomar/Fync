import Message from "../models/chat.model.js";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";

export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1 } = req.query;
  const limit = 20;

  const messages = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("sender", "name avatar username");

  res.json({ success: true, messages: messages.reverse() });
};


export const getConversations = async (req, res) => {
  const userId = req.user.id;

  const conversations = await Conversation.find({
    participants: userId
  })
    .populate("participants", "name username avatar")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  res.json({ success: true, conversations });
};

export const searchUsers = async (req, res) => {
  const { q } = req.query;

  const users = await User.find({
    $or: [
      { username: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } }
    ]
  }).select("username name avatar");

  res.json({ success: true, users });
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