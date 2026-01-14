import Notification from "../models/notification.model.js";

export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .populate("sender", "username avatar")
            .populate("post", "image")
            .populate("shorts", "video")
            .limit(30);
        return res.status(200).json({ success: true, notifications });
    } catch (error) {
        console.error("Get Notifications Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ 
            recipient: req.user.id, 
            isRead: false 
        });
        return res.status(200).json({ success: true, count });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const markNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        return res.status(200).json({ success: true, message: "Marked as read" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};