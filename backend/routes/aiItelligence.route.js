import { AiIntelligence, uploadPDF } from "../controllers/newFeatures/aiIntelligence.controller.js";
import express from "express";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.post("/study/analyze", AiIntelligence);
router.post("/study/upload-pdf", upload.single('pdf'), uploadPDF);

export default router;