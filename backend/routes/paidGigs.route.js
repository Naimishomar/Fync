import express from "express";
import { createPaidGigs, getPaidGigs, updatePaidGigs, changeGigStatus, deleteGigs, getYourPostedGigs } from "../controllers/paidGigs.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", authMiddleware, createPaidGigs);
router.get("/your", authMiddleware, getYourPostedGigs); // ⚠️ MUST be before /:id to avoid shadowing
router.get("/", authMiddleware, getPaidGigs);
router.post("/:id/update", authMiddleware, updatePaidGigs);
router.post("/:id/status", authMiddleware, changeGigStatus);
router.delete("/:id", authMiddleware, deleteGigs);

export default router;