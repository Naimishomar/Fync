import express from 'express';
import { createStory, getStoryFeed, viewStory, getStoryViewers, deleteStory } from '../controllers/story.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { createLimiter } from '../middlewares/rateLimit.middleware.js';
import { upload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';

const router = express.Router();

router.post('/', authMiddleware, createLimiter, upload.single('image'), r2UploadMiddleware({ __single__: 'stories' }), createStory);
router.get('/feed', authMiddleware, getStoryFeed);
router.post('/:id/view', authMiddleware, viewStory);
router.get('/:id/viewers', authMiddleware, getStoryViewers);
router.delete('/:id', authMiddleware, deleteStory);

export default router;
