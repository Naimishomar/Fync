/**
 * Profile accent presets (user.accentColor): a key here or a custom #rrggbb from
 * the Edit Profile palette. The signed-in user's choice recolours the whole app
 * (constants/colors.ts setAccent); a profile wears its owner's choice. Keys match the backend.
 *
 * fill: rings, underline, calendar, primary buttons. All are light enough that
 *   C.onBrand (near-black) reads on them at 4.5:1+, in both themes.
 * text: small accent text on paper/card; a deeper shade in light mode.
 */
import { C, accentRoles } from './colors';

export const PROFILE_ACCENTS = {
  orange: { label: 'Orange', fill: '#F97316', light: '#EA580C', dark: '#FB923C' },
  pink: { label: 'Pink', fill: '#F472B6', light: '#DB2777', dark: '#F472B6' },
  purple: { label: 'Purple', fill: '#A78BFA', light: '#7C3AED', dark: '#A78BFA' },
  indigo: { label: 'Indigo', fill: '#818CF8', light: '#4F46E5', dark: '#818CF8' },
  blue: { label: 'Blue', fill: '#60A5FA', light: '#2563EB', dark: '#60A5FA' },
  teal: { label: 'Teal', fill: '#2DD4BF', light: '#0F766E', dark: '#2DD4BF' },
  green: { label: 'Green', fill: '#4ADE80', light: '#15803D', dark: '#4ADE80' },
  gold: { label: 'Gold', fill: '#FACC15', light: '#A16207', dark: '#FACC15' },
} as const;

export type AccentKey = keyof typeof PROFILE_ACCENTS;
export const ACCENT_KEYS = Object.keys(PROFILE_ACCENTS) as AccentKey[];

/**
 * Read at render (theme-aware). A profile that never picked a colour (missing or
 * the default orange) wears the viewer's app colour, so it never looks off-theme.
 */
export function profileAccent(key?: string | null) {
  const own = key && key !== 'orange' ? accentRoles(key) : null;
  return own ? { ...own, on: C.onBrand } : { fill: C.accent, text: C.accentText, on: C.onBrand };
}
