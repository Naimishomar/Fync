import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getChatMessages } from "../controllers/chat.controller.js";
const router = express.Router();

router.get("/:roomId", authMiddleware, getChatMessages);

export default router;
