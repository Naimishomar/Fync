import express from 'express';
import { createNotice, createGlobalNotice, getCollegeNotices, getGlobalNotices, deleteNotice, UpdateNotice, addComment, getComments, updateComment, deleteComment } from '../controllers/notice.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

router.post('/create', authMiddleware, upload.array('noticeImage'), createNotice);
router.post('/create/global', authMiddleware, upload.array('noticeImage'), createGlobalNotice);
router.get('/get', authMiddleware, getCollegeNotices);
router.get('/get/global', authMiddleware, getGlobalNotices);
router.delete('/delete/:id', authMiddleware, deleteNotice);
router.post('/update/:id', authMiddleware, upload.array('noticeImage'), UpdateNotice);
router.post('/comment/add/:id', authMiddleware, addComment);
router.get('/comment/all/:id', authMiddleware, getComments);
router.post('/comment/update/:id', authMiddleware, updateComment);
router.post('/comment/delete/:id', authMiddleware, deleteComment);  

export default router;