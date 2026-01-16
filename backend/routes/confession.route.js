import express from "express";
import { createConfession, getConfession, likeAndUnlikeConfession, createConfessionComment, getConfessionComments, deleteConfession, reportConfession } from "../controllers/newFeatures/confession.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.post("/create", authMiddleware, createConfession);
router.get("/get", authMiddleware, getConfession);
router.post("/like/:confessionId", authMiddleware, likeAndUnlikeConfession);
router.post("/comment/:confessionId", authMiddleware, createConfessionComment);
router.get("/comments/:confessionId", authMiddleware, getConfessionComments);
router.delete("/delete/:confessionId", authMiddleware, deleteConfession);
router.post("/report/:confessionId", authMiddleware, reportConfession);


export default router;