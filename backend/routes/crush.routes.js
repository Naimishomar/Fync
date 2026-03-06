import express from 'express';
import { addCrush, getMyCrushes, removeCrush, updateLocation, checkNearby } from '../controllers/crush.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/add', authMiddleware, addCrush);
router.get('/my-crushes', authMiddleware, getMyCrushes);
router.delete('/remove/:crushId', authMiddleware, removeCrush);
router.post('/update-location', authMiddleware, updateLocation);
router.get('/check-nearby', authMiddleware, checkNearby);

export default router;
