import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which features this user actually opens, most recent first.
 *
 * Explore owned this list privately, so the home screen could not benefit from
 * it and showed the same fixed grid to everybody. Both read and write the same
 * key now, which means opening something from either place reorders both.
 */
const KEY = 'exploreRecents';
const MAX = 8;

export const readRecentFeatureIds = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    // A corrupt list must never stop a screen rendering; it just means no recents.
    return [];
  }
};

/** Returns the new list so a caller can update state without a second read. */
export const recordFeatureUse = async (id: string): Promise<string[]> => {
  const current = await readRecentFeatureIds();
  const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX);
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return next;
};

export { KEY as RECENT_FEATURES_KEY, MAX as MAX_RECENT_FEATURES };
