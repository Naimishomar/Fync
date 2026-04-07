import { authMiddleware } from "../../middlewares/auth.middleware";
import { createTeam , getTeam , getTeams , updateteam , DeleteTeam , Invite ,respondToJoinRequest,RespondtoInvite ,requesttoJoin , matchTeams , LeaveMember } from "../../controllers/hackathon/team.controller";
import {Router} from "express";
import { deleteModel } from "mongoose";
import { REDISEARCH_LANGUAGE } from "redis";
const router = Router();

router.get("/",authMiddleware,getTeams);
router.get("/:Id",authMiddleware,getTeam);
router.get("/match/:hackathon",authMiddleware,matchTeams);
router.post("/",authMiddleware,createTeam);
router.patch("/:Id",authMiddleware,updateteam);
router.post("/:Id",authMiddleware,DeleteTeam);

// Invites leader->user
router.post("/:Id/invite",authMiddleware,Invite);
router.post("/:id/invite/respond",authMiddleware,RespondtoInvite);

// Request user -> leader
router.post("/:Id/request",authMiddleware,requesttoJoin);
router.post("/:Id/request/respond",authMiddleware,respondToJoinRequest);

// Leave
router.post("/:Id/leave",authMiddleware, LeaveMember);
export default router;


/* 
### All routes at a glance
| Method | Route | What |
|---|---|---|
| GET | `/api/teams?hackathon=id` | List teams, filter by hackathon |
| GET | `/api/teams/match/:hackathonId` | Jaccard skill match, Redis cached |
| GET | `/api/teams/:id` | Full team detail |
| POST | `/api/teams` | Create team, auto-join as leader |
| PATCH | `/api/teams/:id` | Update team info |
| DELETE | `/api/teams/:id` | Delete team |
| POST | `/api/teams/:id/invite` | Leader invites user → socket push |
| PATCH | `/api/teams/:id/invite/respond` | Accept / decline invite |
| POST | `/api/teams/:id/request` | User requests to join → socket push to leader |
| PATCH | `/api/teams/:id/request/respond` | Leader accepts / declines request |
| POST | `/api/teams/:id/leave` | Member leaves team |
---
### How the two-way flow works
```
Invite flow (leader initiates):
  Leader → POST /invite         → invite saved + socket to user
  User   → PATCH /invite/respond → accepted: added to team + socket to leader
                                   declined: socket to leader
Request flow (user initiates):
  User   → POST /request         → request saved + socket to leader
  Leader → PATCH /request/respond → accepted: added to team + socket to user
                                    declined: socket to user
Matching:
  GET /match/:hackathonId  → Jaccard(userSkills, team.requiredSkills)
                           → top 10 sorted by score
                           → cached in Redis for 5 min per user
*/
