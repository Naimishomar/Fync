import express from 'express';
import multer from 'multer';
import { createOrder, verifyOrder, scanQRImage } from '../controllers/payment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/api/order', createOrder);
router.post("/api/verify", verifyOrder);
router.post("/api/scan-qr", authMiddleware, upload.single('qrImage'), scanQRImage);

export default router;