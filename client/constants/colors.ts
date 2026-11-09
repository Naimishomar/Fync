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
  /** Couples pink for text/icons on cards (readable on paper). */
  pinkInk: '#be185d',
  danger: '#C81E1E',
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
  pinkInk: '#f472b6',
  danger: '#F87171',
  info: '#60A5FA',

  barStyle: 'light-content',
  statusStyle: 'light',
  scrim: 'rgba(0,0,0,0.6)',
};

let current: Palette = light;
let scheme: 'light' | 'dark' = 'light';
let accentKey = 'orange';

/**
 * App accent (user.accentColor, picked in Edit Profile). Orange is the brand and
 * the default; any other key swaps every brand-* token, here and in the CSS
 * variables (accentVars). Keys match constants/profileAccents.ts and the backend enum.
 *
 * 500 is the fill (C.onBrand near-black reads on it at 4.5:1+), 600 the
 * text-safe shade on paper. Dark mode keeps the orange recipe: deep tints for
 * 50-200 and the light end flipped onto 600-900.
 */
const ACCENT_SCALES: Record<string, string[]> = {
  pink: ['#fdf2f8', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#F472B6', '#DB2777', '#be185d', '#9d174d', '#831843'],
  purple: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#A78BFA', '#7C3AED', '#6d28d9', '#5b21b6', '#4c1d95'],
  indigo: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#818CF8', '#4F46E5', '#4338ca', '#3730a3', '#312e81'],
  blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#60A5FA', '#2563EB', '#1d4ed8', '#1e40af', '#1e3a8a'],
  teal: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#2DD4BF', '#0F766E', '#0f766e', '#115e59', '#134e4a'],
  green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#4ADE80', '#15803D', '#15803d', '#166534', '#14532d'],
  gold: ['#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15', '#FACC15', '#A16207', '#a16207', '#854d0e', '#713f12'],
};
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** `a` over the dark paper at `t` opacity, as #rrggbb. */
const tint = (a: string, t: number) => {
  const [r, g, b] = hex(a), [pr, pg, pb] = hex(dark.paper);
  return '#' + [r * t + pr * (1 - t), g * t + pg * (1 - t), b * t + pb * (1 - t)]
    .map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
};

const scaleFor = (key: string, s: 'light' | 'dark'): Palette['brand'] | null => {
  const l = ACCENT_SCALES[key];
  if (!l) return null;
  const c = s === 'dark'
    ? [tint(l[5], 0.12), tint(l[5], 0.16), tint(l[5], 0.28), l[3], l[4], l[5], l[4], l[3], l[2], l[1]]
    : l;
  return Object.fromEntries(STEPS.map((k, i) => [k, c[i]])) as Palette['brand'];
};

const palettes: Record<string, Palette> = {};
const rebuild = () => {
  const base = scheme === 'dark' ? dark : light;
  const brand = scaleFor(accentKey, scheme);
  current = !brand ? base : (palettes[`${scheme}:${accentKey}`] ??= {
    ...base, brand, accent: brand[500], accentText: brand[600],
  });
};

/** Switch the JS palette. App.tsx calls this from the colour scheme before rendering. */
export const setPalette = (s: 'light' | 'dark' | null | undefined) => {
  scheme = s === 'dark' ? 'dark' : 'light';
  rebuild();
};

/** Switch the accent (unknown key = orange). App.tsx calls this from the signed-in user. */
export const setAccent = (key?: string | null) => {
  accentKey = key && ACCENT_SCALES[key] ? key : 'orange';
  rebuild();
};

/** CSS variables for NativeWind's vars(), so brand-* classes follow the accent. null for orange. */
export const accentVars = (): Record<string, string> | null => {
  if (!ACCENT_SCALES[accentKey]) return null;
  const rgb = (h: string) => hex(h).join(' ');
  const v: Record<string, string> = { '--accent-text': rgb(current.accentText) };
  STEPS.forEach((k) => { v[`--brand-${k}`] = rgb(current.brand[k]); });
  return v;
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
 * freeze the palette at import time; this builds one sheet per scheme and accent on first
 * use and hands out the current one, so `s.card` stays a plain property read.
 */
export const themed = <T extends StyleSheet.NamedStyles<T>>(make: () => T): T => {
  const sheets: Record<string, T> = {};
  return new Proxy({} as T, {
    get: (_target, key) => {
      const sheet = (sheets[`${current.scheme}:${current.accent}`] ??= StyleSheet.create(make()));
      return sheet[key as keyof T];
    },
  });
};
