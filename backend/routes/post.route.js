import express from 'express';
import { createPost, updatePost, getPosts, deletePost, likePost, votePost, addComment, deleteComment, updateComment, getComments, getFeed, getFollowingPosts, getPostsByUserId, getPostByPostId, getSmartFeed, reportPost, getReports, adminDeletePost, resolveReport } from '../controllers/post.controller.js';
import { authMiddleware, isAdmin } from '../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { createLimiter, feedLimiter } from '../middlewares/rateLimit.middleware.js';
import { upload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';
import { tagUsers, respondToTag, getPendingTags, getTaggedPosts } from "../controllers/postTags.controller.js";
import { toggleRepost, getReposts } from "../controllers/repost.controller.js";
const router = express.Router();

// ── Specific named routes MUST come before wildcard /:id routes ──
router.post('/create', authMiddleware, createLimiter, upload.array('image'), r2UploadMiddleware({ image: 'posts' }), createPost);
router.get('/posts', authMiddleware, cacheMiddleware(300, { tags: (req) => [`posts:user:${req.user.id}`] }), getPosts);

// Feed routes
router.get('/feed', authMiddleware, feedLimiter, cacheMiddleware(60, { tags: ['posts'] }), getFeed);
router.get('/feed/followers', authMiddleware, feedLimiter, cacheMiddleware(60, { tags: ['posts'] }), getFollowingPosts);
router.get('/feed/:userId', authMiddleware, cacheMiddleware(1, { tags: (req) => [`posts:user:${req.params.userId}`] }), getPostsByUserId);

// Smart feed — POST so it can receive seenIds in the body
// MUST be above /:id or Express will treat "smart-feed" as an ObjectId
router.post('/smart-feed', authMiddleware, feedLimiter, getSmartFeed);

// Comment routes
router.post('/like/:id', authMiddleware, likePost);
router.post('/vote/:id', authMiddleware, votePost);
router.post('/comment/:id', authMiddleware, addComment);
router.delete('/comment/:id', authMiddleware, deleteComment);
router.post('/comment/update/:id', authMiddleware, updateComment);
router.get('/comment/:id', authMiddleware, cacheMiddleware(60, { tags: (req) => [`post:${req.params.id}`] }), getComments);

// Report routes
router.post('/report', authMiddleware, reportPost);

// Reposting. A reference to the original, so credit and edits stay with the author.
router.post('/repost/:id', authMiddleware, toggleRepost('post'));
router.get('/reposts/:userId', authMiddleware, getReposts('post'));

// Tagging. A tag is a request until the tagged person accepts it, so responding
// and listing are separate from creating.
router.post('/:id/tag', authMiddleware, tagUsers);
router.post('/:id/tag/respond', authMiddleware, respondToTag);
router.get('/tags/pending', authMiddleware, getPendingTags);
router.get('/tags/user/:userId', authMiddleware, getTaggedPosts);
router.get('/admin/reports', authMiddleware, isAdmin, getReports);
router.patch('/admin/reports/:id', authMiddleware, isAdmin, resolveReport);
router.post('/admin/delete-post', authMiddleware, isAdmin, adminDeletePost);


// Individual post
router.get('/individual/:postId', authMiddleware, cacheMiddleware(300, { tags: (req) => [`post:${req.params.postId}`] }), getPostByPostId);

// Wildcard /:id routes — MUST be last (they match everything)
router.post('/:id', authMiddleware, upload.array('image'), r2UploadMiddleware({ image: 'posts' }), updatePost);
router.delete('/:id', authMiddleware, deletePost);

export default router;