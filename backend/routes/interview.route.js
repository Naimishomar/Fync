import express from 'express';
import { startInterview, processAnswer, endInterview } from '../controllers/interview.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { audioUpload, upload } from '../utils/cloudinary.js';

const router = express.Router();

// --- 1. SAFE RESUME UPLOAD (For Start) ---
const safeResumeUpload = (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
        if (err) {
            console.error("❌ RESUME UPLOAD ERROR:", JSON.stringify(err, null, 2));
            return res.status(400).json({ message: "Resume upload failed", error: err.message });
        }
        next();
    });
};

// --- 2. SAFE AUDIO UPLOAD (For Answer) ---
const safeAudioUpload = (req, res, next) => {
    // This wrapper catches the crash inside Multer
    audioUpload.single('audio')(req, res, (err) => {
        if (err) {
            // This will reveal why [object Object] was happening
            console.error("❌ AUDIO UPLOAD CRASH:", JSON.stringify(err, null, 2));
            
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ message: "Field name mismatch. Frontend must send 'audio'" });
            }
            return res.status(400).json({ message: "Audio upload failed", error: err.message });
        }

        // If upload worked but file is missing
        if (!req.file) {
            console.error("❌ NO FILE RECEIVED. Check Frontend FormData.");
            return res.status(400).json({ message: "No audio file found in request" });
        }

        console.log("✅ AUDIO UPLOADED SUCCESSFULLY:", req.file.path);
        next();
    });
};

// --- ROUTES ---

router.post('/start', authMiddleware, safeResumeUpload, startInterview);

// Use the new safe wrapper here
router.post('/answer', authMiddleware, safeAudioUpload, processAnswer);

router.post('/end', authMiddleware, endInterview);

export default router;