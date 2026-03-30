import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { postAnnouncements , getannouncements } from "../../controllers/hackathon/announcment.controller";
const router = Router();

router.post("/:hackathonId" , authMiddleware , postAnnouncements);
router.get("/:hackathonId",authMiddleware,getannouncements);

export default router;