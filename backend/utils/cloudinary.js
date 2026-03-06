import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

let upload;
let videoUpload;
let audioUpload;
let storyUpload;

export const getCloudinaryPublicId = (url) => {
  try {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
    if (matches && matches[1]) {
      return matches[1];
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const deleteFromCloudinary = async (url, resourceType = "image") => {
  try {
    const pubId = getCloudinaryPublicId(url);
    if (pubId) {
      await cloudinary.uploader.destroy(pubId, { resource_type: resourceType });
    }
  } catch (error) {
    console.error(`Cloudinary Delete Error (${resourceType}):`, error.message);
  }
};

try {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Missing Cloudinary environment variables");
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "avatar",
      resource_type: "auto",
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    },
  });

  const videoStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "video",
      resource_type: "video",
      allowed_formats: ["mp4"],
    },
  });

  const audioStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "interviews_audio",
      resource_type: "raw",
      allowed_formats: ["mp3", "m4a", "wav", "aac", "mp4"],
    },
  });

  upload = multer({
    storage: imageStorage,
    limits: { fileSize: 1024 * 1024 * 10 },
  });

  videoUpload = multer({
    storage: videoStorage,
    limits: { fileSize: 1024 * 1024 * 20 },
  });

  audioUpload = multer({
    storage: audioStorage,
    limits: { fileSize: 1024 * 1024 * 10 },
  })
  const storyStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "stories",
      resource_type: "auto",
      allowed_formats: ["jpg", "jpeg", "png", "mp4", "mov"],
    },
  });

  storyUpload = multer({
    storage: storyStorage,
    limits: { fileSize: 1024 * 1024 * 20 }, // 20MB
  });

  console.log("✅ Cloudinary initialized successfully");

} catch (error) {
  console.error("❌ Cloudinary initialization failed:", error.message);
  process.exit(1);
}

export { cloudinary, upload, videoUpload, audioUpload, storyUpload };
