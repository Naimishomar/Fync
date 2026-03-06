import express from "express";
import {
    createSubscriptionOrder,
    verifySubscriptionPayment,
    getSubscriptionStatus
} from "../controllers/subscription.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create-order", authMiddleware, createSubscriptionOrder);
router.post("/verify-payment", authMiddleware, verifySubscriptionPayment);
router.get("/status", authMiddleware, getSubscriptionStatus);

export default router;
