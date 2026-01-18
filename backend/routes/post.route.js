import express from 'express';
import { createPost, updatePost, getPosts, deletePost, likePost, addComment, deleteComment, updateComment, getComments, getFeed, getFollowingPosts, getPostsByUserId, getPostByPostId } from '../controllers/post.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/cloudinary.js';
const router = express.Router();

router.post('/create', authMiddleware, upload.array('image'), createPost);
router.get('/posts', authMiddleware, getPosts);
router.post('/:id', authMiddleware, upload.array('image'), updatePost);
router.delete('/:id', authMiddleware, deletePost);
router.post('/like/:id', authMiddleware, likePost);
router.post('/comment/:id', authMiddleware, addComment);
router.delete('/comment/:id', authMiddleware, deleteComment);
router.post('/comment/:id', authMiddleware, updateComment);
router.get('/comment/:id', authMiddleware, getComments);
router.get('/feed', authMiddleware, getFeed);
router.get("/feed/followers", authMiddleware, getFollowingPosts);
router.get("/feed/:userId", authMiddleware, getPostsByUserId);
router.get("/individual/:postId", authMiddleware, getPostByPostId);

export default router;