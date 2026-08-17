import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
    createPaidGigs,
    getYourPostedGigs,
    getPaidGigs,
    updatePaidGigs,
    changeGigStatus,
    deleteGigs,
} from "../controllers/paidGigs.controller.js";
import { cacheMiddleware } from "../middlewares/cache.middleware.js";
const router = express.Router();

router.post("/create", authMiddleware, createPaidGigs);
router.get("/your", authMiddleware, getYourPostedGigs); // ⚠️ MUST be before /:id to avoid shadowing
router.get("/", authMiddleware, cacheMiddleware(300, { shared: true, tags: ['gigs'] }), getPaidGigs);
router.post("/:id/update", authMiddleware, updatePaidGigs);
router.post("/:id/status", authMiddleware, changeGigStatus);
router.delete("/:id", authMiddleware, deleteGigs);

export default router;