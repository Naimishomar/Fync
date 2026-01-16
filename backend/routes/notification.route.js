import express from 'express';
import { getNotifications, getUnreadCount, markNotificationsRead } from '../controllers/notification.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.get("/count", authMiddleware, getUnreadCount);
router.put("/read", authMiddleware, markNotificationsRead);

export default router;