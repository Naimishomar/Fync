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
import { fundingUpload } from "../utils/r2.js";
import { r2UploadMiddleware } from "../utils/r2Upload.js";
import multer from "multer";
import { cloudinary } from "../utils/cloudinary.js";
import CloudinaryStorage from "multer-storage-cloudinary";

const router = express.Router();

const cpUpload = fundingUpload.fields([
  { name: "image", maxCount: 5 },
  { name: "video", maxCount: 1 },
]);

const cpUploadToR2 = r2UploadMiddleware({ image: "funding", video: "funding" });

router.post("/create", authMiddleware, cpUpload, cpUploadToR2, createFundingPost);
router.get("/get/all", authMiddleware, getAllProjects);
router.post("/update/:id", authMiddleware, cpUpload, cpUploadToR2, updateProject);
router.post("/like/:id", authMiddleware, likeAndUnlikeProject);
router.post("/comment/add/:id", authMiddleware, addComment);
router.get("/comment/all/:id", authMiddleware, getAllComments);
router.post("/comment/delete/:id", authMiddleware, deleteComment);
router.post("/delete/:id", authMiddleware, deleteFundingProject);

export default router;
