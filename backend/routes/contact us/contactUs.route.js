import express from "express";
import { contactUs } from "../../controllers/contact us/contactUs.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { upload } from "../../utils/r2.js";
import { r2UploadMiddleware } from "../../utils/r2Upload.js";

const router = express.Router();

router.post("/", 
    authMiddleware, 
    upload.array("images", 3), 
    r2UploadMiddleware({ images: "contact_us" }), 
    contactUs
);

export default router;