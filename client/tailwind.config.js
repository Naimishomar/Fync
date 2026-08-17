/** @type {import('tailwindcss').Config} */

// Design tokens. Before this file had them, the app carried 147 distinct
// hardcoded hex colours, four colours competing to be the brand accent, three
// different grey families mixed together, and 13 corner radii. Everything below
// exists so a screen can be built without inventing a new value.
//
// Rules of thumb when adding UI:
//   - Accent  -> `brand`. Never reach for pink/indigo/blue as a highlight.
//   - Greys   -> `slate` only. `gray-*` and `zinc-*` are the wrong hue next to it.
//   - Text    -> never below `text-2xs` (11px). See the fontSize block.
//   - Corners -> the radius scale. No more `rounded-[22px]`.

const brand = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f97316', // the accent — already the most-used colour in the app
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
};

module.exports = {
  content: ['./App.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand,
        // Semantic aliases so intent is readable at the call site and a future
        // palette change is one edit rather than a grep.
        accent: brand[500],
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        // Audience role colours. These are genuinely semantic — Avatar.tsx rings
        // and badges users by role — so they survive the accent consolidation.
        alumni: '#ffd700',
        recruiter: '#6366f1',
      },
      fontSize: {
        // 11px is the floor: iOS HIG's minimum legible size. The app previously
        // shipped 1,100+ strings at 10px or below — including post timestamps,
        // college names and author attribution at 8px, and a handful at 6px.
        '2xs': ['11px', { lineHeight: '14px' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '26px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '38px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
      },
      borderRadius: {
        // Replaces rounded-[18px] / [20px] / [22px] / [24px] / [28px] / [32px] /
        // [36px] / [40px], which were used interchangeably for the same kinds of
        // surface.
        sm: '6px',
        DEFAULT: '10px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '28px',
        '4xl': '32px',
        '5xl': '40px',
        card: '22px',
        sheet: '28px',
      },
    },
    screens: {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
  plugins: [],
};
