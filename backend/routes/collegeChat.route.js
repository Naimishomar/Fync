import express from 'express';
import { sendMessage, getMessages, deleteMessage } from '../controllers/collegeChat.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { collegeChatUpload } from '../utils/cloudinary.js';

const router = express.Router();

router.post('/send', authMiddleware, collegeChatUpload.single('media'), sendMessage);
router.get('/messages', authMiddleware, getMessages);
router.delete('/:id', authMiddleware, deleteMessage);

export default router;
