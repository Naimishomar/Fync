import express from "express";
import {
    createSubscriptionOrder,
    verifySubscriptionPayment,
    getSubscriptionStatus,
    getSubscriptionConfig,
    updateSubscriptionConfig
} from "../controllers/subscription.controller.js";
import { authMiddleware, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create-order", authMiddleware, createSubscriptionOrder);
router.post("/verify-payment", authMiddleware, verifySubscriptionPayment);
router.get("/status", authMiddleware, getSubscriptionStatus);

// Dynamic config routes
router.get("/config", authMiddleware, getSubscriptionConfig);
router.put("/admin/config", authMiddleware, isAdmin, updateSubscriptionConfig);

export default router;
