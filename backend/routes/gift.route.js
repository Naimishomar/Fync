import express from "express";
import { authMiddleware, isAdmin } from "../middlewares/auth.middleware.js";
import { upload, printPhotoUpload } from "../utils/r2.js";
import { r2UploadMiddleware } from "../utils/r2Upload.js";
import {
  listProducts, getProduct, uploadPhotos, uploadPrintPhoto, createGiftOrder, myGiftOrders,
  adminListProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct, adminListOrders, adminUpdateOrder,
} from "../controllers/gift.controller.js";

const router = express.Router();

/** multer's size/count errors as a 400 instead of a 500. */
const photos = (req, res, next) =>
  upload.array("photos", 10)(req, res, (err) =>
    err ? res.status(400).json({ success: false, message: "Up to 10 photos per upload, each under 10 MB." }) : next());

router.get("/products", authMiddleware, listProducts);
router.get("/products/:id", authMiddleware, getProduct);
router.post("/upload", authMiddleware, photos, r2UploadMiddleware({ photos: "gift_photos" }), uploadPhotos);
// Customer photos for printing: one file per request, stored at full resolution.
router.post("/upload/original", authMiddleware, (req, res, next) =>
  printPhotoUpload.single("photo")(req, res, (err) =>
    err ? res.status(400).json({ success: false, message: "One JPG, PNG, WebP or HEIC photo under 25 MB." }) : next()),
  uploadPrintPhoto);
router.post("/orders", authMiddleware, createGiftOrder);
router.get("/orders/mine", authMiddleware, myGiftOrders);

router.get("/admin/products", authMiddleware, isAdmin, adminListProducts);
router.post("/admin/products", authMiddleware, isAdmin, adminCreateProduct);
router.patch("/admin/products/:id", authMiddleware, isAdmin, adminUpdateProduct);
router.delete("/admin/products/:id", authMiddleware, isAdmin, adminDeleteProduct);
router.get("/admin/orders", authMiddleware, isAdmin, adminListOrders);
router.patch("/admin/orders/:id", authMiddleware, isAdmin, adminUpdateOrder);

export default router;
