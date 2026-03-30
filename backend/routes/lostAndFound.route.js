import express from 'express';
import { createFoundItem, createLostItem, getFoundItems, getLostItems, claimedFoundItem, claimedLostItem, deleteLostAndFoundItem } from '../controllers/lostAndFound.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';

const router = express.Router(); 

router.post('/create/found', authMiddleware, upload.single('productImage'), r2UploadMiddleware({ __single__: 'lost_and_found' }), createFoundItem);
router.post('/create/lost', authMiddleware, upload.single('productImage'), r2UploadMiddleware({ __single__: 'lost_and_found' }), createLostItem);
router.get('/get/found', authMiddleware, getFoundItems);
router.get('/get/lost', authMiddleware, getLostItems);
router.post('/claimed/found/:id', authMiddleware, claimedFoundItem);
router.post('/claimed/lost/:id', authMiddleware, claimedLostItem);
router.post('/delete/:id', authMiddleware, deleteLostAndFoundItem);

export default router;