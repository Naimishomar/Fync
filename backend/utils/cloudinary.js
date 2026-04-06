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
let mentorshipUpload;
let resumeUpload;
export const getCloudinaryPublicId = (url, isRaw = false) => {
  try {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
    
    if (isRaw) {
      // Raw files in Cloudinary require the extension in the public_id
      const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)$/i);
      return matches && matches[1] ? matches[1] : null;
    }
    
    // Images/Videos usually exclude the extension in public_id
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
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
    const isRaw = resourceType === "raw";
    const pubId = getCloudinaryPublicId(url, isRaw);
    if (pubId) {
      await cloudinary.uploader.destroy(pubId, { resource_type: resourceType });
      // console.log(`🗑️ Cloudinary: Deleted ${pubId} (${resourceType})`);
    }
  } catch (error) {
    console.error(`Cloudinary Delete Error (${resourceType}):`, error.message);
  }
};

export const uploadToCloudinary = async (file, folder = "fync_events") => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: folder,
      resource_type: "auto",
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary Manual Upload Error:", error);
    throw error;
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
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB for whatsapp-like limits
  });

  mentorshipUpload = multer({
    storage: collegeChatStorage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit as requested
  });

  const resumeStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "resumes",
      resource_type: "raw",
      allowed_formats: ["pdf"],
    },
  });

  resumeUpload = multer({
    storage: resumeStorage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit for resumes
  });

  console.log("✅ Cloudinary initialized successfully");
} catch (error) {
  console.error("❌ Cloudinary initialization failed:", error.message);
  process.exit(1);
}

export { cloudinary, upload, videoUpload, audioUpload, collegeChatUpload, mentorshipUpload, resumeUpload };

