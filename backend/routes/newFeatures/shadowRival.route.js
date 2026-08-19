import express from 'express';
import { getMyRival, setOptOut, requestRematch } from '../../controllers/newFeatures/shadowRival.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', authMiddleware, getMyRival);
router.post('/opt-out', authMiddleware, setOptOut);
router.post('/rematch', authMiddleware, requestRematch);

export default router;
