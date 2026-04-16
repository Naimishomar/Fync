import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { postAnnouncements , getannouncements } from "../../controllers/hackathon/announcement.controller.js";
const router = Router();

router.post("/:hackathonId" , authMiddleware , postAnnouncements);
router.get("/:hackathonId",authMiddleware,getannouncements);

export default router;