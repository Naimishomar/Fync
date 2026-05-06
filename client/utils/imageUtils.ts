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
