import express from "express";
const router = express.Router();
import { authMiddleware } from "../../middlewares/auth.middleware";
import { getSubmissions , getSubmission , createSubmission , getMySubmission , finalizeSubmission , removeFile , deleteSubmission , updateSubmission} from "../../controllers/hackathon/submission.controller";
const{
    getSubmissions,
    getSubmission,
    getMySubmission,
    createSubmission,
    updateSubmission,
    finalizeSubmission,
    addFile,
    removeFile,
    deleteSubmission,
} = require("../controllers/submission.controller");
router.get("/", protect, getSubmissions);
router.get("/my/:hackathonId", protect, getMySubmission);
router.get("/:id", protect, getSubmission);
router.post("/", protect, createSubmission);
router.patch("/:id", protect, updateSubmission);
router.post("/:id/finalize", protect, finalizeSubmission);
router.post("/:id/files", protect, addFile);
router.delete("/:id/files/:fileId", protect, removeFile);
router.delete("/:id", protect, deleteSubmission);

module.exports = router;
