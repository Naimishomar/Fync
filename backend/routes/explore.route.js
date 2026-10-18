import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { cacheMiddleware } from "../middlewares/cache.middleware.js";
import { getFeatured } from "../controllers/explore.controller.js";

const router = Router();

// Per-user cache (the default): bootcamps/speakers are college-scoped.
router.get("/featured", authMiddleware, cacheMiddleware(120), getFeatured);

export default router;
