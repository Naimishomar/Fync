import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

let animationStarted = false;

/**
 * Backdrop is set type rather than imagery: a dozen fragments of campus life at
 * a few percent opacity, rotated off-axis so the page reads as printed matter
 * rather than a logo floating in space. Nothing is bundled and nothing is
 * fetched, so the splash renders identically offline and on a cold first launch.
 */
type Phrase = {
  t: string; x: number; y: number; size: number; angle: number; op: number; delay: number;
};

const PHRASES: Phrase[] = [
  { t: 'ATTENDANCE IS 74.6%',        x: -0.06, y: 0.04, size: 20, angle: -8,  op: 0.07, delay: 0 },
  { t: 'placement season begins',    x: 0.46,  y: 0.07, size: 15, angle: 6,   op: 0.05, delay: 40 },
  { t: 'HACKATHON',                  x: 0.08,  y: 0.11, size: 24, angle: 12,  op: 0.08, delay: 80 },
  { t: 'find your team by friday',   x: 0.44,  y: 0.14, size: 14, angle: -14, op: 0.05, delay: 120 },
  { t: 'NOTES · PYQs · SYLLABUS',    x: -0.04, y: 0.18, size: 18, angle: 4,   op: 0.06, delay: 160 },
  { t: 'INTERNSHIP',                 x: 0.55,  y: 0.21, size: 22, angle: 9,   op: 0.06, delay: 200 },
  { t: 'ask an alumnus anything',    x: 0.04,  y: 0.25, size: 15, angle: -6,  op: 0.05, delay: 240 },
  { t: 'ALUMNI NETWORK',             x: 0.42,  y: 0.28, size: 19, angle: 11,  op: 0.06, delay: 280 },
  { t: 'submit before midnight',     x: -0.03, y: 0.32, size: 16, angle: 7,   op: 0.05, delay: 320 },
  { t: 'CONTESTS',                   x: 0.60,  y: 0.35, size: 21, angle: -10, op: 0.07, delay: 360 },
  { t: 'one more commit',            x: 0.10,  y: 0.55, size: 15, angle: -5,  op: 0.05, delay: 400 },
  { t: '12 AM CLUB',                 x: 0.52,  y: 0.57, size: 23, angle: 13,  op: 0.07, delay: 440 },
  { t: 'sell your old cycle',        x: -0.05, y: 0.61, size: 16, angle: 8,   op: 0.05, delay: 480 },
  { t: 'DEADLINES',                  x: 0.46,  y: 0.64, size: 20, angle: -12, op: 0.06, delay: 520 },
  { t: 'lost your id card again',    x: 0.06,  y: 0.68, size: 14, angle: 5,   op: 0.05, delay: 560 },
  { t: 'SEMESTER 6',                 x: 0.56,  y: 0.71, size: 22, angle: -7,  op: 0.06, delay: 600 },
  { t: 'CAMPUS OLX',                 x: -0.02, y: 0.75, size: 19, angle: 10,  op: 0.06, delay: 640 },
  { t: 'build something this week',  x: 0.38,  y: 0.78, size: 15, angle: -9,  op: 0.05, delay: 680 },
  { t: 'STUDY GROUP',                x: 0.02,  y: 0.82, size: 21, angle: 6,   op: 0.06, delay: 720 },
  { t: 'referrals open now',         x: 0.54,  y: 0.85, size: 16, angle: 12,  op: 0.05, delay: 760 },
  { t: 'PAID GIGS',                  x: 0.12,  y: 0.89, size: 20, angle: -11, op: 0.06, delay: 800 },
  { t: 'coffee then class',          x: 0.50,  y: 0.92, size: 15, angle: 4,   op: 0.05, delay: 840 },
];

export default function SplashScreen({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const skip = animationStarted;

  const logo = useRef(new Animated.Value(skip ? 1 : 0)).current;
  const title = useRef(new Animated.Value(skip ? 1 : 0)).current;
  const progress = useRef(new Animated.Value(skip ? 1 : 0)).current;
  // one entrance value per phrase, plus a single shared drift
  const entries = useMemo(() => PHRASES.map(() => new Animated.Value(skip ? 1 : 0)), [skip]);
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animationStarted) {
      animationStarted = true;
      Animated.parallel([
        Animated.spring(logo, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(title, { toValue: 1, duration: 520, delay: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ...entries.map((v, i) =>
          Animated.timing(v, { toValue: 1, duration: 700, delay: PHRASES[i].delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ),
      ]).start();
    }

    // One very slow shared drift: the whole field breathes together rather than
    // fourteen separate loops competing for frames.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();

    const timer = setTimeout(() => navigation?.replace('Tabs'), 2000);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, []);

  return (
    <View className="flex-1 bg-paper">
      <SafeAreaView className="flex-1">
        {/* Type field sits behind everything and never intercepts touches */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          {PHRASES.map((p, i) => (
            <Animated.Text
              key={p.t}
              numberOfLines={1}
              style={{
                position: 'absolute',
                left: width * p.x,
                top: height * p.y,
                fontFamily: 'SpaceGrotesk_700Bold',
                fontSize: p.size,
                letterSpacing: -0.5,
                color: '#12100E',
                opacity: entries[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.op] }),
                transform: [
                  { rotate: `${p.angle}deg` },
                  { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, i % 2 === 0 ? -6 : 6] }) },
                ],
              }}
            >
              {p.t}
            </Animated.Text>
          ))}
        </View>

        {/* zIndex is explicit: the backdrop is absolutely positioned, and without
            it the centre block's stacking against that layer is left to chance. */}
        <View className="flex-1 justify-center items-center px-gutter" style={{ zIndex: 1 }}>
          {/* the one stamped card on this screen */}
          <Animated.View
            style={{
              opacity: logo,
              transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            }}
          >
            {/* Explicit size: the stamp is offset by inset, and negative right/
                bottom insets are only reliable when the parent has a real size. */}
            <View style={{ position: 'relative', width: 112, height: 112 }}>
              <View
                pointerEvents="none"
                style={{ position: 'absolute', left: 4, top: 4, width: 112, height: 112, backgroundColor: '#12100E', borderRadius: 999 }}
              />
              <Animated.Image
                source={require('../assets/Fync.png')}
                style={{ width: 112, height: 112, borderRadius: 999, borderWidth: 2, borderColor: '#12100E', backgroundColor: '#FFFFFF' }}
              />
            </View>
          </Animated.View>

          <Animated.View
            className="items-center mt-7 w-full"
            style={{
              opacity: title,
              transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            }}
          >
            <Text
              className="font-display text-ink uppercase"
              style={{ fontSize: 34, lineHeight: 36, letterSpacing: -1.2, textAlign: 'center', width: '100%' }}
            >
              Fync
            </Text>
            <View className="flex-row items-center mt-2" style={{ gap: 10 }}>
              <View className="bg-ink" style={{ height: 2, width: 20, opacity: 0.82 }} />
              <Text className="font-display text-ink-3 uppercase text-label" style={{ letterSpacing: 1.4 }}>
                Simplifying students life
              </Text>
              <View className="bg-ink" style={{ height: 2, width: 20, opacity: 0.82 }} />
            </View>
          </Animated.View>
        </View>

        {/* Loading rule. scaleX rather than width so it can run on the native
            driver alongside everything else. */}
        <View className="px-gutter pb-10" style={{ zIndex: 1 }}>
          <View className="bg-paper-2 rounded-full overflow-hidden" style={{ height: 4 }}>
            <Animated.View
              className="bg-brand-500"
              style={{
                height: 4,
                width: '100%',
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) },
                ],
              }}
            />
          </View>
          <Text className="font-display text-ink-4 uppercase text-label text-center mt-3" style={{ letterSpacing: 1.4 }}>
            Loading your campus
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
