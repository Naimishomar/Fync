import express from 'express';
import { getDiscoverFeed } from "../controllers/discover.controller.js";
import { addComment, batchViewsInShorts, createShorts, deleteComment, deleteShort, fetchShorts, getAllComments, getShortByShortId, getShortsByUserId, getSmartShorts, getYourShorts, likeAndUnlikeShort, updateComment, updateShort, viewsInShort } from '../controllers/shorts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { createLimiter, feedLimiter } from '../middlewares/rateLimit.middleware.js';
import { videoUpload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';
const router = express.Router();

router.use((req, res, next) => {
  console.log(`📦 [ShortRouter] Request: ${req.method} ${req.url}`);
  next();
});

router.post('/create', authMiddleware, createLimiter, videoUpload.single('video'), r2UploadMiddleware({ __single__: 'video' }), createShorts);
// Discover: aggregated tech content, cached in Redis and stored nowhere.
//
// Deliberately NOT wrapped in cacheMiddleware: that keys on the full URL, and
// every user sends a different ?seen list, so the cache would miss on every
// request and refetch all sources each time. The controller caches the ranked
// collection instead, so one upstream fetch serves everybody and the per-user
// filtering happens after it.
router.get('/discover', authMiddleware, feedLimiter, getDiscoverFeed);

router.get('/all', authMiddleware, feedLimiter, cacheMiddleware(60, { tags: ['shorts'] }), fetchShorts);
router.get('/your', authMiddleware, cacheMiddleware(300, { tags: (req) => [`shorts:user:${req.user.id}`] }), getYourShorts);
router.post('/smart', authMiddleware, feedLimiter, getSmartShorts);

router.get('/feed/:userId', authMiddleware, cacheMiddleware(1, { tags: (req) => [`shorts:user:${req.params.userId}`] }), getShortsByUserId);

router.post('/update/:id', authMiddleware, videoUpload.single('video'), r2UploadMiddleware({ __single__: 'video' }), updateShort);
router.post('/delete/:id', authMiddleware, deleteShort);
router.delete('/delete/:id', authMiddleware, deleteShort); // Keep DELETE for compatibility


// Individual and user specific
router.get('/user/:userId', authMiddleware, cacheMiddleware(300, { tags: (req) => [`shorts:user:${req.params.userId}`] }), getShortsByUserId);
router.get('/individual/:shortId', authMiddleware, cacheMiddleware(300, { tags: (req) => [`short:${req.params.shortId}`] }), getShortByShortId);

// Interaction routes
router.post('/like/:id', authMiddleware, likeAndUnlikeShort);
router.post('/comment/:id', authMiddleware, addComment);
router.get('/comments/:id', authMiddleware, cacheMiddleware(60, { tags: (req) => [`short:${req.params.id}`] }), getAllComments);
router.post('/comment/update/:id', authMiddleware, updateComment);
router.post('/comment/delete/:id', authMiddleware, deleteComment);
router.delete('/comment/:id', authMiddleware, deleteComment);

// Batch endpoint first — one request for a whole scrolling session.
router.post('/views', authMiddleware, batchViewsInShorts);
router.post('/views/:id', authMiddleware, viewsInShort);   // legacy single-id

export default router;