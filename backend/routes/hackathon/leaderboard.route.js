import express from "express";
const router = express.Router();
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getLeaderboard,
  getTopN,
  getSubmissionRank,
  rebuildLeaderboard,
} from "../../controllers/hackathon/leaderboard.controller.js";

router.get("/:hackathonId",                       authMiddleware, getLeaderboard);
router.get("/:hackathonId/top/:n",                authMiddleware, getTopN);
router.get("/:hackathonId/rank/:submissionId",    authMiddleware, getSubmissionRank);
router.post("/:hackathonId/rebuild",              authMiddleware, rebuildLeaderboard);

export default router;