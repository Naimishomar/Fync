import express from "express";
import { 
    getLeaderboard, 
    updateCodingProfiles, 
    getCoderProfile, 
    forceRefreshStats,
    refreshAllStats
} from "../controllers/newFeatures/codingLeaderboard.controller.js";
import { authMiddleware, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getLeaderboard); // List
router.get("/user/:userId", authMiddleware, getCoderProfile); // Details
router.put("/update-profiles", authMiddleware, updateCodingProfiles); // Update Me
router.post("/refresh", authMiddleware, forceRefreshStats);
router.post("/refresh-all", authMiddleware, isAdmin, refreshAllStats);

export default router;