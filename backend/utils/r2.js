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
    // Clients get images as <api>/media/<key> (utils/mediaUrl.js) and can send that back.
    if (key.startsWith("media/")) key = key.slice(6);
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

  /**
   * One decode, two outputs.
   *
   * The full-size WebP is what a post or a detail view shows. The `_sm` twin is
   * for grid cells, which are a fraction of 1200px wide and were being handed
   * the whole file.
   *
   * sharp().clone() branches a single decoded image into both encoders. Calling
   * sharp() twice would decode the JPEG twice, and on a burstable instance
   * image work is the thing that drains CPU credits.
   *
   * Objects uploaded before the twin existed have none, which is why the client
   * keeps the full URL as an onError fallback rather than trusting the
   * convention blindly.
   */
  let smallBuffer = null;
  if (mimetype.startsWith("image/") && mimetype !== "image/gif") {
    try {
      const decoded = sharp(buffer).rotate();
      const [full, small] = await Promise.all([
        decoded.clone().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
        decoded.clone().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer(),
      ]);

      uploadBuffer = full;
      smallBuffer = small;
      uploadMime = "image/webp";
      uploadExt = ".webp";
      console.log(`✅ Optimized ${originalname}: ${buffer.length} -> ${full.length} (+${small.length} thumb)`);
    } catch (err) {
      console.error(`⚠️ Optimization failed for ${originalname}, uploading original:`, err.message);
      smallBuffer = null;
    }
  }

  const key = `${folder}/${nanoid()}${uploadExt}`;

  if (smallBuffer) {
    const smallKey = key.replace(/(\.[^.]+)$/, "_sm$1");
    // A missing thumbnail costs bandwidth, not correctness, so it never fails
    // the upload it belongs to.
    await r2Client
      .send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: smallKey,
          Body: smallBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=2592000, stale-while-revalidate=86400",
        })
      )
      .catch((err) => console.error(`⚠️ Thumbnail upload failed for ${key}:`, err.message));
  }

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

    // The `_sm` variant is written by uploadToR2 under a derived key, so it has
    // to be swept here too or it leaks storage forever.
    const smallKey = key.replace(/(\.[^.]+)$/, "_sm$1");
    if (smallKey !== key) {
      await r2Client
        .send(new DeleteObjectCommand({ Bucket: bucketName, Key: smallKey }))
        .catch(() => {});
    }
  } catch (error) {
    console.error("R2 Delete Error:", error.message);
  }
};

// Every upload is buffered in RAM before it reaches R2. On a 1 GiB box that
// makes the per-file limit a hard memory budget, not just a policy: two
// concurrent 100 MB uploads were enough to OOM the process on their own.
//
// The client now compresses images and transcodes video before sending
// (client/utils/mediaUpload.ts), so these ceilings are far above what a normal
// upload actually weighs -- they exist to stop one request eating the heap.
//
// ponytail: streaming straight to R2 would remove the ceiling entirely; that
// means multer-s3 or a presigned direct-to-R2 upload from the device.
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

/** Short video upload — 20 MB limit */
export const videoUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 20 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "video/mp4");
  },
});

/**
 * Short video + its poster frame, in one request — 20 MB.
 *
 * The thumbnail is generated on the device (expo-video-thumbnails), so it
 * arrives as a small JPEG alongside the mp4 rather than costing a server-side
 * transcode.
 */
export const shortsUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 20 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      return cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
    }
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

/** College chat / WhatsApp-like — 20 MB, images/videos/files */
export const collegeChatUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 20 },
});

/** Mentorship chat — 10 MB */
export const mentorshipUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 10 },
});

/** Resume PDF — 50 MB */
export const resumeUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 10 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

/** Study notes / past papers — PDF only, 25 MB */
export const notesUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 25 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

/** Fync Media combined — thumbnail (image) + video — 100 MB */
export const fyncMediaCombinedUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 25 },
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
  limits: { fileSize: 1024 * 1024 * 25 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "video/mp4"];
    cb(null, allowed.includes(file.mimetype));
  },
});

export { r2Client };
