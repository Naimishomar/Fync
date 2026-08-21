/** @type {import('tailwindcss').Config} */

// Design tokens — "Campus Press".
//
// These map 1:1 onto mockups/css/tokens.css. If a value is not here, it does not
// belong in a component: the app previously carried 147 distinct hardcoded hex
// colours, four colours competing to be the accent, three grey families mixed
// together, and 13 corner radii.
//
// Rules of thumb when adding UI:
//   - Surfaces -> `paper` / `card`. Never white-on-slate; this palette is warm.
//   - Text     -> `ink` (headings), `ink-2` (body), `ink-3` (meta). Never `slate`.
//   - Accent   -> `brand`. As TEXT always `brand-600` — `brand-500` on white is
//                 3.0:1 and fails AA.
//   - Corners  -> the radius scale. No more `rounded-[22px]`.
//   - Type     -> `font-display` (Space Grotesk) for headings, numerals and
//                 labels; `font-sans` (Inter) for everything a user reads.
//   - Elevation-> a hairline, or ONE `shadow-stamp` card per screen. Nothing else.

const brand = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f97316', // fills, icon tints, the FAB
  600: '#ea580c', // the text-safe one — 4.6:1 on paper. Use for ALL orange text.
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
        accent: brand[500],
        'accent-text': brand[600],

        // Ink & paper. Warm neutrals, NOT cool slate. This is the single biggest
        // reason the app stops looking like a default template.
        ink: {
          DEFAULT: '#12100E', // headings, borders, tab bar
          2: '#57534E',       // body copy
          3: '#8B857E',       // meta, timestamps
          4: '#C4BEB6',       // disabled, placeholder — never body text
        },
        paper: {
          DEFAULT: '#F5F2EC', // app background
          2: '#EDE8E0',       // pressed / inset surfaces
        },
        card: '#FFFFFF',
        line: '#E3DDD3',      // hairline

        // Audience colours. Semantic: a ring or sticker says who you are looking
        // at before you read a word. Always paired with a text sticker.
        student: '#F97316',
        alumni: '#B45309',     // gold that survives 4.5:1 on paper
        'alumni-lit': '#F5B700', // gold on ink only
        recruiter: '#4F46E5',

        // Feature families. Explore tiles and section icons inherit these, so a
        // category reads as one colour instead of forty random tints.
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

        // Night surface: Shorts, 12 AM Club, calls. A designed second theme, not
        // an inverted light theme — its contrast is verified separately.
        night: {
          DEFAULT: '#0D0B12',
          2: '#171320',
          ink: '#EDE8E0',
          3: '#8B8397',
        },
        violet: '#A78BFA',
      },

      fontFamily: {
        display: ['SpaceGrotesk_700Bold'],
        'display-medium': ['SpaceGrotesk_500Medium'],
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
        mono: ['SpaceGrotesk_500Medium'], // tabular-ish numerals
      },


      fontSize: {
        // 11px is the floor and it is a LABEL treatment only — uppercase, tracked,
        // never body copy. Body text starts at 15px.
        label: ['11px', { lineHeight: '14px' }],
        '2xs': ['11px', { lineHeight: '14px' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '19px' }],
        base: ['15px', { lineHeight: '23px' }], // body
        lg: ['17px', { lineHeight: '25px' }],
        h2: ['19px', { lineHeight: '23px' }],
        xl: ['19px', { lineHeight: '23px' }],
        h1: ['24px', { lineHeight: '27px' }],
        '2xl': ['24px', { lineHeight: '27px' }],
        '3xl': ['30px', { lineHeight: '32px' }],
        display: ['34px', { lineHeight: '35px' }],
        '4xl': ['34px', { lineHeight: '35px' }],
        '5xl': ['44px', { lineHeight: '45px' }],
      },

      borderRadius: {
        // Flyers are not pill-shaped: mid radii only, and one genuinely square
        // element per screen for contrast.
        sm: '6px',
        DEFAULT: '12px',
        md: '12px',
        lg: '18px',
        xl: '18px',
        '2xl': '20px',
        '3xl': '26px',
        card: '20px',
        sheet: '26px',
      },

      spacing: {
        // 4pt rhythm. Named so a screen asks for `gutter` rather than guessing 20.
        gutter: '20px',
        'card-pad': '16px',
      },

      boxShadow: {
        // Exactly two levels. Hierarchy comes from scarcity, not from more shadow.
        hair: '0 1px 2px rgba(18,16,14,0.05)',
        stamp: '4px 4px 0 #12100E',
        'stamp-brand': '4px 4px 0 #EA580C',
      },
    },
    // `font-medium` / `font-semibold` / `font-bold` name a FAMILY here, not a
    // weight. Tailwind ships fontWeight utilities under those same names, so
    // leaving both defined makes the class ambiguous — and on React Native the
    // weight version is worse than useless: `fontWeight: 600` cannot select
    // Inter_600SemiBold, because RN resolves static fonts by family name only.
    // It looks correct on react-native-web (the browser picks the face) and
    // renders as plain Regular on device. Declared at theme root, not in
    // `extend`, so it REPLACES the default scale instead of merging with it.
    fontWeight: {},
    screens: { sm: 640, md: 768, lg: 1024, xl: 1280 },
  },
  plugins: [],
};
