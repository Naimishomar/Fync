import express from "express";
import { getMessages, sendMessage, deleteMessage } from "../controllers/mentorshipChat.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { mentorshipUpload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';

const router = express.Router(); 

router.get("/messages", authMiddleware, getMessages); 
router.post("/send", authMiddleware, mentorshipUpload.single("file"), r2UploadMiddleware({ __single__: 'mentorship_chats' }), sendMessage);
router.delete("/delete/:id", authMiddleware, deleteMessage);

export default router;
