import { v2 as cloudinary } from "cloudinary";
import  CloudinaryStorage  from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// --------------------
// Upload Variables
// --------------------
let upload;
let videoUpload;
let audioUpload;
let collegeChatUpload;

// --------------------
// Get Cloudinary Public ID from URL
// --------------------
export const getCloudinaryPublicId = (url) => {
  try {
    if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) {
      return null;
    }

    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);

    if (matches && matches[1]) {
      return matches[1];
    }

    return null;
  } catch (error) {
    return null;
  }
};

// --------------------
// Delete File From Cloudinary
// --------------------
export const deleteFromCloudinary = async (url, resourceType = "image") => {
  try {
    const publicId = getCloudinaryPublicId(url);

    if (publicId) {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    }
  } catch (error) {
    console.error(`Cloudinary Delete Error (${resourceType}):`, error.message);
  }
};

// --------------------
// Cloudinary Initialization
// --------------------
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

  // --------------------
  // Image Storage
  // --------------------
  const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "avatar",
      resource_type: "auto",
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    },
  });

  // --------------------
  // Video Storage
  // --------------------
  const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "video",
      resource_type: "video",
      allowed_formats: ["mp4"],
    },
  });

  // --------------------
  // Audio Storage
  // --------------------
  const audioStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "interviews_audio",
      resource_type: "raw",
      allowed_formats: ["mp3", "m4a", "wav", "aac", "mp4"],
    },
  });

  // --------------------
  // Multer Uploads
  // --------------------
  upload = multer({
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  videoUpload = multer({
    storage: videoStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  audioUpload = multer({
    storage: audioStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  // --------------------
  // College Chat Storage
  // --------------------
  const collegeChatStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "college_chats",
      resource_type: "auto",
    },
  });

  collegeChatUpload = multer({
    storage: collegeChatStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  console.log("✅ Cloudinary initialized successfully");
} catch (error) {
  console.error("❌ Cloudinary initialization failed:", error.message);
  process.exit(1);
}

// --------------------
// Export Modules
// --------------------
export { cloudinary, upload, videoUpload, audioUpload, collegeChatUpload };
