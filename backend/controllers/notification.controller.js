import Notification from "../models/notification.model.js";

export const getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .populate("sender", "username avatar")
            .populate("post", "image")
            .populate("shorts", "video")
            .skip(skip)
            .limit(Number(limit));

        const total = await Notification.countDocuments({ recipient: req.user.id });

        return res.status(200).json({
            success: true,
            notifications,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
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

import User from "../models/user.model.js";
import { sendPushNotification } from "../services/push.service.js";

export const broadcastNotification = async (req, res) => {
    try {
        const { title, body } = req.body;
        
        if (!title || !body) {
            return res.status(400).json({ success: false, message: "Title and body are required." });
        }
        
        // Find all users with registered FCM tokens
        const usersWithTokens = await User.find({ fcmTokens: { $exists: true, $not: { $size: 0 } } }).select("fcmTokens");
        
        let allTokens = [];
        usersWithTokens.forEach(user => {
            allTokens = allTokens.concat(user.fcmTokens);
        });

        // Unique tokens only
        allTokens = [...new Set(allTokens)];

        if (allTokens.length === 0) {
            return res.status(400).json({ success: false, message: "No users have push notifications enabled." });
        }

        // Send in batches of 500 (FCM limit for multicast)
        const batchSize = 500;
        let successCount = 0;
        for (let i = 0; i < allTokens.length; i += batchSize) {
            const batch = allTokens.slice(i, i + batchSize);
            await sendPushNotification(batch, { title, body });
            successCount += batch.length;
        }

        return res.status(200).json({ success: true, message: `Broadcast successfully sent to ${successCount} devices.` });
    } catch (error) {
        console.error("Broadcast Notification Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};