import express from "express";
import {
    addQuestion,
    getQuestions,
    upvoteQuestion,
    addComment,
    getTrending,
    toggleSave
} from "../controllers/placementHub.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/add", authMiddleware, addQuestion);
router.get("/questions", authMiddleware, getQuestions);
router.get("/trending", authMiddleware, getTrending);
router.post("/upvote/:id", authMiddleware, upvoteQuestion);
router.post("/comment/:id", authMiddleware, addComment);
router.post("/save/:id", authMiddleware, toggleSave);

export default router;
