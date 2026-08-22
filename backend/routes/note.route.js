import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createLimiter, feedLimiter } from "../middlewares/rateLimit.middleware.js";
import { notesUpload } from "../utils/r2.js";
import { noteGuard } from "../middlewares/noteGuard.middleware.js";
import { r2UploadMiddleware } from "../utils/r2Upload.js";
import {
  uploadNote, listNotes, unlockNote, myNotes,
  upvoteNote, reportNote, deleteNote,
} from "../controllers/note.controller.js";
import { cacheMiddleware } from "../middlewares/cache.middleware.js";
import { searchStudyMaterial } from "../controllers/studySearch.controller.js";

const router = express.Router();

// createLimiter, not feedLimiter: uploads are the expensive, abusable direction
// and they also pay coins.
router.post(
  "/upload",
  authMiddleware,
  createLimiter,
  notesUpload.single("file"),
  // Between multer and the upload on purpose: a duplicate or an unsafe file is
  // rejected while it is still a buffer, so it never reaches storage.
  noteGuard,
  r2UploadMiddleware({ __single__: "notes" }),
  uploadNote,
);

router.get("/", authMiddleware, feedLimiter, listNotes);
// Academy search. Shared cache: the results for a query are the same for every
// student, and the upstream APIs are the slow part.
router.get("/search", authMiddleware, feedLimiter, cacheMiddleware(1800, { shared: true }), searchStudyMaterial);
router.get("/mine", authMiddleware, myNotes);
// Not cached: the response contains a paid-for file URL and a per-student
// ownership decision, neither of which is safe to serve to somebody else.
router.post("/:id/unlock", authMiddleware, unlockNote);
router.post("/:id/upvote", authMiddleware, upvoteNote);
router.post("/:id/report", authMiddleware, reportNote);
router.delete("/:id", authMiddleware, deleteNote);

export default router;
