const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Resolves a potentially relative image/video path into a full URL.
 * Handles null/undefined, absolute URLs, and prepends BACKEND_URL for relative paths.
 */
export const getFullUrl = (path: string | undefined | null) => {
  if (!path) return null;
  
  // If it's already a full URL (http/https or data uri), return it
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }
  
  // Ensure we don't have double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  return `${BACKEND_URL}/${cleanPath}`;
};

/**
 * The small variant of an uploaded image, by convention.
 *
 * uploadToR2 writes a 400px `_sm` twin beside every WebP it stores. Grid cells
 * are a fraction of the full 1200px file's width, so asking for the twin saves
 * most of the bytes and most of the decode.
 *
 * Anything uploaded before that existed has no twin, and non-R2 URLs have no
 * twin either — callers must keep the full URL as an onError fallback.
 */
export const getThumbUrl = (path: string | undefined | null) => {
  const full = getFullUrl(path);
  if (!full) return null;
  return full.replace(/(\.[a-zA-Z0-9]+)(\?.*)?$/, '_sm$1$2');
};
