import express from 'express';
import { getNotifications, getUnreadCount, markNotificationsRead, broadcastNotification, getBroadcastReach } from '../controllers/notification.controller.js';
import { authMiddleware, isAdmin } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.get("/count", authMiddleware, getUnreadCount);
router.put("/read", authMiddleware, markNotificationsRead);
router.post("/broadcast", authMiddleware, isAdmin, broadcastNotification);
router.get("/broadcast/reach", authMiddleware, isAdmin, getBroadcastReach);

export default router;