import express from "express";
import { contactUs, getContactMessages, deleteContactMessage, toggleContactMessageReadState } from "../../controllers/contactUs/contactUs.controller.js";
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

router.get("/messages", authMiddleware, getContactMessages);
router.patch("/messages/:id/read", authMiddleware, toggleContactMessageReadState);
router.delete("/messages/:id", authMiddleware, deleteContactMessage);

export default router;