import express from 'express';
import { getUpcomingContests, getContestDetails, createContest, registerForContest, enterContest } from '../controllers/coding/contest.controller.js';
import { authMiddleware, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/contests', authMiddleware, getUpcomingContests);
router.get('/contests/:id', authMiddleware, getContestDetails);
router.post('/contests', authMiddleware, isAdmin, createContest);
router.post('/contests/:id/register', authMiddleware, registerForContest);
router.post('/contests/:id/enter', authMiddleware, enterContest);

export default router;
