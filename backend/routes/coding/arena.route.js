import express from 'express';
import { 
  getProblems, 
  getProblemById, 
  submitSolution, 
  getBugProblems 
} from '../../controllers/coding/coding.controller.js';
import { 
  getUpcomingContests, 
  getContestDetails, 
  registerForContest,
  enterContest,
  getArchivedContests
} from '../../controllers/coding/contest.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/problems', authMiddleware, getProblems);
router.get('/problems/:id', authMiddleware, getProblemById);
router.post('/problems/submit', authMiddleware, submitSolution);
router.get('/bug-problems', authMiddleware, getBugProblems);
router.get('/bug-problems/:id', authMiddleware, getProblemById); // Using general or specific depending on implementation, but getProblemById now handles both

// Contest Routes
router.get('/contests', authMiddleware, getUpcomingContests);
router.get('/contests/archive', authMiddleware, getArchivedContests);
router.get('/contests/:id', authMiddleware, getContestDetails);
router.post('/contests/:id/register', authMiddleware, registerForContest);
router.post('/contests/:id/enter', authMiddleware, enterContest);

export default router;
