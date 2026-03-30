import express from "express";
import { getMessages, getMembers, searchAlumni, sendMessage, deleteMessage } from "../controllers/alumniChat.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { collegeChatUpload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';

const router = express.Router(); 

router.get("/messages", authMiddleware, getMessages); 
router.get("/members", authMiddleware, getMembers); 
router.get("/search", authMiddleware, searchAlumni);
router.post("/send", authMiddleware, collegeChatUpload.single("file"), r2UploadMiddleware({ __single__: 'college_chats' }), sendMessage);
router.delete("/delete/:id", authMiddleware, deleteMessage);

export default router;
