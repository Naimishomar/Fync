import express from 'express';
import multer from 'multer';
import { createOrder, verifyOrder, scanQRImage, listOrdersForAdmin, paymentStatsForAdmin } from '../controllers/payment.controller.js';
import { authMiddleware, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/order', authMiddleware, createOrder);
router.post("/verify", authMiddleware, verifyOrder);
router.post("/scan-qr", authMiddleware, upload.single('qrImage'), scanQRImage);

// Admin ledger — every order, whatever its outcome, for answering "I paid and
// nothing happened".
router.get('/admin/orders', authMiddleware, isAdmin, listOrdersForAdmin);
router.get('/admin/stats', authMiddleware, isAdmin, paymentStatsForAdmin);

export default router;