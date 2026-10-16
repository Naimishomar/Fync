import express from 'express';
import { getDiscoverFeed, reportUnplayable } from "../controllers/discover.controller.js";
import { addComment, batchViewsInShorts, createShorts, deleteComment, deleteShort, fetchShorts, getAllComments, getShortByShortId, getShortsByUserId, getSmartShorts, getYourShorts, likeAndUnlikeShort, reportShort, updateComment, updateShort, viewsInShort } from '../controllers/shorts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { createLimiter, feedLimiter } from '../middlewares/rateLimit.middleware.js';
import { shortsUpload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';
import { toggleRepost, getReposts } from "../controllers/repost.controller.js";
const router = express.Router();

router.use((req, res, next) => {
  console.log(`📦 [ShortRouter] Request: ${req.method} ${req.url}`);
  next();
});

// Video and poster frame arrive together. The folder for the video is
// unchanged ('video') so URLs already in the database stay valid.
router.post(
  '/create',
  authMiddleware,
  createLimiter,
  shortsUpload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  r2UploadMiddleware({ video: 'video', thumbnail: 'shorts_thumbnails' }),
  createShorts,
);
// Discover: aggregated tech content, cached in Redis and stored nowhere.
//
// Deliberately NOT wrapped in cacheMiddleware: that keys on the full URL, and
// every user sends a different ?seen list, so the cache would miss on every
// request and refetch all sources each time. The controller caches the ranked
// collection instead, so one upstream fetch serves everybody and the per-user
// filtering happens after it.
router.get('/discover', authMiddleware, feedLimiter, getDiscoverFeed);

// Reposting. A reference to the original, so credit and edits stay with the author.
router.post('/repost/:id', authMiddleware, toggleRepost('shorts'));
router.get('/reposts/:userId', authMiddleware, getReposts('shorts'));
router.post('/discover/unplayable', authMiddleware, feedLimiter, reportUnplayable);

router.get('/all', authMiddleware, feedLimiter, cacheMiddleware(60, { tags: ['shorts'] }), fetchShorts);
router.get('/your', authMiddleware, cacheMiddleware(300, { tags: (req) => [`shorts:user:${req.user.id}`] }), getYourShorts);
router.post('/smart', authMiddleware, feedLimiter, getSmartShorts);

router.get('/feed/:userId', authMiddleware, cacheMiddleware(1, { tags: (req) => [`shorts:user:${req.params.userId}`] }), getShortsByUserId);

router.post('/update/:id', authMiddleware, shortsUpload.single('video'), r2UploadMiddleware({ __single__: 'video' }), updateShort);
router.post('/delete/:id', authMiddleware, deleteShort);
router.delete('/delete/:id', authMiddleware, deleteShort); // Keep DELETE for compatibility


// Individual and user specific
router.get('/user/:userId', authMiddleware, cacheMiddleware(300, { tags: (req) => [`shorts:user:${req.params.userId}`] }), getShortsByUserId);
router.get('/individual/:shortId', authMiddleware, cacheMiddleware(300, { tags: (req) => [`short:${req.params.shortId}`] }), getShortByShortId);

// Interaction routes
router.post('/like/:id', authMiddleware, likeAndUnlikeShort);
router.post('/report', authMiddleware, reportShort);
router.post('/comment/:id', authMiddleware, addComment);
router.get('/comments/:id', authMiddleware, cacheMiddleware(60, { tags: (req) => [`short:${req.params.id}`] }), getAllComments);
router.post('/comment/update/:id', authMiddleware, updateComment);
router.post('/comment/delete/:id', authMiddleware, deleteComment);
router.delete('/comment/:id', authMiddleware, deleteComment);

// Batch endpoint first — one request for a whole scrolling session.
router.post('/views', authMiddleware, batchViewsInShorts);
router.post('/views/:id', authMiddleware, viewsInShort);   // legacy single-id

export default router;