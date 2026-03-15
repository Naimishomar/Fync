import { Router } from "express";
import { createhackathon , gethackathondetails , getupcominghackathons } from "../../controllers/hackathon/hackathon.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
const router = Router();

router.post("/create", authMiddleware , createhackathon );
router.get("/:hackathonId",authMiddleware , gethackathondetails);
router.get("/" , authMiddleware , getupcominghackathons );

export default router;
