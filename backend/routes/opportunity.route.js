import express from "express";
import { createOpportunity, getOpportunities, deleteOpportunity } from "../controllers/opportunity.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", authMiddleware, createOpportunity);
router.get("/list", authMiddleware, getOpportunities);
router.delete("/delete/:id", authMiddleware, deleteOpportunity);

export default router;
