import express from 'express';
import { login, register, updateUser, getProfile, getUserProfile, followUser, unfollowUser, getFollowers, getFollowing, sendOTP, logout, refreshToken } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/cloudinary.js';
const router = express.Router();

router.post('/send-email-otp', sendOTP);
// router.post('/send-phone-otp', sendnumberOTP);
router.post('/register', upload.single('avatar'), register);
router.post('/refresh-token', refreshToken);
router.post('/login', login);
router.post('/update', authMiddleware, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateUser);
router.get('/profile', authMiddleware, getProfile);
router.get('/:id', authMiddleware, getUserProfile);
router.post('/:id/follow', authMiddleware, followUser);
router.post('/:id/unfollow', authMiddleware, unfollowUser);
router.get('/:id/followers', authMiddleware, getFollowers);
router.get('/:id/following', authMiddleware, getFollowing);
router.get('/logout', authMiddleware, logout);


export default router; 