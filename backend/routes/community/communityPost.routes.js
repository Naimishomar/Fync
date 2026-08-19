import express from 'express';
import {
    getFeed,
    createPost,
    getPost,
    deletePost,
    votePost,
    addComment,
    deleteComment,
} from '../../controllers/community/communityPost.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/r2.js';
import { r2UploadMiddleware } from '../../utils/r2Upload.js';

const router = express.Router();

router.get('/sub/:subId/posts', authMiddleware, getFeed);
router.post(
    '/posts',
    authMiddleware,
    upload.array('image', 4),
    r2UploadMiddleware({ __single__: 'community_posts' }),
    createPost
);
router.get('/posts/:postId', authMiddleware, getPost);
router.delete('/posts/:postId', authMiddleware, deletePost);
router.post('/posts/:postId/vote', authMiddleware, votePost);
router.post('/posts/:postId/comments', authMiddleware, addComment);
router.delete('/comments/:commentId', authMiddleware, deleteComment);

export default router;
