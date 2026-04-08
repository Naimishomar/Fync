import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
    getSubmissions,
    getMySubmission,
    createSubmission,
    updateSubmission,
    finalizeSubmission,
    addFile,
    removeFile,
    deleteSubmission,
} from "../../controllers/hackathon/submission.controller.js";

const router = express.Router();

// All submissions (organiser / judge view)
router.get("/", authMiddleware, getSubmissions);

// My team's submission for a hackathon
router.get("/my/:hackathonId", authMiddleware, getMySubmission);

// Create draft submission
router.post("/", authMiddleware, createSubmission);

// Update draft
router.patch("/:id", authMiddleware, updateSubmission);

// Finalize (lock and submit)
router.post("/:id/finalize", authMiddleware, finalizeSubmission);

// File attachments
router.post("/:id/files", authMiddleware, addFile);
router.delete("/:id/files/:fileId", authMiddleware, removeFile);

// Delete draft
router.delete("/:id", authMiddleware, deleteSubmission);

export default router;
