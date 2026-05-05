import { uploadToR2 } from "./r2.js";

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
    if (req.files && !Array.isArray(req.files)) {
      for (const fieldname of Object.keys(req.files)) {
        const folder = folderMap[fieldname] || "uploads";
        const files = req.files[fieldname];

        if (Array.isArray(files)) {
          for (const file of files) {
            file.path = await uploadToR2(file.buffer, folder, file.originalname, file.mimetype);
          }
        }
      }
      return next();
    }
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const folder = folderMap[file.fieldname] || folderMap["__single__"] || "uploads";
        file.path = await uploadToR2(file.buffer, folder, file.originalname, file.mimetype);
      }
      return next();
    }
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
