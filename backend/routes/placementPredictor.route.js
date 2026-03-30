import express from "express";
import { predictPlacement, getPredictionHistory } from "../controllers/placementPredictor.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { resumeUpload } from '../utils/r2.js';

const router = express.Router();

const safeResumeUpload = (req, res, next) => {
    resumeUpload.single('resume')(req, res, (err) => {
        if (err) {
            console.error("❌ RESUME UPLOAD ERROR:", JSON.stringify(err, null, 2));
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: "PDF size should not be greater than 5MB" });
            }
            return res.status(400).json({ message: "Resume upload failed", error: err.message });
        }
        next();
    });
};

router.post("/predict", authMiddleware, safeResumeUpload, predictPlacement);
router.get("/history", authMiddleware, getPredictionHistory);

export default router;
