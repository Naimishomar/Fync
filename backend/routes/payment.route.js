import express from 'express';
import multer from 'multer';
import { createOrder, verifyOrder, scanQRImage } from '../controllers/payment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/order', authMiddleware, createOrder);
router.post("/verify", authMiddleware, verifyOrder);
router.post("/scan-qr", authMiddleware, upload.single('qrImage'), scanQRImage);

export default router;