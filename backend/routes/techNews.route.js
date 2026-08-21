import express from 'express';
import { getTrendingTechNews } from '../controllers/techNews.controller.js';
import { getArticle } from '../controllers/articleReader.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';

const router = express.Router();

// Identical for every user, so one upstream fetch is shared across all of them.
// Fifteen minutes keeps the list current without hammering a free public index.
router.get('/trending', authMiddleware, cacheMiddleware(900, { shared: true }), getTrendingTechNews);

// Extraction is expensive (fetch + full DOM parse) and the result is the same
// for everyone, so it is cached shared and for far longer than the feed: an
// article's text does not change after publication.
router.get('/article', authMiddleware, cacheMiddleware(21600, { shared: true }), getArticle);

export default router;
