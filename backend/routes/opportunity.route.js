import { 
    createOpportunity, 
    getOpportunities, 
    deleteOpportunity,
    applyToOpportunity,
    getRecruiterPosts,
    getRecruiterApplications,
    updateApplicationStatus
} from "../controllers/opportunity.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import express from "express";

const router = express.Router();

// General
router.get("/list", authMiddleware, getOpportunities);
router.post("/apply/:id", authMiddleware, applyToOpportunity);

// Recruiter/Admin Only
router.post("/create", authMiddleware, createOpportunity);
router.delete("/delete/:id", authMiddleware, deleteOpportunity);
router.get("/recruiter/posts", authMiddleware, getRecruiterPosts);
router.get("/recruiter/applications", authMiddleware, getRecruiterApplications);
router.patch("/recruiter/application-status/:id", authMiddleware, updateApplicationStatus);

export default router;
