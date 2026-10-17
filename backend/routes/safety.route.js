import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { report, blockUser, unblockUser, getBlocked } from "../controllers/safety.controller.js";

const router = express.Router();

router.post("/report", authMiddleware, report);
router.post("/block", authMiddleware, blockUser);
router.delete("/block/:userId", authMiddleware, unblockUser);
router.get("/blocked", authMiddleware, getBlocked);

export default router;
