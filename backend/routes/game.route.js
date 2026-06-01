import express from "express";
import { submitScore, getLeaderboard, getUserHighestScore } from "../controllers/game.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/score", authMiddleware, submitScore);
router.get("/leaderboard/:gameName", authMiddleware, getLeaderboard);
router.get("/score/:gameName", authMiddleware, getUserHighestScore);

export default router;
