import express from 'express';
import { login, register, updateUser, getProfile, getUserProfile, followUser, unfollowUser, getFollowers, getFollowing, sendOTP, logout, refreshToken, getUserProfileByName, verifyEmailOTP } from '../controllers/auth.controller.js';
import { otpLimiter } from '../middlewares/otpLimiter.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../utils/cloudinary.js';
const router = express.Router();

router.post('/send-email-otp', otpLimiter, sendOTP);
// router.post('/send-phone-otp', sendnumberOTP);
router.post('/verify-email-otp', verifyEmailOTP);
router.post('/register', upload.single('avatar'), register);
router.post('/refresh-token', refreshToken);
router.post('/login', login);
router.post('/update', authMiddleware, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateUser);
router.get('/profile', authMiddleware, getProfile);
router.post('/search', authMiddleware, getUserProfileByName);
router.get('/profile/:id', authMiddleware, getUserProfile);
router.post('/follow/:id', authMiddleware, followUser);
router.post('/unfollow/:id', authMiddleware, unfollowUser);
router.get('/followers/:id', authMiddleware, getFollowers);
router.get('/following/:id', authMiddleware, getFollowing);
router.get('/logout', authMiddleware, logout);


export default router; 