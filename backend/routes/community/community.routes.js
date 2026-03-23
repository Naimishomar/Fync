import express from 'express';
import {
    createCommunity,
    getAllCommunities,
    getCommunityDetails,
    joinCommunity,
    leaveCommunity,
    createSubCommunity,
    getSubCommunityMessages,
    postMessage,
    deleteMessage,
    exportChatHistory,
    updateCommunity,
    deleteCommunity,
    updateSubCommunity,
    deleteSubCommunity,
    renewHubSubscription
} from '../../controllers/community/community.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/cloudinary.js';

const router = express.Router();

router.post('/create', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), createCommunity);
router.get('/all', authMiddleware, getAllCommunities);
router.get('/details/:id', authMiddleware, getCommunityDetails);
router.post('/join/:id', authMiddleware, joinCommunity);
router.post('/leave/:id', authMiddleware, leaveCommunity);
router.post('/sub/create', authMiddleware, upload.single('logo'), createSubCommunity);
router.get('/sub/messages/:subId', authMiddleware, getSubCommunityMessages);
router.post('/sub/message/send', authMiddleware, postMessage);
router.post('/sub/message/delete', authMiddleware, deleteMessage);
router.get('/sub/export/:subId', authMiddleware, exportChatHistory);

// Admin / Delete / Update
router.put('/update', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateCommunity);
router.delete('/delete', authMiddleware, deleteCommunity);
router.put('/sub/update', authMiddleware, upload.single('logo'), updateSubCommunity);
router.delete('/sub/delete', authMiddleware, deleteSubCommunity);
router.post('/renew', authMiddleware, renewHubSubscription);

export default router;
