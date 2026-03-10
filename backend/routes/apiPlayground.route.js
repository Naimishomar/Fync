import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
    executeRequest,
    getHistory,
    getResources,
    createResource,
    updateResource,
    patchResource,
    deleteResource
} from "../controllers/apiPlayground.controller.js";

const router = express.Router();

// 1. External Proxy (JSONPlaceholder style)
router.post("/execute", authMiddleware, executeRequest);

// 2. Local Dataset (JSON-Server Style)
// GET /api/playground/posts, GET /api/playground/posts/1
router.get("/:resourceName", authMiddleware, getResources);
router.get("/:resourceName/:id", authMiddleware, getResources);
// POST /api/playground/posts
router.post("/:resourceName", authMiddleware, createResource);
// PUT /api/playground/posts/1
router.put("/:resourceName/:id", authMiddleware, updateResource);
// PATCH /api/playground/posts/1
router.patch("/:resourceName/:id", authMiddleware, patchResource);
// DELETE /api/playground/posts/1
router.delete("/:resourceName/:id", authMiddleware, deleteResource);

// 3. User Logs
router.get("/history", authMiddleware, getHistory);

export default router;
