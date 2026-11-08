import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
    listPlans, createPlan, getPlan, joinPlan, leavePlan, kickAttendee, cancelPlan, reportPlan,
} from "../controllers/sundayPlan.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", listPlans);
router.post("/", createPlan);
router.get("/:id", getPlan);
router.post("/:id/join", joinPlan);
router.post("/:id/leave", leavePlan);
router.post("/:id/kick", kickAttendee);
router.post("/:id/report", reportPlan);
router.delete("/:id", cancelPlan);

export default router;
