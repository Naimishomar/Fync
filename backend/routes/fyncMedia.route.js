import express from 'express';
import {
  createFyncMedia, getFyncMedia, getFyncMediaById, updateMedia, deleteMedia,
  likeAndUnlikeMedia, dislikeAndUndislikeMedia, addMediaComment, getMediaComments, deleteMediaComment
} from '../controllers/fync media/fyncMedia.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { fyncMediaCombinedUpload } from '../utils/cloudinary.js';

const router = express.Router();

const uploadFyncMedia = (req, res, next) => {
  fyncMediaCombinedUpload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ])(req, res, async (err) => {
    if (err) return next(err);
    if (req.files) {
      req.files = {
        thumbnail: req.files['thumbnail'] ? req.files['thumbnail'][0] : undefined,
        video: req.files['video'] ? req.files['video'][0] : undefined
      };
    }
    next();
  });
};

router.post('/create', authMiddleware, uploadFyncMedia, createFyncMedia);
router.get('/all', authMiddleware, getFyncMedia);
router.get('/:id', authMiddleware, getFyncMediaById);
router.put('/update/:id', authMiddleware, uploadFyncMedia, updateMedia);
router.delete('/delete/:id', authMiddleware, deleteMedia);

// Interaction Routes
router.post('/like/:id', authMiddleware, likeAndUnlikeMedia);
router.post('/dislike/:id', authMiddleware, dislikeAndUndislikeMedia);
router.post('/comment/add/:id', authMiddleware, addMediaComment);
router.get('/comment/all/:id', authMiddleware, getMediaComments);
router.delete('/comment/:id', authMiddleware, deleteMediaComment);

export default router;