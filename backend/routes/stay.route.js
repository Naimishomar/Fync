import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createLimiter } from "../middlewares/rateLimit.middleware.js";
import { upload } from "../utils/r2.js";
import { r2UploadMiddleware } from "../utils/r2Upload.js";
import {
    listStays, myStays, getStay, createStay, updateStay, renewStay, deleteStay, reportStay,
} from "../controllers/stay.controller.js";

const router = express.Router();
router.use(authMiddleware);
const photos = [upload.array("photos", 4), r2UploadMiddleware({ photos: "stays" })];

router.get("/", listStays);
router.get("/mine", myStays);
router.post("/", createLimiter, ...photos, createStay);
router.get("/:id", getStay);
router.patch("/:id", ...photos, updateStay);
router.post("/:id/renew", renewStay);
router.post("/:id/report", reportStay);
router.delete("/:id", deleteStay);

export default router;
