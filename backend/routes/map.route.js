import express from "express";
import { saveLocation, getHeatMap } from "../controllers/newFeatures/map.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/location", authMiddleware, saveLocation);
router.get("/heatmap", authMiddleware, getHeatMap);

export default router;