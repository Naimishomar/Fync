import express from 'express';
import { addComment, createShorts, deleteComment, deleteShort, fetchShorts, getAllComments, getShortsByUserId, getYourShorts, likeAndUnlikeShort, updateComment, updateShort, viewsInShort } from '../controllers/shorts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { videoUpload } from '../utils/cloudinary.js';
const router = express.Router();

router.post('/create', authMiddleware, videoUpload.single('video'), createShorts);
router.get("/get/shorts", authMiddleware, fetchShorts);
router.get("/get/yours", authMiddleware, getYourShorts);
router.post('/update/:id', authMiddleware, updateShort);
router.post('/delete/:id', authMiddleware, deleteShort);
router.post('/like/:id', authMiddleware, likeAndUnlikeShort);
router.post('/comment/add/:id', authMiddleware, addComment);
router.get('/comment/all/:id', authMiddleware, getAllComments);
router.post("/comment/update/:id", authMiddleware, updateComment);
router.post('/comment/delete/:id', authMiddleware, deleteComment);
router.get('/view/:id', authMiddleware, viewsInShort);
router.get("/feed/:userId", authMiddleware, getShortsByUserId);

export default router;