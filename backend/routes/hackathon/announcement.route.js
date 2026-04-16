import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { 
    postAnnouncements, 
    getannouncements, 
    reactToAnnouncement, 
    pinAnnouncement, 
    markAnnouncementRead 
} from "../../controllers/hackathon/announcement.controller.js";

const router = Router();

router.post("/:hackathonId" , authMiddleware , postAnnouncements);
router.get("/:hackathonId",authMiddleware,getannouncements);

router.patch("/:announcementId/react", authMiddleware, reactToAnnouncement);
router.patch("/:announcementId/pin", authMiddleware, pinAnnouncement);
router.post("/:announcementId/read", authMiddleware, markAnnouncementRead);

export default router;