import express from 'express';
import { addGames, getAllGames, getYourGames, deleteGames, joinGames, leaveGames } from '../controllers/collaboration/gaming.controller.js';
import { addOuting, getAllOutings, getYourOuting, deleteOuting, joinOuting, leaveOuting } from '../controllers/collaboration/outing.controller.js'; 
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.post('/add/games', authMiddleware, addGames);
router.get('/games', authMiddleware, getAllGames);
router.get('/games/your', authMiddleware, getYourGames);
router.post('/games/:id', authMiddleware, deleteGames);
router.post('/games/:id/join', authMiddleware, joinGames);
router.post('/games/:id/leave', authMiddleware, leaveGames);


router.post('/add/outing', authMiddleware, addOuting);
router.get('/outings', authMiddleware, getAllOutings);
router.get('/outings/your', authMiddleware, getYourOuting);
router.post('/outings/:id', authMiddleware, deleteOuting);
router.post('/outings/:id/join', authMiddleware, joinOuting);
router.post('/outings/:id/leave', authMiddleware, leaveOuting);

export default router;