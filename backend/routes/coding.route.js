import express from "express";
import { 
    getLeaderboard, 
    updateCodingProfiles, 
    getCoderProfile, 
    forceRefreshStats
} from "../controllers/newFeatures/codingLeaderboard.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getLeaderboard); // List
router.get("/user/:userId", authMiddleware, getCoderProfile); // Details
router.put("/update-profiles", authMiddleware, updateCodingProfiles); // Update Me
router.post("/refresh", authMiddleware, forceRefreshStats);

export default router;