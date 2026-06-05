import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getConversations, getMessages, searchUsers, startChat, deleteMessage, getUnreadCount, sendMedia, notifyUser } from "../controllers/chat.controller.js";
import { collegeChatUpload } from "../utils/r2.js";
const router = express.Router();

router.get("/:conversationId/messages", authMiddleware, getMessages);
router.get("/search", authMiddleware, searchUsers);
router.get("/conversations", authMiddleware, getConversations);
router.post("/start", authMiddleware, startChat);
router.delete("/message/:messageId", authMiddleware, deleteMessage);
router.get("/unread-count", authMiddleware, getUnreadCount);
router.post("/send", authMiddleware, collegeChatUpload.single("media"), sendMedia);
router.post("/notify", authMiddleware, notifyUser);


export default router;
