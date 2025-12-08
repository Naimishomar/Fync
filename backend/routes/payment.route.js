import express from 'express';
import { createOrder, verifyOrder } from '../controllers/payment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.post('/api/order', createOrder);
router.post("/api/verify", verifyOrder);

export default router;