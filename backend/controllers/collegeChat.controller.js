import CollegeChat from '../models/collegeChat.model.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';

let ioInstance = null;

export const setCollegeChatIo = (io) => {
    ioInstance = io;
};

export const sendMessage = async (req, res) => {
    try {
        const { messageType, content } = req.body;
        const collegeName = req.user.college;

        if (!collegeName) {
            return res.status(403).json({ success: false, message: "User does not belong to any college" });
        }

        let mediaUrl = "";
        let type = messageType || "text";

        if (req.files && Object.keys(req.files).length > 0) {
            if (req.files.media && req.files.media.length > 0) {
                mediaUrl = req.files.media[0].path;
            }
        } else if (req.file) {
            mediaUrl = req.file.path;
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const newMessage = await CollegeChat.create({
            senderId: req.user.id,
            collegeName,
            messageType: type,
            content: content || "",
            mediaUrl,
            expiresAt
        });

        const populatedMessage = await CollegeChat.findById(newMessage._id).populate('senderId', 'name username avatar');

        if (ioInstance) {
            ioInstance.to(`college_${collegeName}`).emit("new_college_message", populatedMessage);
        }

        return res.status(201).json({
            success: true,
            message: "Message sent",
            chat: populatedMessage
        });
    } catch (error) {
        console.error("Send message error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const collegeName = req.user.college;

        if (!collegeName) {
            return res.status(403).json({ success: false, message: "User does not belong to any college" });
        }

        const now = new Date();
        const messages = await CollegeChat.find({
            collegeName,
            expiresAt: { $gt: now }
        })
            .populate('senderId', 'name username avatar')
            .sort({ createdAt: 1 });

        return res.status(200).json({ success: true, messages });
    } catch (error) {
        console.error("Get messages error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await CollegeChat.findById(id);

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (message.senderId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized to delete this message" });
        }

        if (message.mediaUrl && message.messageType !== 'text') {
            let resourceType = 'image';
            if (message.messageType === 'video' || message.messageType === 'voice') resourceType = 'video';
            if (message.messageType === 'file') resourceType = 'raw';
            await deleteFromCloudinary(message.mediaUrl, resourceType);
        }

        await CollegeChat.findByIdAndDelete(id);

        if (ioInstance) {
            ioInstance.to(`college_${message.collegeName}`).emit("delete_college_message", id);
        }

        return res.status(200).json({ success: true, message: "Message deleted" });
    } catch (error) {
        console.error("Delete message error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
