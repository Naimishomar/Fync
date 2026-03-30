import express from 'express';
import { sendMessage, getMessages, deleteMessage } from '../controllers/collegeChat.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { collegeChatUpload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';

const router = express.Router();

router.post('/send', authMiddleware, collegeChatUpload.single('media'), r2UploadMiddleware({ __single__: 'college_chats' }), sendMessage);
router.get('/messages', authMiddleware, getMessages);
router.delete('/:id', authMiddleware, deleteMessage);

export default router;
