import React from 'react';
import { View, Text, Dimensions, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from './kit';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * The masthead on the login and sign-up screens.
 *
 * Drawn rather than photographed. A stock photo of students says nothing this
 * product does not already say better in its own type, and it costs a network
 * round trip on the one screen that has to render before anyone is signed in —
 * on a bad campus connection that is a blank rectangle where the brand should
 * be. This has nothing to fetch and cannot 404.
 *
 * Built from the design system's own devices: the number stamp, the section
 * rule, the ticker and the tilted stickers.
 */
type Mode = 'login' | 'signup' | 'recruiter' | 'alumni';

const PILLARS: Record<Mode, Array<{ icon: string; label: string }>> = {
  login: [
    { icon: 'people-outline',    label: 'Your campus' },
    { icon: 'briefcase-outline', label: 'Your career' },
    { icon: 'terminal-outline',  label: 'Your craft' },
  ],
  signup: [
    { icon: 'people-outline',    label: 'Your campus' },
    { icon: 'briefcase-outline', label: 'Your career' },
    { icon: 'terminal-outline',  label: 'Your craft' },
  ],
  // Recruiters are not students and should not be sold the student pitch.
  recruiter: [
    { icon: 'shield-checkmark-outline', label: 'Verified' },
    { icon: 'school-outline',           label: 'On campus' },
    { icon: 'send-outline',             label: 'Direct reach' },
  ],
  alumni: [
    { icon: 'people-circle-outline',  label: 'Give back' },
    { icon: 'chatbubbles-outline',    label: 'Mentor' },
    { icon: 'git-network-outline',    label: 'Stay linked' },
  ],
};

const COPY: Record<Mode, { top: string; bottom: string; sub: string; ticker: string; stamp: string; stampSub: string }> = {
  login: {
    top: 'One app', bottom: 'for college',
    sub: 'Everything your campus runs on, in one place.',
    ticker: 'Est. on campus · Students only · Verified by college',
    stamp: '46', stampSub: 'tools',
  },
  signup: {
    top: 'One app', bottom: 'for college',
    sub: 'Notes, placements, contests and the people already doing it.',
    ticker: 'Est. on campus · Students only · Verified by college',
    stamp: '46', stampSub: 'tools',
  },
  recruiter: {
    top: 'Hire from', bottom: 'the source',
    sub: 'Reach verified students before anyone else does.',
    ticker: 'Verified colleges · Real students · No agencies',
    stamp: '1st', stampSub: 'to hire',
  },
  alumni: {
    top: 'Once campus,', bottom: 'always campus',
    sub: 'The juniors you left behind are still asking your questions.',
    ticker: 'Verified alumni · Mentor a junior · Give an hour',
    stamp: '↩', stampSub: 'give back',
  },
};

/**
 * `grow` lets the masthead absorb whatever height the form leaves over.
 *
 * The auth screens are shorter than a tall phone, and that slack has to live
 * somewhere. Left alone it pools under the last line; pushed down with an auto
 * margin it just reopens above the last block. Growing the masthead spends it
 * on the one element that reads as intentional when it is taller, and the cap
 * stops it swallowing the screen on a tablet.
 */
export default function AuthPoster({
  mode = 'login',
  grow = false,
}: {
  mode?: Mode;
  grow?: boolean;
}) {
  const copy = COPY[mode];
  // Top of every auth screen, and none of them add a top inset: the ticker sat
  // under the notch / status bar.
  const insets = useSafeAreaInsets();
  // #4F46E5 is only 3.02:1 on ink, so the recruiter accent is lightened for
  // text and kept at full strength only where it is a solid fill.
  // The dark-surface variants, not the on-paper ones. The audience tokens are
  // tuned for paper: recruiter #4F46E5 is 3.02:1 on ink and alumni #B45309 is
  // 3.78:1 — both under AA. alumniLit is the gold that survives on ink (10.54:1).
  const accent =
    mode === 'recruiter' ? '#A5B4FC'
    : mode === 'alumni'  ? C.alumniLit
    : C.brand;
  const stampBg =
    mode === 'recruiter' ? C.recruiter
    : mode === 'alumni'  ? C.alumniLit
    : C.brand;
  const stampFg = mode === 'recruiter' ? '#FFFFFF' : C.night;

  return (
    <View
      className="overflow-hidden"
      style={[
        {
          backgroundColor: C.night,
          paddingHorizontal: 20,
          paddingTop: 26 + insets.top,
          paddingBottom: 22,
        },
        grow && { flexGrow: 1, maxHeight: SCREEN_HEIGHT * 0.62, justifyContent: 'center' },
      ]}
    >
      {/* Dark masthead: dark status-bar glyphs were invisible on it. */}
      <StatusBar barStyle="light-content" />
      {/* Ticker: the running strip along the top of a Campus Press page. */}
      <View className="flex-row items-center mb-5" style={{ opacity: 0.85 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
        <Text
          className="font-display uppercase ml-2"
          style={{ color: C.nightInk, fontSize: 9, letterSpacing: 1.6 }}
          numberOfLines={1}
        >
          {copy.ticker}
        </Text>
      </View>

      <View className="flex-row items-start">
        <View className="flex-1 pr-3">
          <Text
            className="font-display uppercase"
            style={{ color: '#FFFFFF', fontSize: 40, lineHeight: 40, letterSpacing: -1.8 }}
          >
            {copy.top}
          </Text>
          <Text
            className="font-display uppercase"
            style={{ color: accent, fontSize: 40, lineHeight: 40, letterSpacing: -1.8 }}
          >
            {copy.bottom}
          </Text>

          <Text
            className="font-sans mt-3"
            style={{ color: C.nightInk, fontSize: 13, lineHeight: 19, opacity: 0.9 }}
          >
            {copy.sub}
          </Text>
        </View>

        {/* The number stamp. Rotated on the wrapper so the digits stay upright
            and legible rather than being sheared. */}
        <View style={{ transform: [{ rotate: '3deg' }] }}>
          <View
            className="items-center justify-center"
            style={{
              width: 62, height: 62, borderRadius: 12,
              backgroundColor: stampBg, borderWidth: 2, borderColor: '#FFFFFF',
            }}
          >
            <Text className="font-display" style={{ color: stampFg, fontSize: 22, lineHeight: 24 }}>{copy.stamp}</Text>
            <Text
              className="font-display uppercase"
              style={{ color: stampFg, fontSize: 7, letterSpacing: 0.8 }}
            >
              {copy.stampSub}
            </Text>
          </View>
        </View>
      </View>

      {/* Section rule, drawn against the dark ground rather than reusing the
          light-surface SectionRule from the kit. */}
      <View className="flex-row items-center mt-5 mb-4">
        <View style={{ height: 2, flex: 1, backgroundColor: '#FFFFFF', opacity: 0.18 }} />
      </View>

      <View className="flex-row" style={{ gap: 8 }}>
        {PILLARS[mode].map((p) => (
          <View
            key={p.label}
            className="flex-1 flex-row items-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.16)',
              borderRadius: 12,
              paddingVertical: 9,
              paddingHorizontal: 8,
            }}
          >
            <Ionicons name={p.icon as any} size={13} color={accent} />
            <Text
              className="font-display uppercase ml-1.5"
              style={{ color: C.nightInk, fontSize: 8.5, letterSpacing: 0.4 }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {p.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
