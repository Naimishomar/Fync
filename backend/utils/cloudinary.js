import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";
dotenv.config({quiet: true});
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "avatar",
      allowed_formats: ["jpg", "jpeg", "png"],
      transformation: [
        { width: 1080, height: 1920, crop: "limit" },
        { quality: "auto: best" },
        { fetch_format: "jpg" },
      ],
    },
  });

  const videoStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "video",
      resource_type: "video",
      allowed_formats: ["mp4"],
      transformation: [
        { quality: "auto" },
      ],
    },
  });


const upload = multer({ storage: storage });
const videoUpload = multer({ storage: videoStorage, limits: { fileSize: 1024 * 1024 * 20 } });
export { cloudinary, upload, videoUpload };
