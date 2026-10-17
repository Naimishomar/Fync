import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createOrder, verifyOrder, scanQRImage, listOrdersForAdmin, paymentStatsForAdmin } from '../controllers/payment.controller.js';
import { authMiddleware, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Held in memory and decoded by Jimp, so both the bytes and the pixel count
// are bounded: a small PNG can still declare a 50k x 50k canvas.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|bmp|gif)$/.test(file.mimetype)),
});
const MAX_QR_PIXELS = 16_000_000; // ~4000 x 4000

/** Read only the header; refuse anything Jimp would choke on before it decodes. */
const checkQrImage = async (req, res, next) => {
    if (!req.file?.buffer) return next();
    try {
        const { width, height } = await sharp(req.file.buffer, { limitInputPixels: MAX_QR_PIXELS }).metadata();
        if (!width || !height || width * height > MAX_QR_PIXELS) throw new Error('too large');
    } catch {
        return res.status(400).json({ success: false, message: "Please upload a smaller photo of the QR code." });
    }
    next();
};

/** multer's size/count errors as a 400 instead of a 500. */
const singleQr = (req, res, next) =>
    upload.single('qrImage')(req, res, (err) =>
        err ? res.status(400).json({ success: false, message: "Image must be a photo under 5 MB." }) : next());

router.post('/order', authMiddleware, createOrder);
router.post("/verify", authMiddleware, verifyOrder);
router.post("/scan-qr", authMiddleware, singleQr, checkQrImage, scanQRImage);

// Admin ledger — every order, whatever its outcome, for answering "I paid and
// nothing happened".
router.get('/admin/orders', authMiddleware, isAdmin, listOrdersForAdmin);
router.get('/admin/stats', authMiddleware, isAdmin, paymentStatsForAdmin);

export default router;