import express from "express";
import { createConfession, getConfession, likeAndUnlikeConfession, createConfessionComment, getConfessionComments, deleteConfession, reportConfession } from "../controllers/newFeatures/confession.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.post("/create", authMiddleware, createConfession);
router.get("/get", authMiddleware, getConfession);
router.post("/like", authMiddleware, likeAndUnlikeConfession);
router.post("/comment", authMiddleware, createConfessionComment);
router.get("/comments/all", authMiddleware, getConfessionComments);
router.delete("/delete/:confessionId", authMiddleware, deleteConfession);
router.post("/report", authMiddleware, reportConfession);


export default router;