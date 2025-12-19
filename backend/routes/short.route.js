import express from 'express';
import { createShorts, fetchShorts, getYourShorts } from '../controllers/shorts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { videoUpload } from '../utils/cloudinary.js';
const router = express.Router();

router.post('/create', authMiddleware, videoUpload.single('video'), createShorts);
router.get("/get/shorts", authMiddleware, fetchShorts);
router.get("/get/yours", authMiddleware, getYourShorts);

export default router;