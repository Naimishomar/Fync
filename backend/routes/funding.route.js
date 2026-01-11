import express from "express";
import {
  addComment,
  createFundingPost,
  deleteComment,
  getAllComments,
  getAllProjects,
  likeAndUnlikeProject,
} from "../controllers/funding.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import multer from "multer";
import { cloudinary } from "../utils/cloudinary.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();

/**
 * ✅ SINGLE storage that supports BOTH image + video
 */
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.mimetype.startsWith("video")) {
      return {
        folder: "video",
        resource_type: "video",
        allowed_formats: ["mp4"],
      };
    }
    return {
      folder: "posts",
      allowed_formats: ["jpg", "jpeg", "png"],
    };
  },
});

const upload = multer({ storage });

router.post(
  "/create",
  authMiddleware,
  upload.fields([
    { name: "image", maxCount: 5 },
    { name: "video", maxCount: 1 },
  ]),
  createFundingPost
);

router.get("/get/all", authMiddleware, getAllProjects);
router.post("/like/:id", authMiddleware, likeAndUnlikeProject);
router.post("/comment/add/:id", authMiddleware, addComment);
router.get("/comment/all/:id", authMiddleware, getAllComments);
router.post("/comment/delete/:id", authMiddleware, deleteComment);

export default router;
