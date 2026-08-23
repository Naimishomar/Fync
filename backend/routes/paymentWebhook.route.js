import express from 'express';
import { razorpayWebhook } from '../controllers/paymentWebhook.controller.js';

const router = express.Router();

// Razorpay posts here. Authentication is the signature over the raw body —
// there is no logged-in user on this request.
router.post('/', razorpayWebhook);

export default router;
