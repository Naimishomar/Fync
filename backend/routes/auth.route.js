import express from 'express';
import { 
  login, 
  register, 
  updateUser, 
  getProfile, 
  getUserProfile,  
  followUser, 
  unfollowUser, 
  getFollowers, 
  getFollowing, 
  sendOTP, 
  logout, 
  refreshToken, 
  getUserProfileByName, 
  verifyEmailOTP, 
  resetPassword, 
  verifyResetPassword,
  sendAlumniOTP, 
  verifyAlumniOTP,
  registerAlumni,
  getAlumniByCollege,
  savePushToken,
  registerRecruiter,
  sendRecruiterOTP,
  verifyRecruiterOTP,
  getUsersForAdmin,
  banUser,
  verifyAdminPassword,
  updateFcmToken,
  getUserStatus,
  getOnlineUsers
} from '../controllers/auth.controller.js';
import { getStreakLeaderboard } from '../controllers/streak.controller.js';
import { getDevelopers } from '../controllers/developer.controller.js'
import { otpLimiter } from '../middlewares/otpLimiter.js';
import { authMiddleware, isAdmin } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { upload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';
const router = express.Router();

router.post('/send-email-otp', otpLimiter, sendOTP);
router.post('/send-alumni-otp', otpLimiter, sendAlumniOTP);
router.post('/send-recruiter-otp', otpLimiter, sendRecruiterOTP);
// router.post('/send-phone-otp', sendnumberOTP);
router.post('/verify-email-otp', otpLimiter, verifyEmailOTP);
router.post('/verify-alumni-otp', otpLimiter, verifyAlumniOTP);
router.post('/verify-recruiter-otp', otpLimiter, verifyRecruiterOTP);
router.post('/reset-password', otpLimiter, resetPassword);
router.post('/verify-reset-password', otpLimiter, verifyResetPassword);
router.post('/register', otpLimiter, upload.single('avatar'), r2UploadMiddleware({ __single__: 'avatar' }), register);
router.post('/register-alumni', otpLimiter, upload.single('avatar'), r2UploadMiddleware({ __single__: 'avatar' }), registerAlumni);
router.post('/register-recruiter', otpLimiter, upload.single('avatar'), r2UploadMiddleware({ __single__: 'avatar' }), registerRecruiter);
router.post('/refresh-token', authLimiter, refreshToken);
router.post('/login', authLimiter, login);
router.post('/update', authMiddleware, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }, { name: 'resume', maxCount: 1 }]), r2UploadMiddleware({ avatar: 'avatar', banner: 'banner', resume: 'resumes' }), updateUser);
router.get('/profile', authMiddleware, getProfile);
router.get('/get-alumni', authMiddleware, cacheMiddleware(600), getAlumniByCollege);
router.post('/search', authMiddleware, getUserProfileByName);
router.get('/search', authMiddleware, getUserProfileByName);
router.get('/profile/:id', authMiddleware, cacheMiddleware(600), getUserProfile);
router.post('/follow/:id', authMiddleware, followUser);
router.post('/unfollow/:id', authMiddleware, unfollowUser);
router.get('/followers/:id', authMiddleware, cacheMiddleware(3600), getFollowers);
router.get('/following/:id', authMiddleware, cacheMiddleware(3600), getFollowing);
router.get('/logout', authMiddleware, logout);
router.get('/streak-leaderboard', authMiddleware, getStreakLeaderboard);
router.post('/save-push-token', authMiddleware, savePushToken);
router.post('/fcm-token', authMiddleware, updateFcmToken);

//Developer Routes
router.get('/find-team', authMiddleware, getDevelopers);

// Admin Routes
router.get('/admin/users', authMiddleware, isAdmin, getUsersForAdmin);
router.post('/admin/ban/:userId', authMiddleware, isAdmin, banUser);
router.post('/admin/verify-password', authMiddleware, isAdmin, verifyAdminPassword);

// Call Status Routes
router.get('/status/:userId', authMiddleware, getUserStatus);
router.get('/online', authMiddleware, getOnlineUsers);

export default router; 