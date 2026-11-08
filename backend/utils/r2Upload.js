import { uploadToR2 } from "./r2.js";

// Two encodes in flight, not ten: each holds a decoded image in memory, and a
// 10-photo post encoding at once spiked the 1 GiB box. Order is preserved.
const UPLOAD_CONCURRENCY = 2;
export const mapLimit = async (items, limit, fn) => {
  let i = 0;
  const worker = async () => { while (i < items.length) { const n = i++; await fn(items[n]); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

/**
 * Creates an Express middleware that uploads multer memory-buffered files to R2
 * and patches the result back into req.file / req.files so that controllers can
 * keep reading `req.file.path` or `req.files.thumbnail.path` exactly as before.
 *
 * @param {Object} folderMap - Maps field name → R2 folder string.
 *   Use "__single__" as the key when using multer.single().
 *   Example: { thumbnail: "fync_media_thumbnails", video: "fync_media_videos" }
 *   Example: { __single__: "avatar" }
 */
export const r2UploadMiddleware = (folderMap) => async (req, _res, next) => {
  try {
    if (req.file) {
      const folder = folderMap["__single__"] || folderMap[req.file.fieldname] || "uploads";
      const url = await uploadToR2(
        req.file.buffer,
        folder,
        req.file.originalname,
        req.file.mimetype
      );
      req.file.path = url;
      return next();
    }
    // Files go up with bounded concurrency (see UPLOAD_CONCURRENCY). They used
    // to be awaited one at a time, then all at once; two is the middle ground.
    const jobs = [];
    if (req.files && !Array.isArray(req.files)) {
      for (const fieldname of Object.keys(req.files)) {
        const folder = folderMap[fieldname] || "uploads";
        const files = req.files[fieldname];
        if (Array.isArray(files)) for (const file of files) jobs.push([file, folder]);
      }
    } else if (Array.isArray(req.files)) {
      for (const file of req.files) {
        jobs.push([file, folderMap[file.fieldname] || folderMap["__single__"] || "uploads"]);
      }
    }
    await mapLimit(jobs, UPLOAD_CONCURRENCY, async ([file, folder]) => {
      file.path = await uploadToR2(file.buffer, folder, file.originalname, file.mimetype);
    });
    return next();
  } catch (err) {
    console.error("❌ R2 Upload Middleware Error:", err.message);
    return _res.status(500).json({ 
        success: false, 
        message: "File upload failed", 
        error: err.message 
    });
  }
};
