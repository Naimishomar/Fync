import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getConversations, getMessages, searchUsers, startChat, deleteMessage, getUnreadCount } from "../controllers/chat.controller.js";
const router = express.Router();

router.get("/:conversationId/messages", authMiddleware, getMessages);
router.get("/search", authMiddleware, searchUsers);
router.get("/conversations", authMiddleware, getConversations);
router.post("/start", authMiddleware, startChat);
router.delete("/message/:messageId", authMiddleware, deleteMessage);
router.get("/unread-count", authMiddleware, getUnreadCount);


export default router;
