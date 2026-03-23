import express from "express";
import { createRoom, getLeaderboard, getRoomById, getArenaStats, getTopGladiators } from '../controllers/quiz/quiz.controller.js'
import { authMiddleware } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.post('/create-room', authMiddleware, createRoom);
router.get('/room/:roomId', authMiddleware, getRoomById);
router.get('/leaderboard/:roomId', authMiddleware, getLeaderboard);
router.get('/arena-stats', authMiddleware, getArenaStats);
router.get('/top-gladiators', authMiddleware, getTopGladiators);

export default router;