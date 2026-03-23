import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { mentorshipUpload } from "../utils/cloudinary.js";
import { uploadNightImage } from "../controllers/nightChat.controller.js";

const router = express.Router();

router.post("/upload", authMiddleware, mentorshipUpload.single("file"), uploadNightImage);

export default router;
