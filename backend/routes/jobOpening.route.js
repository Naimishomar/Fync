import express from "express";
import { 
    createJobOpening, 
    getJobOpenings, 
    deleteJobOpening, 
    addComment, 
    getComments 
} from "../controllers/newFeatures/jobOpening.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", authMiddleware, createJobOpening);
router.get("/get", authMiddleware, getJobOpenings);
router.delete("/delete/:id", authMiddleware, deleteJobOpening);
router.post("/comment/:id", authMiddleware, addComment);
router.get("/comments/:id", authMiddleware, getComments);

export default router;
