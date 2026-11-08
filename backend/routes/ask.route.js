import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
    askPage, sendAsk, askCard, inbox, askMe, askSettings, answerAsk, deleteAsk, blockAsk, reportAsk,
} from "../controllers/ask.controller.js";

// "Ask me anything". Fixed paths first so "inbox"/"me"/"card" aren't read as a username.
const router = express.Router();
router.get("/inbox", authMiddleware, inbox);
router.get("/me", authMiddleware, askMe);
router.put("/settings", authMiddleware, askSettings);
router.get("/card/:file", askCard);
router.post("/:id/answer", authMiddleware, answerAsk);
router.post("/:id/block", authMiddleware, blockAsk);
router.post("/:id/report", authMiddleware, reportAsk);
router.delete("/:id", authMiddleware, deleteAsk);
// Public, no auth: the web page anyone with the link opens.
router.get("/:username", askPage);
router.post("/:username", sendAsk);

export default router;
