import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "path";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config({ quiet: true });

// ─── R2 Client ───────────────────────────────────────────────────────────────

let r2Client;

try {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName
  ) {
    throw new Error("Missing or incomplete Cloudflare R2 environment variables");
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  console.log("✅ Cloudflare R2 initialized successfully");
} catch (error) {
  console.error("❌ Cloudflare R2 initialization failed:", error.message);
  process.exit(1);
}

const bucketName = process.env.R2_BUCKET_NAME?.trim();
const publicUrlBase = process.env.R2_PUBLIC_URL?.trim();


export const getR2KeyFromUrl = (url) => {
  try {
    if (!url || typeof url !== "string") return null;
    const parsed = new URL(url);
    let key = parsed.pathname.replace(/^\//, "");
    if (key.startsWith(`${bucketName}/`)) {
      key = key.slice(bucketName.length + 1);
    }
    return key || null;
  } catch {
    return null;
  }
};

export const getR2PublicUrl = (key) => {
  const base = publicUrlBase?.replace(/\/$/, "");
  return `${base}/${key}`;
};

export const uploadToR2 = async (buffer, folder, originalname, mimetype) => {
  let uploadBuffer = buffer;
  let uploadMime = mimetype;
  let uploadExt = path.extname(originalname) || "";

  if (mimetype.startsWith("image/") && mimetype !== "image/gif") {
    try {
      console.log(`🖼️ Optimizing image: ${originalname} (${mimetype})`);
      const optimized = await sharp(buffer)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true }) // Resize to max 1200px width
        .webp({ quality: 80 }) // Convert to WebP for great compression
        .toBuffer();
      
      uploadBuffer = optimized;
      uploadMime = "image/webp";
      uploadExt = ".webp";
      console.log(`✅ Optimization complete: ${originalname} -> WebP, Size: ${buffer.length} -> ${optimized.length}`);
    } catch (err) {
      console.error(`⚠️ Optimization failed for ${originalname}, uploading original:`, err.message);
    }
  }

  const key = `${folder}/${nanoid()}${uploadExt}`;

  try {
    console.log(`🔹 Uploading to R2: Bucket=${bucketName}, Key=${key}, Size=${uploadBuffer.length}`);
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: uploadBuffer,
        ContentType: uploadMime,
        CacheControl: "public, max-age=2592000, stale-while-revalidate=86400", // 30 days cache, 1 day stale grace
      })
    );
    console.log(`✅ Upload success: ${key}`);
  } catch (err) {
    console.error(`❌ R2 Upload Failed Details: Key=${key}, Bucket=${bucketName}`);
    console.error(`❌ Error Code: ${err.code || err.name}, Message: ${err.message}`);
    throw err;
  }

  return getR2PublicUrl(key);
};

/**
 * Delete a file from R2 by its public URL.
 * @param {string} url - Public URL of the file
 */
export const deleteFromR2 = async (url) => {
  try {
    const key = getR2KeyFromUrl(url);
    if (!key) return;

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
  } catch (error) {
    console.error("R2 Delete Error:", error.message);
  }
};

const memoryStorage = multer.memoryStorage();

/** General images + PDFs — 10 MB */
export const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

/** Short video upload — 100 MB */
export const videoUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 100 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "video/mp4");
  },
});

/** Audio upload — 10 MB */
export const audioUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/aac", "video/mp4"];
    cb(null, allowed.includes(file.mimetype));
  },
});

/** College chat / WhatsApp-like — 10 MB, images only */
export const collegeChatUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 10 },
});

/** Mentorship chat — 10 MB */
export const mentorshipUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 10 },
});

/** Resume PDF — 50 MB */
export const resumeUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 50 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

/** Fync Media combined — thumbnail (image) + video — 100 MB */
export const fyncMediaCombinedUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 100 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "video") {
      cb(null, file.mimetype === "video/mp4");
    } else {
      const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
      cb(null, allowed.includes(file.mimetype));
    }
  },
});

/** Funding multi-upload — images + video */
export const fundingUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 100 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "video/mp4"];
    cb(null, allowed.includes(file.mimetype));
  },
});

export { r2Client };
