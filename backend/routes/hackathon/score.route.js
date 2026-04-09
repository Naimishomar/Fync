import express from "express";
const router  = express.Router();
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  submitScore,
  getScores,
  getPendingForJudge,
} from "../../controllers/hackathon/score.controller";
router.post("/", authMiddleware , authorize("judge"), submitScore);
router.get("/:submissionId", authMiddleware , getScores);
router.get("/judge/pending/:hackathonId", authMiddleware , authorize("judge"), getPendingForJudge);
module.exports = router;