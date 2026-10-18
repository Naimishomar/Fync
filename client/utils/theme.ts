import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';

/** What the user picked in Settings. 'system' follows the phone. */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'fync:theme';

export const loadThemePref = async (): Promise<ThemePref> => {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

/** Applies the theme at once (NativeWind + the C palette via App.tsx) and remembers it. */
export const setThemePref = (pref: ThemePref) => {
  colorScheme.set(pref);
  AsyncStorage.setItem(KEY, pref).catch(() => {});
};
