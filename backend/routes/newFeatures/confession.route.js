import express from 'express';
import { 
    createConfession,
    getConfessions, 
    likeConfession, 
    addConfessionComment, 
    getConfessionComments,
    searchUsersForTag,
    updateConfession,
    deleteConfession 
} from '../../controllers/newFeatures/confession.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../../middlewares/cache.middleware.js';

const router = express.Router();

router.post('/', authMiddleware, createConfession);
router.get('/', authMiddleware, cacheMiddleware(60, { tags: ['confessions'] }), getConfessions);
router.get('/search-users', authMiddleware, searchUsersForTag);
router.post('/like/:id', authMiddleware, likeConfession);
router.post('/comment/:id', authMiddleware, addConfessionComment);
router.get('/comments/:id', authMiddleware, cacheMiddleware(300, { tags: (req) => [`confession:${req.params.id}`] }), getConfessionComments);
router.put('/:id', authMiddleware, updateConfession);
router.delete('/:id', authMiddleware, deleteConfession);

export default router;
