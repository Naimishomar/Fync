import express from 'express';
const router = express.Router();
import { addCafe } from '../controllers/cafe.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/cloudinary.js';

router.post('/add/cafe', authMiddleware, upload.single('cafe_image'), addCafe);

export default router;