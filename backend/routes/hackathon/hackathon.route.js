import { 
    gethackathon , 
    gethackathons , 
    createHackathon , 
    addjudge , 
    removeJudge , 
    updatestatus ,  
    updatehackathon ,
    deletehackathon ,
    Joinchannel,
    gethackchannels
} from "../../controllers/hackathon/hackathon.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { upload } from "../../utils/r2.js";
import { r2UploadMiddleware } from "../../utils/r2Upload.js";
import {Router} from "express";
const router = Router();

// List hackathons with filters — backend uses req.body so this is a POST
router.post("/list", authMiddleware, gethackathons);

// Get single hackathon by ID
router.get("/:hackathonId", authMiddleware, gethackathon);

// Create hackathon (organizer)
router.post("/", authMiddleware, 
    upload.any(), 
    r2UploadMiddleware({}), // Middleware should be updated to handle any() if possible
    createHackathon
);

// Update hackathon details
router.patch("/:hackathonId", authMiddleware, 
    upload.any(),
    r2UploadMiddleware({}),
    updatehackathon
);

// Delete hackathon (was incorrectly POST, fixed to DELETE)
router.delete("/:hackathonId", authMiddleware, deletehackathon);

// Update status (active / upcoming / judging / completed / draft)
router.patch("/:hackathonId/status", authMiddleware, updatestatus);

// Judges
router.post("/:hackathonId/judge", authMiddleware, addjudge);
router.delete("/:hackathonId/judges/:judgeId", authMiddleware, removeJudge);

// Participant joins channel
router.post("/:hackathonId/join", authMiddleware, Joinchannel);
router.get("/:hackathonId/channel", authMiddleware, gethackchannels);

export default router;
