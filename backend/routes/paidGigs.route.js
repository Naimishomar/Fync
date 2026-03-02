import express from "express";
import {createPaidGigs, getPaidGigs, updatePaidGigs, changeGigStatus, deleteGigs, getYourPostedGigs} from "../controllers/paidGigs.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// router.route("/").get(getPaidGigs).post(createPaidGigs);
router.post("/create", authMiddleware, createPaidGigs);
router.get("/", authMiddleware, getPaidGigs);
router.post("/:id/update", authMiddleware, updatePaidGigs);
router.post("/:id/status", authMiddleware, changeGigStatus);
router.delete("/:id", authMiddleware, deleteGigs);
router.get("/your", authMiddleware, getYourPostedGigs);

export default router;