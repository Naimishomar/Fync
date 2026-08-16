import { AiIntelligence, uploadPDF } from "../controllers/newFeatures/aiIntelligence.controller.js"; 
import express from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 10, files: 1 } });

const router = express.Router();

router.post("/study/analyze", authMiddleware, AiIntelligence);
router.post("/study/upload-pdf", authMiddleware, upload.single('pdf'), uploadPDF);

export default router;