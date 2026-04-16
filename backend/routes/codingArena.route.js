import express from 'express';
import { getUpcomingContests, getContestDetails, createContest, registerForContest } from '../controllers/coding/contest.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/contests', authMiddleware, getUpcomingContests);
router.get('/contests/:id', authMiddleware, getContestDetails);
router.post('/contests', authMiddleware, createContest); // In real app, restrict to Admin
router.post('/contests/:id/register', authMiddleware, registerForContest);

export default router;
