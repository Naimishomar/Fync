import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
    getSpace, createCode, joinCode, unlink, setSince, answer, history,
    addBucket, toggleBucket, deleteBucket, nudge, listNotes, sendNote, markNotesRead,
} from "../controllers/couple.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", getSpace);
router.post("/code", createCode);
router.post("/join", joinCode);
router.delete("/", unlink);
router.patch("/since", setSince);
router.post("/answer", answer);
router.get("/history", history);
router.post("/bucket", addBucket);
router.patch("/bucket/:itemId", toggleBucket);
router.delete("/bucket/:itemId", deleteBucket);
router.post("/nudge", nudge);
router.get("/notes", listNotes);
router.post("/notes", sendNote);
router.post("/notes/read", markNotesRead);

export default router;
