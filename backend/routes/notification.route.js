import express from 'express';
import { getNotifications, getUnreadCount, markNotificationsRead, broadcastNotification } from '../controllers/notification.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.get("/count", authMiddleware, getUnreadCount);
router.put("/read", authMiddleware, markNotificationsRead);
router.post("/broadcast", authMiddleware, broadcastNotification);

export default router;