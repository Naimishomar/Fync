import express from 'express';
import { addGames, getAllGames, getYourGames, deleteGames, joinGames } from '../controllers/collaboration/gaming.controller.js';
import { addOuting, getAllOutings, getYourOuting, deleteOuting, joinOuting } from '../controllers/collaboration/outing.controller.js';
import { findTeamMembers } from '../controllers/collaboration/teamMaking.controller.js';    
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.post('/add/games', authMiddleware, addGames);
router.get('/games', authMiddleware, getAllGames);
router.get('/games/your', authMiddleware, getYourGames);
router.delete('/games/:id', authMiddleware, deleteGames);
router.post('/games/:id/join', authMiddleware, joinGames);

router.post('/add/outing', authMiddleware, addOuting);
router.get('/outings', authMiddleware, getAllOutings);
router.get('/outings/your', authMiddleware, getYourOuting);
router.delete('/outings/:id', authMiddleware, deleteOuting);
router.post('/outings/:id/join', authMiddleware, joinOuting);

router.post('/find/teamMembers', authMiddleware, findTeamMembers);

export default router;