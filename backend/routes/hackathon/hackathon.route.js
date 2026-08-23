import { 
    gethackathon , 
    gethackathons , 
    getMyHackathons ,
    assignWinners ,
    createHackathon , 
    updatestatus ,  
    updatehackathon ,
    deletehackathon
} from "../../controllers/hackathon/hackathon.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { upload } from "../../utils/r2.js";
import { r2UploadMiddleware } from "../../utils/r2Upload.js";
import {Router} from "express";
const router = Router();

// List hackathons with filters — backend uses req.body so this is a POST
router.post("/list", authMiddleware, gethackathons);

// Hosted by me / won by me — MUST be before /:hackathonId
router.get("/my", authMiddleware, getMyHackathons);

// Get single hackathon by ID
router.get("/:hackathonId", authMiddleware, gethackathon);

// Create listing (host)
router.post("/", authMiddleware, 
    upload.any(), 
    r2UploadMiddleware({}),
    createHackathon
);

// Update listing
router.patch("/:hackathonId", authMiddleware, 
    upload.any(),
    r2UploadMiddleware({}),
    updatehackathon
);

router.delete("/:hackathonId", authMiddleware, deletehackathon);

// Update status (draft / upcoming / active / completed)
router.patch("/:hackathonId/status", authMiddleware, updatestatus);

// Announce / update winners
router.patch("/:hackathonId/winners", authMiddleware, assignWinners);

export default router;
