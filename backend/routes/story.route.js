import express from 'express';
import { createStory, getStoryFeed, viewStory, getStoryViewers, deleteStory } from '../controllers/story.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { createLimiter } from '../middlewares/rateLimit.middleware.js';
import { storyUpload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';

const router = express.Router();

router.post('/', authMiddleware, createLimiter, storyUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), r2UploadMiddleware({ image: 'stories', video: 'stories' }), createStory);
router.get('/feed', authMiddleware, getStoryFeed);
router.post('/:id/view', authMiddleware, viewStory);
router.get('/:id/viewers', authMiddleware, getStoryViewers);
router.delete('/:id', authMiddleware, deleteStory);

export default router;
