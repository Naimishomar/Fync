/**
 * The palette, as values.
 *
 * tailwind.config.js already holds these, but a Tailwind class cannot reach a
 * prop — `Ionicons` takes `color`, `ActivityIndicator` takes `color`,
 * `RefreshControl` takes `tintColor`. Those props were filled with literal hex
 * in 2,079 places, which made the token system advisory rather than binding:
 * a brand change meant a find-and-replace, and a dark theme was impossible.
 *
 * Keep this in step with tailwind.config.js. It is the same palette, expressed
 * where JavaScript can see it.
 */
import { StyleSheet } from 'react-native';

export const brand = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#F97316',
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
} as const;

const light = {
  scheme: 'light' as 'light' | 'dark',
  brand: brand as Record<keyof typeof brand, string>,
  accent: brand[500] as string,
  accentText: brand[600] as string,
  /** Text and icons on a brand fill — dark in both themes. */
  onBrand: '#12100E',

  /** Headings, borders, tab bar. */
  ink: '#12100E',
  /** Body copy. */
  ink2: '#57534E',
  /** Meta, timestamps. */
  ink3: '#8B857E',
  /** Disabled, placeholder — never body text. */
  ink4: '#C4BEB6',

  /** App background. */
  paper: '#F5F2EC',
  /** Pressed / inset surfaces. */
  paper2: '#EDE8E0',
  card: '#FFFFFF',
  /** Hairline. */
  line: '#E3DDD3',

  student: '#F97316',
  alumni: '#B45309',
  alumniLit: '#F5B700',
  recruiter: '#4F46E5',

  fam: {
    study: '#7C3AED',
    career: '#2563EB',
    events: '#EA580C',
    social: '#0891B2',
    campus: '#57534E',
    fun: '#DB2777',
  },

  success: '#047857',
  warning: '#B45309',
  danger: '#DC2626',
  info: '#2563EB',

  night: '#0D0B12',
  night2: '#171320',
  nightInk: '#EDE8E0',
  night3: '#8B8397',

  violet: '#A78BFA',
  white: '#FFFFFF',

  /** <StatusBar barStyle> for content drawn on `paper`. */
  barStyle: 'dark-content' as 'dark-content' | 'light-content',
  /** expo-status-bar `style` for content drawn on `paper`. */
  statusStyle: 'dark' as 'dark' | 'light',
  /** Scrim behind sheets and modals. */
  scrim: 'rgba(18,16,14,0.45)',
};

export type Palette = typeof light;

/**
 * Dark theme. Same roles, re-chosen for a dark ground rather than inverted:
 * a deep warm near-black base, surfaces that get LIGHTER as they rise (card
 * above paper), high-contrast text, and the saffron brand kept as the one
 * accent. Orange text uses the lighter 400 shade (7:1 on paper) and the pale
 * brand tints used for chips become deep amber tints.
 */
const dark: Palette = {
  ...light,
  scheme: 'dark',
  brand: {
    50: '#24140A', 100: '#2E180B', 200: '#4A250E', 300: '#fdba74', 400: '#fb923c',
    500: '#F97316', 600: '#fb923c', 700: '#fdba74', 800: '#fed7aa', 900: '#ffedd5',
  },
  accentText: '#fb923c',

  ink: '#F3EFE8',
  ink2: '#C9C2B8',
  ink3: '#979087',
  ink4: '#5C5650',

  paper: '#0F0E0C',
  paper2: '#1D1B18',
  card: '#181614',
  line: '#2C2824',

  alumni: '#F5B700',
  recruiter: '#818CF8',
  fam: {
    study: '#A78BFA',
    career: '#60A5FA',
    events: '#FB923C',
    social: '#22D3EE',
    campus: '#A8A29E',
    fun: '#F472B6',
  },

  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',

  barStyle: 'light-content',
  statusStyle: 'light',
  scrim: 'rgba(0,0,0,0.6)',
};

let current: Palette = light;

/** Switch the JS palette. App.tsx calls this from the colour scheme before rendering. */
export const setPalette = (scheme: 'light' | 'dark' | null | undefined) => {
  current = scheme === 'dark' ? dark : light;
};

/**
 * The live palette. Reads go through to whichever theme is active, so
 * `C.ink` in a render is always the current value. App.tsx remounts the
 * navigator when the scheme changes, so every screen re-reads it.
 */
export const C: Palette = new Proxy(light, {
  get: (_target, key) => current[key as keyof Palette],
}) as Palette;

/**
 * StyleSheet.create for styles that read C.*. A module-level StyleSheet would
 * freeze the palette at import time; this builds one sheet per scheme on first
 * use and hands out the current one, so `s.card` stays a plain property read.
 */
export const themed = <T extends StyleSheet.NamedStyles<T>>(make: () => T): T => {
  const sheets: Partial<Record<'light' | 'dark', T>> = {};
  return new Proxy({} as T, {
    get: (_target, key) => {
      const sheet = (sheets[current.scheme] ??= StyleSheet.create(make()));
      return sheet[key as keyof T];
    },
  });
};
