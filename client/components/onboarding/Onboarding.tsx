import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, FlatList } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation, type SharedValue,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { artUrl } from '../../constants/features';
import { Button } from '../ui/kit';
import { tick } from '../ui/motion';

const KEY = 'fync:onboarded';

const SLIDES = [
  { key: 'campus', art: 'assets/Graduation cap/3D/graduation_cap_3d.png', side: 'assets/School/3D/school_3d.png',
    title: 'Your campus, in one app', sub: 'Notes, notices, clubs and the people you study with, all in one place.' },
  { key: 'career', art: 'assets/Rocket/3D/rocket_3d.png', side: 'assets/Briefcase/3D/briefcase_3d.png',
    title: 'Events, jobs and hackathons', sub: 'Find what is happening on campus and the openings that fit you.' },
  { key: 'fun', art: 'assets/Fire/3D/fire_3d.png', side: 'assets/Game die/3D/game_die_3d.png',
    title: 'Games, streaks and stories', sub: 'Keep your streak alive, play with friends and share your day.' },
];
type Slide = (typeof SLIDES)[number];

const Dot = ({ i, x, w }: { i: number; x: SharedValue<number>; w: number }) => {
  const style = useAnimatedStyle(() => {
    const p = interpolate(x.value / w, [i - 1, i, i + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { width: 8 + 16 * p, opacity: 0.35 + 0.65 * p };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: C.brand[500] }, style]} />;
};

function Onboarding({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Slide>>(null);
  const x = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => { x.value = e.contentOffset.x; });
  const next = () => {
    tick();
    if (last) onDone();
    else list.current?.scrollToIndex({ index: index + 1 });
  };

  const renderItem = useCallback(({ item }: { item: Slide }) => (
    <View style={{ width }} className="flex-1 items-center justify-center px-gutter">
      <View style={{ width: 240, height: 240 }} className="items-center justify-center mb-10">
        <Image source={{ uri: artUrl(item.art) }} style={{ width: 200, height: 200 }} contentFit="contain"
          cachePolicy="memory-disk" transition={200} accessible={false} />
        <Image source={{ uri: artUrl(item.side) }}
          style={{ position: 'absolute', right: 0, bottom: 8, width: 76, height: 76, transform: [{ rotate: '12deg' }] }}
          contentFit="contain" cachePolicy="memory-disk" transition={200} accessible={false} />
      </View>
      <Text className="font-display text-ink text-center" style={{ fontSize: 28, lineHeight: 34 }}>{item.title}</Text>
      <Text className="font-sans text-ink-2 text-center mt-3" style={{ fontSize: 15, lineHeight: 22, maxWidth: 320 }}>{item.sub}</Text>
    </View>
  ), [width]);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      {/* Soft brand blobs behind the art. */}
      <LinearGradient colors={[C.brand[200], C.paper]} pointerEvents="none"
        style={{ position: 'absolute', top: -width * 0.35, left: -width * 0.25, width: width * 1.1, height: width * 1.1, borderRadius: width, opacity: 0.7 }} />
      <LinearGradient colors={[C.paper, C.brand[100]]} pointerEvents="none"
        style={{ position: 'absolute', bottom: -width * 0.3, right: -width * 0.4, width: width * 0.9, height: width * 0.9, borderRadius: width, opacity: 0.8 }} />

      <View className="flex-row justify-end px-gutter" style={{ height: 48 }}>
        {!last && (
          <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip intro"
            className="justify-center active:opacity-85">
            <Text className="font-semibold text-ink-2" style={{ fontSize: 15 }}>Skip</Text>
          </Pressable>
        )}
      </View>

      <Animated.FlatList
        ref={list as any}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      />

      <View className="items-center px-gutter" style={{ gap: 24 }}>
        <View className="flex-row" style={{ gap: 8 }} accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => <Dot key={s.key} i={i} x={x} w={width} />)}
        </View>
        <Button variant="primary" block title={last ? 'Get started' : 'Next'} onPress={next} style={{ alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}

/** Shows the welcome slides once, then its children. Renders paper while reading the flag so nothing flashes. */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setSeen(v === '1')).catch(() => setSeen(true));
  }, []);
  const done = useCallback(() => {
    setSeen(true);
    AsyncStorage.setItem(KEY, '1').catch(() => {});
  }, []);
  if (seen === null) return <View className="flex-1 bg-paper" />;
  return seen ? <>{children}</> : <Onboarding onDone={done} />;
}
