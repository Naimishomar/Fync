import express from 'express';
import { createShorts } from '../controllers/shorts.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
const router = express.Router();

router.post('/create', authMiddleware, createShorts);