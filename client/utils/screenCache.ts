import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Last-known content for a screen, so it paints on open instead of on response.
 *
 * The home feed already did this by hand. Profile, the funding feed and the
 * chat list did not: each mounted into a skeleton and sat there for a full
 * network round trip every single time, even when the content had not changed.
 * Reading a small JSON blob out of AsyncStorage is roughly a frame, so the
 * screen is populated before the request has left the device, and the fresh
 * result swaps in underneath when it lands.
 *
 * Cached data is a rendering head start, never the source of truth: the request
 * always goes out, and whatever comes back wins.
 */

/** Bump to invalidate every cached screen at once after a shape change. */
const VERSION = 'v1';

const namespaced = (key: string) => `fync_cache_${VERSION}_${key}`;

export const readCache = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(namespaced(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Corrupt or unreadable cache must never block the screen.
    return null;
  }
};

export const writeCache = (key: string, value: unknown) => {
  // Not awaited by callers: persisting is housekeeping, not part of rendering.
  AsyncStorage.setItem(namespaced(key), JSON.stringify(value)).catch(() => {});
};

export const clearCache = (key: string) => {
  AsyncStorage.removeItem(namespaced(key)).catch(() => {});
};

/** Per-user keys, so a shared device never shows the previous account's data. */
export const userKey = (userId: string | undefined, name: string) =>
  `${name}_${userId ?? 'anon'}`;
