import express from "express";
import {
  addComment,
  createFundingPost,
  deleteComment,
  getAllComments,
  getAllProjects,
  likeAndUnlikeProject,
  deleteFundingProject,
  updateProject
} from "../controllers/funding.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import multer from "multer";
import { cloudinary } from "../utils/cloudinary.js";
import CloudinaryStorage from "multer-storage-cloudinary";

const router = express.Router();

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

const cpUpload = upload.fields([
  { name: "image", maxCount: 5 },
  { name: "video", maxCount: 1 },
])

router.post("/create",authMiddleware, cpUpload,createFundingPost);
router.get("/get/all", authMiddleware, getAllProjects);
router.post("/update/:id", authMiddleware, cpUpload, updateProject);
router.post("/like/:id", authMiddleware, likeAndUnlikeProject);
router.post("/comment/add/:id", authMiddleware, addComment);
router.get("/comment/all/:id", authMiddleware, getAllComments);
router.post("/comment/delete/:id", authMiddleware, deleteComment);
router.post("/delete/:id", authMiddleware, deleteFundingProject);

export default router;
