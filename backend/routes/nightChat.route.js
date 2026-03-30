import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { mentorshipUpload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';
import { uploadNightImage } from "../controllers/nightChat.controller.js";

const router = express.Router();

router.post("/upload", authMiddleware, mentorshipUpload.single("file"), r2UploadMiddleware({ __single__: 'night_chat' }), uploadNightImage);

export default router;
