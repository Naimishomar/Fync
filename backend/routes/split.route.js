import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import {
    recordPaymentTransaction,
    createSplit,
    getPendingSplits,
    markSplitPaid,
    createGroup,
    getGroups,
    getMonthlyStats,
    getCreatedSplits,
    remindSplitMember
} from '../controllers/split.controller.js';

const router = express.Router();

router.post('/pay', authMiddleware, recordPaymentTransaction);
router.post('/create', authMiddleware, createSplit);
router.get('/pending', authMiddleware, cacheMiddleware(60), getPendingSplits);
router.post('/mark-paid/:id', authMiddleware, markSplitPaid);
router.post('/groups', authMiddleware, createGroup);
router.get('/groups', authMiddleware, cacheMiddleware(300), getGroups);
router.get('/stats', authMiddleware, cacheMiddleware(600), getMonthlyStats);
router.get('/created', authMiddleware, cacheMiddleware(120), getCreatedSplits);
router.post('/remind/:id', authMiddleware, remindSplitMember);

export default router;
