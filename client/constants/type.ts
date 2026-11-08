import type { TextStyle } from 'react-native';

/**
 * The one type scale. kit.tsx (H1/H2/Display/Label/Num, s.*) and the Tailwind
 * fontSize tokens in tailwind.config.js mirror these steps — change all three together.
 *
 *   display  34/40  Space Grotesk  hero numbers / hero titles only   (text-display, text-4xl)
 *   title    24/30  Space Grotesk  screen title                      (text-h1, text-2xl)
 *   subtitle 19/24  Space Grotesk  sub-title, big card title         (text-h2, text-xl)
 *   heading  16/22  Inter 600      section / card / sheet title      (text-lg)
 *   body     15/22  Inter 400      body copy                         (text-base)
 *   sm       13/18  Inter 400/500  meta, secondary copy, labels      (text-sm)
 *   caption  12/16  Inter 500      chips, timestamps                 (text-xs)
 *   micro    11/14  Inter 600      badges / counters only            (text-label, text-2xs)
 *
 * Weights: Inter 400/500/600 only; Space Grotesk 700 only for display/title/subtitle/numbers.
 * Sentence case, no wide tracking (codes/OTP inputs excepted).
 */
export const TYPE = {
  display: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  heading: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  sm: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14 },
} satisfies Record<string, TextStyle>;
