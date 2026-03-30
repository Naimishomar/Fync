import express from 'express';
import { addComment, createShorts, deleteComment, deleteShort, fetchShorts, getAllComments, getShortByShortId, getShortsByUserId, getSmartShorts, getYourShorts, likeAndUnlikeShort, updateComment, updateShort, viewsInShort } from '../controllers/shorts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { videoUpload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';
const router = express.Router();

router.use((req, res, next) => {
  console.log(`📦 [ShortRouter] Request: ${req.method} ${req.url}`);
  next();
});

router.post('/create', authMiddleware, videoUpload.single('video'), r2UploadMiddleware({ __single__: 'video' }), createShorts);
router.get('/all', authMiddleware, cacheMiddleware(60), fetchShorts);
router.get('/your', authMiddleware, cacheMiddleware(300), getYourShorts);
router.post('/smart', authMiddleware, getSmartShorts);

router.get('/feed/:userId', authMiddleware, cacheMiddleware(1), getShortsByUserId);

router.post('/update/:id', authMiddleware, updateShort);
router.post('/delete/:id', authMiddleware, deleteShort);
router.delete('/delete/:id', authMiddleware, deleteShort); // Keep DELETE for compatibility


// Individual and user specific
router.get('/user/:userId', authMiddleware, cacheMiddleware(300), getShortsByUserId);
router.get('/individual/:shortId', authMiddleware, cacheMiddleware(300), getShortByShortId);

// Interaction routes
router.post('/like/:id', authMiddleware, likeAndUnlikeShort);
router.post('/comment/:id', authMiddleware, addComment);
router.get('/comments/:id', authMiddleware, cacheMiddleware(60), getAllComments);
router.post('/comment/update/:id', authMiddleware, updateComment);
router.post('/comment/delete/:id', authMiddleware, deleteComment);
router.delete('/comment/:id', authMiddleware, deleteComment);

router.post('/views/:id', authMiddleware, viewsInShort);

export default router;