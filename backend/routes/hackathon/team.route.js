import {Router} from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { createTeam , joinTeam , totalTeamMembers } from "../../controllers/hackathon/team.controller";
const router = Router();

router.post("/create",authMiddleware,createTeam);
router.get("/join/:teamId",authMiddleware,joinTeam);
router.get("/:teamId/members",authMiddleware,totalTeamMembers);

export default router;

