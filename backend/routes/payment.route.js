import express from 'express';
import { createOrder, verifyOrder } from '../controllers/payment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.post('/api/payment/order', createOrder);
router.post("/api/payment/verify", verifyOrder);

export default router;