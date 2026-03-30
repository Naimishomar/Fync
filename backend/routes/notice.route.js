import express from 'express';
import { createNotice, createGlobalNotice, getCollegeNotices, getGlobalNotices, deleteNotice, UpdateNotice, addComment, getComments, updateComment, deleteComment, likeNotice } from '../controllers/notice.controller.js'; 
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';

const router = express.Router();

router.post('/create', authMiddleware, upload.array('noticeImage'), r2UploadMiddleware({ noticeImage: 'notices' }), createNotice);
router.post('/create/global', authMiddleware, upload.array('noticeImage'), r2UploadMiddleware({ noticeImage: 'notices' }), createGlobalNotice);
router.get('/get', authMiddleware, getCollegeNotices);
router.get('/get/global', authMiddleware, getGlobalNotices);
router.delete('/delete/:id', authMiddleware, deleteNotice);
router.post('/update/:id', authMiddleware, upload.array('noticeImage'), r2UploadMiddleware({ noticeImage: 'notices' }), UpdateNotice);
router.post('/comment/add/:id', authMiddleware, addComment);
router.get('/comment/all/:id', authMiddleware, getComments);
router.post('/comment/update/:id', authMiddleware, updateComment);
router.post('/comment/delete/:id', authMiddleware, deleteComment);
router.post('/like/:id', authMiddleware, likeNotice);

export default router;