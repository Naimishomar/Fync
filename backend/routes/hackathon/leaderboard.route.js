import express from "express";
const router  = express.Router();
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  getLeaderboard,
  getTopN,
  getSubmissionRank,
  rebuildLeaderboard,
} from "../controllers/leaderboard.controller";
router.get("/:hackathonId",                          authMiddleware, getLeaderboard);
router.get("/:hackathonId/top/:n",                   authMiddleware, getTopN);
router.get("/:hackathonId/rank/:submissionId",        authMiddleware, getSubmissionRank);
router.post("/:hackathonId/rebuild",                  authMiddleware, authorize("organizer"), rebuildLeaderboard);
export default router;