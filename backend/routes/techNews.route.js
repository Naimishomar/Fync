import express from 'express';
import { getTrendingTechNews } from '../controllers/techNews.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';

const router = express.Router();

// Identical for every user, so one upstream fetch is shared across all of them.
// Fifteen minutes keeps the list current without hammering a free public index.
router.get('/trending', authMiddleware, cacheMiddleware(900, { shared: true }), getTrendingTechNews);

export default router;
