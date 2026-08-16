import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
    getSubmissions,
    getMySubmission,
    createSubmission,
    updateSubmission,
    finalizeSubmission,
    addFile,
    uploadSubmissionFile,
    removeFile,
    deleteSubmission,
} from "../../controllers/hackathon/submission.controller.js";
import { upload } from "../../utils/r2.js";
import { r2UploadMiddleware } from "../../utils/r2Upload.js";

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
router.post("/:id/upload", authMiddleware, upload.single("file"), r2UploadMiddleware({ __single__: "hackathon_submissions" }), uploadSubmissionFile);
router.delete("/:id/files/:fileId", authMiddleware, removeFile);

// Delete draft
router.delete("/:id", authMiddleware, deleteSubmission);

export default router;
