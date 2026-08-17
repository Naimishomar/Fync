import express from "express";
import {
    addQuestion,
    getQuestions,
    upvoteQuestion,
    addComment,
    getComments,
    getTrending,
    toggleSave
} from "../controllers/placementHub.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { cacheMiddleware } from "../middlewares/cache.middleware.js";

const router = express.Router();

router.post("/add", authMiddleware, addQuestion);
router.get("/questions", authMiddleware, cacheMiddleware(300, { tags: ['placement'] }), getQuestions);
router.get("/trending", authMiddleware, cacheMiddleware(600, { tags: ['placement'] }), getTrending);
router.post("/upvote/:id", authMiddleware, upvoteQuestion);
router.post("/comment/:id", authMiddleware, addComment);
router.get("/comments/:id", authMiddleware, cacheMiddleware(60, { tags: (req) => [`placement:${req.params.id}`] }), getComments);
router.post("/save/:id", authMiddleware, toggleSave);

export default router;
