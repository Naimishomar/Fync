import MentorshipMessage from "../models/mentorshipMessage.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { deleteFromR2 } from "../utils/r2.js";

let ioInstance = null;

export const setMentorshipIo = (io) => {
    ioInstance = io;
};

export const sendMessage = async (req, res) => {
    try {
        const { message, messageType, fileName, replyTo } = req.body;
        const { college } = req.user;

        if (!college) {
            return res.status(403).json({ success: false, message: "User college not found" });
        }

        let fileUrl = "";
        if (req.file) {
            // Extra safety check in case multer limit is bypassed or misconfigured
            if (req.file.size > 5 * 1024 * 1024) {
                return res.status(400).json({ success: false, message: "File size exceeds 5MB limit" });
            }
            fileUrl = req.file.path;
        }

        // Handle Mentions and Tag Notifications
        const mentions = [];
        const mentionMatches = message ? message.match(/@(\w+)/g) : [];
        
        if (mentionMatches) {
            const uniqueUsernames = [...new Set(mentionMatches.map(m => m.substring(1)))];
            for (const username of uniqueUsernames) {
                const mentionedUser = await User.findOne({ username });
                if (mentionedUser && mentionedUser._id.toString() !== req.user.id.toString()) {
                    mentions.push(mentionedUser._id);
                    
                    // Create Notification
                    const notif = await Notification.create({
                        recipient: mentionedUser._id,
                        sender: req.user.id,
                        type: 'tag',
                        commentText: `mentioned you in ${college} Professional Hub: "${message.substring(0, 30)}..."`
                    });

                    // Emit to specific user if online
                    if (ioInstance) {
                        ioInstance.emit(`notification_${mentionedUser._id}`, {
                            success: true,
                            notification: notif
                        });
                    }
                }
            }
        }

        const newMessage = await MentorshipMessage.create({
            college,
            sender: req.user.id,
            message: message || "",
            messageType: messageType || "text",
            fileUrl,
            fileName: fileName || "",
            mentions,
            replyTo: replyTo || null
        });

        const populatedMessage = await MentorshipMessage.findById(newMessage._id)
            .populate("sender", "name username avatar company role user_access")
            .populate({
                path: "replyTo",
                populate: { path: "sender", select: "name username" }
            });

        if (ioInstance) {
            const roomName = `mentorship_${college.replace(/\s+/g, '_')}`;
            ioInstance.to(roomName).emit("new_mentorship_message", populatedMessage);
        }

        return res.status(201).json({ success: true, message: populatedMessage });
    } catch (error) {
        console.error("Mentorship sendMessage error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { college } = req.user;
        const { page = 1 } = req.query;
        const limit = 50;

        if (!college) {
            return res.status(403).json({ success: false, message: "User college not found" });
        }

        const messages = await MentorshipMessage.find({ college })
            .populate("sender", "name username avatar company role user_access")
            .populate({
                path: "mentions",
                select: "name username"
            })
            .populate({
                path: "replyTo",
                populate: { path: "sender", select: "name username" }
            })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return res.status(200).json({ success: true, messages });
    } catch (error) {
        console.log("Error fetching mentorship messages", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await MentorshipMessage.findById(id);

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (message.sender.toString() !== req.user.id.toString() && req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        if (message.fileUrl && message.messageType !== 'text') {
            let resourceType = 'image';
            if (message.messageType === 'file') resourceType = 'raw';
            await deleteFromR2(message.fileUrl);
        }

        await MentorshipMessage.findByIdAndDelete(id);

        if (ioInstance) {
            const roomName = `mentorship_${message.college.replace(/\s+/g, '_')}`;
            ioInstance.to(roomName).emit("delete_mentorship_message", id);
        }

        return res.status(200).json({ success: true, message: "Message deleted" });
    } catch (error) {
        console.error("Mentorship deleteMessage error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
