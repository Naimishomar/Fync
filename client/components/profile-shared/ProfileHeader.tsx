/**
 * Blocks shared by the own profile (profile.tsx) and PublicProfile, so the two
 * read as the same screen: banner + avatar hero, stats card, icon tabs, grid
 * cell and the titled about cards.
 */
import React, { memo } from 'react';
import { View, Text, Pressable, Dimensions, type TextStyle, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Reanimated, {
  Extrapolation, interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import Avatar from '../Avatar';
import AvatarZoom from '../ui/AvatarZoom';
import { Card, Num } from '../ui/kit';
import { AnimatedCount } from '../ui/motion';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { ScoreRing } from '../ui-extra/ScoreRing';
import { getFullUrl } from '../../utils/imageUtils';
import { C } from '../../constants/colors';
import { formatCount } from '../../utils/format';

// Warm, brand-adjacent triples: saturated mid-tones so white text and the dark
// scrim read on them in both themes.
const BANNER_PALETTES: [string, string, string][] = [
  ['#F97316', '#FB923C', '#F5B700'],
  ['#EA580C', '#DB2777', '#F472B6'],
  ['#C2410C', '#F97316', '#FDBA74'],
  ['#9A3412', '#EA580C', '#F5B700'],
  ['#7C3AED', '#DB2777', '#F97316'],
  ['#B45309', '#F59E0B', '#FB923C'],
  ['#0F766E', '#0EA5E9', '#F97316'],
  ['#4F46E5', '#7C3AED', '#FB923C'],
];

const hashOf = (str: string) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h >>> 0;
};

/** No banner: a gradient picked from the user's id, so it's stable per person and costs no request. */
export const GeneratedBanner = memo(function GeneratedBanner({ seed }: { seed: string }) {
  const h = hashOf(seed || 'fync');
  const colors = BANNER_PALETTES[h % BANNER_PALETTES.length];
  const tilt = ((h >> 4) % 100) / 100;
  // Two soft discs as a quiet pattern, placed by the hash too.
  const a = 10 + ((h >> 8) % 60), b = 30 + ((h >> 14) % 60);
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <LinearGradient colors={colors} start={{ x: 0, y: tilt }} end={{ x: 1, y: 1 - tilt }} style={{ flex: 1 }} />
      <View className="absolute rounded-full bg-white/10" style={{ width: 260, height: 260, left: `${a}%`, top: -120 }} />
      <View className="absolute rounded-full bg-white/10" style={{ width: 180, height: 180, left: `${b - 40}%`, top: 90 }} />
    </View>
  );
});

// ─── Collapsing header ───────────────────────────────────────────────────────
/** FlashList that takes a Reanimated scroll handler (it exposes getScrollableNode). */
export const AnimatedFlashList = Reanimated.createAnimatedComponent(FlashList) as unknown as typeof FlashList;

/** Scroll offset where the hero's name has gone under the top bar. */
const COLLAPSE_AT = 260;

/**
 * Scroll offset on the UI thread for the hero + compact bar. `onScrollJS`
 * (the tab bar auto-hide) still gets a nativeEvent-shaped payload.
 */
export function useProfileScroll(onScrollJS?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void) {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.value = e.contentOffset.y;
      if (onScrollJS) runOnJS(onScrollJS)({ nativeEvent: { contentOffset: { y: e.contentOffset.y } } } as any);
    },
  }, [onScrollJS]);
  return { y, onScroll };
}

/**
 * Small avatar + name pinned to the top once the hero scrolls out. Display
 * only (pointerEvents none), so it never steals taps from an AppBar over it.
 * `inset`: left padding, to clear a back button.
 */
export function CompactProfileBar({ user, y, inset = 20 }: { user: any; y: SharedValue<number>; inset?: number }) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [COLLAPSE_AT - 40, COLLAPSE_AT], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: reduce ? 0 : interpolate(y.value, [COLLAPSE_AT - 40, COLLAPSE_AT], [-8, 0], Extrapolation.CLAMP) }],
  }));
  return (
    <Reanimated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{
        position: 'absolute', left: 0, right: 0, top: 0, zIndex: 10, paddingTop: insets.top,
        backgroundColor: C.paper, borderBottomWidth: 1, borderBottomColor: C.line,
      }, anim]}
    >
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: inset, paddingRight: 72 }}>
        <Avatar user={user} size={32} />
        <Text className="text-ink font-semibold text-base flex-shrink" numberOfLines={1}>{user?.name || user?.username}</Text>
      </View>
    </Reanimated.View>
  );
}

/** Banner, zoomable avatar, name, handle, bio, college; `children` go under it (stats, actions).
 *  With `scrollY`, the banner drifts + fades and the avatar shrinks as the list scrolls. */
export function ProfileHero({
  user, banner, bio, college, children, scrollY,
}: {
  user: any; banner?: string; bio?: string; college?: string; children?: React.ReactNode;
  scrollY?: SharedValue<number>;
}) {
  const fallback = useSharedValue(0);
  const y = scrollY ?? fallback;
  const reduce = useReducedMotion();
  const bannerAnim = useAnimatedStyle(() => reduce ? {} : {
    opacity: interpolate(y.value, [0, 240], [1, 0.5], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [0, 256], [0, 72], Extrapolation.CLAMP) }],
  });
  const avatarAnim = useAnimatedStyle(() => reduce ? {} : {
    opacity: interpolate(y.value, [120, COLLAPSE_AT], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(y.value, [0, 220], [1, 0.82], Extrapolation.CLAMP) }],
  });
  return (
    <View className="bg-card overflow-hidden">
      <Reanimated.View style={[{ height: 256, width: '100%' }, bannerAnim]}>
        {banner ? (
          <ProgressiveImage path={banner} style={{ width: '100%', height: '100%' }} />
        ) : (
          <GeneratedBanner seed={user?._id || user?.username || user?.name || ''} />
        )}
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.2)']} className="absolute inset-0" />
      </Reanimated.View>

      <View className="items-center pb-6 px-5 bg-paper rounded-t-sheet -mt-12">
        <Reanimated.View style={[{ marginTop: -56 }, avatarAnim]}>
        <AvatarZoom avatar={user?.avatar} className="p-1.5 bg-card rounded-full shadow-hair">
          {typeof user?.fyncScore === 'number' ? (
            <ScoreRing score={user.fyncScore} size={128} stroke={5} level={user.fyncBadge || 'Newcomer'}>
              <View className="rounded-full overflow-hidden">
                <Avatar user={user} size={110} />
              </View>
            </ScoreRing>
          ) : (
            <View className="rounded-full overflow-hidden border-[3px] border-brand-500">
              <Avatar user={user} size={110} />
            </View>
          )}
        </AvatarZoom>
        </Reanimated.View>

        <Text className="font-display text-ink text-h1 text-center mt-4" numberOfLines={2}>{user?.name || user?.username}</Text>
        <Text className="text-accent-text font-semibold text-sm mt-1">@{user?.username}</Text>

        {!!bio?.trim() && (
          <Text className="text-ink-2 text-center mt-3 px-6 text-sm leading-[21px]" numberOfLines={3}>{bio}</Text>
        )}

        {!!college && (
          <View className="flex-row items-center mt-3 px-3 py-1.5 bg-paper-2 rounded-full" style={{ gap: 6, maxWidth: '100%' }}>
            <Ionicons name="school-outline" size={14} color={C.ink2} />
            <Text className="font-medium text-sm text-ink-2 flex-shrink" numberOfLines={1}>{college}</Text>
          </View>
        )}

        {children}
      </View>
    </View>
  );
}

const STAT_NUM: TextStyle = { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, lineHeight: 30, letterSpacing: -0.8, fontVariant: ['tabular-nums'] };

export type Stat = { label: string; value: number | string; onPress?: () => void };

/** Light card of 2-3 numbers split by hairlines. Tappable ones open their list. */
export function StatsCard({ items, style }: { items: Stat[]; style?: any }) {
  return (
    <View className="flex-row w-full bg-card border border-line rounded-2xl mt-5 py-4" style={style}>
      {items.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <View className="w-px self-stretch bg-line my-1" />}
          <Pressable
            className="items-center flex-1 active:opacity-85"
            onPress={s.onPress}
            disabled={!s.onPress}
            accessibilityRole={s.onPress ? 'button' : 'text'}
            accessibilityLabel={`${typeof s.value === 'number' ? formatCount(s.value) : s.value} ${s.label}`}
          >
            {typeof s.value === 'number'
              ? <AnimatedCount value={s.value} style={[STAT_NUM, { color: C.ink }]} />
              : <Num style={STAT_NUM}>{s.value}</Num>}
            <Text className="text-ink-3 text-xs font-medium mt-0.5">{s.label}</Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

export type ProfileTab<K extends string> = { key: K; icon: string; activeIcon: string; label: string };

/** Icon tabs: filled icon + 2px brand underline on the selected one. */
export function ProfileTabs<K extends string>({
  items, value, onChange,
}: { items: ProfileTab<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <View className="flex-row bg-paper border-b border-line px-gutter" accessibilityRole="tablist">
      {items.map((t) => {
        const on = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            className="flex-1 items-center justify-center active:opacity-85"
            style={{ minHeight: 48 }}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
          >
            <Ionicons name={(on ? t.activeIcon : t.icon) as any} size={22} color={on ? C.ink : C.ink3} />
            {on && <View className="absolute bottom-0 h-0.5 w-10 rounded-full bg-brand-500" />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Titled soft card for the About tabs. */
export function ProfileSection({
  title, right, children, style,
}: { title: string; right?: React.ReactNode; children: React.ReactNode; style?: any }) {
  return (
    <Card padded style={[{ marginHorizontal: 20, marginTop: 12 }, style]}>
      <View className="flex-row items-center justify-between mb-3" style={{ gap: 12 }}>
        <Text className="font-semibold text-base text-ink flex-1" accessibilityRole="header">{title}</Text>
        {right}
      </View>
      {children}
    </Card>
  );
}

// ─── Grid cell ───────────────────────────────────────────────────────────────
const COL = Dimensions.get('window').width / 3;

/** One post / short tile. Callbacks get the item back so they can stay stable. */
export const GridCell = memo(function GridCell({
  item, isShort, onOpen, onLongPress,
}: {
  item: any; isShort?: boolean;
  onOpen: (item: any, isShort: boolean) => void;
  onLongPress?: (item: any, isShort: boolean) => void;
}) {
  const short = !!isShort;
  return (
    <Pressable
      onPress={() => onOpen(item, short)}
      onLongPress={onLongPress ? () => onLongPress(item, short) : undefined}
      className="m-[1px] rounded-lg overflow-hidden bg-paper-2 active:opacity-85"
      style={{ width: COL - 2, height: short ? COL * 1.6 : COL - 2 }}
      accessibilityRole="button"
      accessibilityLabel={short ? `Short${item.title ? `: ${item.title}` : ''}` : `Post${item.description ? `: ${String(item.description).slice(0, 60)}` : ''}`}
    >
      {short ? (
        <View className="w-full h-full">
          {/* A still, not a decoder: a <Video> per cell meant a dozen hardware
              decoders. Shorts from before the thumbnail field fall back. */}
          {item.thumbnail ? (
            <ProgressiveImage thumbOnly path={item.thumbnail} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Video source={{ uri: getFullUrl(item.video) || '' }} style={{ width: '100%', height: '100%' }}
              resizeMode={ResizeMode.COVER} shouldPlay={false} positionMillis={100} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} className="absolute inset-0" />
          <View className="absolute bottom-2 left-2 right-2 flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="play" size={12} color="white" />
            <Text className="text-white text-xs font-semibold flex-shrink" numberOfLines={1}>
              {typeof item.views === 'number' ? formatCount(item.views) : item.title}
            </Text>
          </View>
        </View>
      ) : item.image?.length > 0 ? (
        <ProgressiveImage thumbOnly path={item.image[0]} style={{ width: '100%', height: '100%' }} />
      ) : (
        // Text-only post: an empty image source drew a blank tile.
        <View className="w-full h-full items-center justify-center p-3">
          <Text className="text-ink-2 text-xs font-medium text-center" numberOfLines={4}>{item.title || item.description}</Text>
        </View>
      )}
      {!short && item.image?.length > 1 && (
        <View className="absolute top-2 right-2 bg-black/40 p-1 rounded-full" accessibilityLabel={`${item.image.length} images`}>
          <Ionicons name="layers" size={12} color="white" />
        </View>
      )}
    </Pressable>
  );
});
