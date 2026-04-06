import express from 'express';
import { upload } from '../utils/r2.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { getAds, getAllAds, createAd, updateAd, deleteAd } from '../controllers/ad.controller.js';

const router = express.Router();

router.get('/', authMiddleware, getAds);
router.get('/all', authMiddleware, getAllAds);
router.post('/', authMiddleware, upload.single('image'), createAd);
router.patch('/:id', authMiddleware, upload.single('image'), updateAd);
router.delete('/:id', authMiddleware, deleteAd);

export default router;
