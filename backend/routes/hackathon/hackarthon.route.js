import { 
    gethackathon , 
    gethackathons , 
    createHackathon , 
    addjudge , 
    removeJudge , 
    updatestatus ,  
    updatehackathon ,
    deletehackathon 
} from "../../controllers/hackathon/hackathon.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {Router} from "express";
const router = Router();

// public anyone can browse 
router.get("/:hackathonId",authMiddleware,gethackathon);
router.get("/",authMiddleware,gethackathons);

// private organiZer only
router.post("/", authMiddleware , createHackathon);
router.patch("/:hackathonId",authMiddleware,updatehackathon);
router.post("/:hackathonId",authMiddleware,deletehackathon);
router.patch("/:hackathonId/status",authMiddleware,updatestatus);
router.post("/:hackathonId/judge",authMiddleware,addjudge);
router.delete("/:hackathon/judges/:judgeId",authMiddleware,removeJudge);

export default router;
