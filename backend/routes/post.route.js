import express from 'express';
import { createPost, updatePost, getPosts, deletePost, likePost, addComment, deleteComment, updateComment, getComments, getFeed, getFollowingPosts, getPostsByUserId, getPostByPostId, getSmartFeed } from '../controllers/post.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/cloudinary.js';
const router = express.Router();

// ── Specific named routes MUST come before wildcard /:id routes ──
router.post('/create', authMiddleware, upload.array('image'), createPost);
router.get('/posts', authMiddleware, getPosts);

// Feed routes
router.get('/feed', authMiddleware, getFeed);
router.get('/feed/followers', authMiddleware, getFollowingPosts);
router.get('/feed/:userId', authMiddleware, getPostsByUserId);

// Smart feed — POST so it can receive seenIds in the body
// MUST be above /:id or Express will treat "smart-feed" as an ObjectId
router.post('/smart-feed', authMiddleware, getSmartFeed);

// Comment routes
router.post('/like/:id', authMiddleware, likePost);
router.post('/comment/:id', authMiddleware, addComment);
router.delete('/comment/:id', authMiddleware, deleteComment);
router.post('/comment/update/:id', authMiddleware, updateComment);
router.get('/comment/:id', authMiddleware, getComments);

// Individual post
router.get('/individual/:postId', authMiddleware, getPostByPostId);

// Wildcard /:id routes — MUST be last (they match everything)
router.post('/:id', authMiddleware, upload.array('image'), updatePost);
router.delete('/:id', authMiddleware, deletePost);

export default router;