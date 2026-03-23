import express from "express";
import { getMessages, sendMessage, deleteMessage } from "../controllers/mentorshipChat.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { mentorshipUpload } from "../utils/cloudinary.js";

const router = express.Router(); 

router.get("/messages", authMiddleware, getMessages); 
router.post("/send", authMiddleware, mentorshipUpload.single("file"), sendMessage);
router.delete("/delete/:id", authMiddleware, deleteMessage);

export default router;
