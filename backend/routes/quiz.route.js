import express from "express";
import { createRoom, getLeaderboard, getRoomById } from '../controllers/quiz/quiz.controller.js'
import { authMiddleware } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.post('/create-room', authMiddleware, createRoom);
router.get('/room/:roomId', authMiddleware, getRoomById);
router.get('/leaderboard/:roomId', authMiddleware, getLeaderboard);

export default router;