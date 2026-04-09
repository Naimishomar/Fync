import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
    createTeam,
    getTeam,
    getTeams,
    updateteam,
    DeleteTeam,
    Invite,
    RespondtoInvite,
    requesttoJoin,
    respondToJoinRequest,
    matchTeams,
    LeaveMember
} from "../../controllers/hackathon/team.controller.js";
import { Router } from "express";

const router = Router();

// List teams + skill-match
router.get("/", authMiddleware, getTeams);
router.get("/match/:hackathonId", authMiddleware, matchTeams);
router.get("/:Id", authMiddleware, getTeam);

// Create / Update / Delete
router.post("/", authMiddleware, createTeam);
router.patch("/:Id", authMiddleware, updateteam);
router.delete("/:Id", authMiddleware, DeleteTeam);

// Invite flow: leader → user
router.post("/:Id/invite", authMiddleware, Invite);
router.post("/:Id/invite/respond", authMiddleware, RespondtoInvite);

// Request flow: user → leader
router.post("/:Id/request", authMiddleware, requesttoJoin);
router.post("/:Id/request/respond", authMiddleware, respondToJoinRequest);

// Leave team
router.post("/:Id/leave", authMiddleware, LeaveMember);

export default router;
