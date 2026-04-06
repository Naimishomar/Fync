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
  savePushToken
} from '../controllers/auth.controller.js';
import { getDevelopers } from '../controllers/developer.controller.js'
import { otpLimiter } from '../middlewares/otpLimiter.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { upload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';
const router = express.Router();

router.post('/send-email-otp', sendOTP);
router.post('/send-alumni-otp', sendAlumniOTP);
// router.post('/send-phone-otp', sendnumberOTP);
router.post('/verify-email-otp', verifyEmailOTP);
router.post('/verify-alumni-otp', verifyAlumniOTP);
router.post('/reset-password', resetPassword);
router.post('/verify-reset-password', verifyResetPassword);
router.post('/register', upload.single('avatar'), r2UploadMiddleware({ __single__: 'avatar' }), register);
router.post('/register-alumni', upload.single('avatar'), r2UploadMiddleware({ __single__: 'avatar' }), registerAlumni);
router.post('/refresh-token', refreshToken);
router.post('/login', login);
router.post('/update', authMiddleware, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), r2UploadMiddleware({ avatar: 'avatar', banner: 'banner' }), updateUser);
router.get('/profile', authMiddleware, getProfile);
router.get('/get-alumni', authMiddleware, cacheMiddleware(600), getAlumniByCollege);
router.post('/search', authMiddleware, getUserProfileByName);
router.get('/profile/:id', authMiddleware, cacheMiddleware(600), getUserProfile);
router.post('/follow/:id', authMiddleware, followUser);
router.post('/unfollow/:id', authMiddleware, unfollowUser);
router.get('/followers/:id', authMiddleware, cacheMiddleware(3600), getFollowers);
router.get('/following/:id', authMiddleware, cacheMiddleware(3600), getFollowing);
router.get('/logout', authMiddleware, logout);
router.post('/save-push-token', authMiddleware, savePushToken);

//Developer Routes
router.get('/find-team', authMiddleware, getDevelopers);


export default router; 