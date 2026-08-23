import express from 'express';
import { 
  getProblems, 
  getProblemById, 
  submitSolution, 
  getBugProblems,
  getBugDomains
} from '../../controllers/coding/coding.controller.js';
import { 
  getUpcomingContests, 
  getContestDetails, 
  registerForContest,
  enterContest,
  getArchivedContests,
  getContestLeaderboard
} from '../../controllers/coding/contest.controller.js';
import { createTeam, joinTeam, getMyTeam, leaveTeam } from '../../controllers/coding/team.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { getArenaProgress, getArenaLeaderboard } from '../../controllers/coding/progress.controller.js';

const router = express.Router();

// Read-only summary for the app. Solving lives on the web.
router.get('/progress', authMiddleware, getArenaProgress);
router.get('/leaderboard', authMiddleware, getArenaLeaderboard);
router.get('/problems', authMiddleware, getProblems);
router.get('/problems/:id', authMiddleware, getProblemById);
router.post('/problems/submit', authMiddleware, submitSolution);
router.get('/bug-domains', authMiddleware, getBugDomains);
router.get('/bug-problems', authMiddleware, getBugProblems);
router.get('/bug-problems/:id', authMiddleware, getProblemById); // Using general or specific depending on implementation, but getProblemById now handles both

// Contest Routes
router.get('/contests', authMiddleware, getUpcomingContests);
router.get('/contests/archive', authMiddleware, getArchivedContests);
router.get('/contests/:id', authMiddleware, getContestDetails);
router.post('/contests/:id/register', authMiddleware, registerForContest);
router.post('/contests/:id/enter', authMiddleware, enterContest);
router.get('/contests/:id/leaderboard', authMiddleware, getContestLeaderboard);

// Group challenge: teams of 2 queue against each other.
router.get('/teams/mine', authMiddleware, getMyTeam);
router.post('/teams', authMiddleware, createTeam);
router.post('/teams/join', authMiddleware, joinTeam);
router.post('/teams/leave', authMiddleware, leaveTeam);

export default router;
