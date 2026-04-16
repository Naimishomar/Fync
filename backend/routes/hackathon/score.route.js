import express from "express";
const router = express.Router();
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  submitScore,
  getScores,
  getPendingForJudge,
} from "../../controllers/hackathon/score.controller.js";

// PUT pending BEFORE /:submissionId so the route isn't swallowed
router.get("/judge/pending/:hackathonId", authMiddleware, getPendingForJudge);
router.get("/:submissionId", authMiddleware, getScores);
router.post("/", authMiddleware, submitScore);

export default router;