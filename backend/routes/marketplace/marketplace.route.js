import express from "express";
import { upload } from "../../utils/r2.js";
import { cacheMiddleware } from "../../middlewares/cache.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
    createProduct,
    getProduct,
    updateProduct,
    deleteProduct,
    buyProduct,
    getRedemptions,
    toggleRedemptionStatus,
} from "../../controllers/marketplace/marketplace.controller.js";
const router = express.Router();

router.post("/create", authMiddleware, upload.single("product_image"), createProduct);
router.get("/", authMiddleware, cacheMiddleware(300, { shared: true, tags: ['marketplace'] }), getProduct);
router.put("/:product_id", authMiddleware, updateProduct);
router.delete("/:product_id", authMiddleware, deleteProduct);
router.post("/:product_id/buy", authMiddleware, buyProduct);
router.get("/redemptions", authMiddleware, getRedemptions);
router.post("/toggle-status", authMiddleware, toggleRedemptionStatus);

export default router;