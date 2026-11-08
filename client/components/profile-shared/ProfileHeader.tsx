/**
 * Blocks shared by the own profile (profile.tsx) and PublicProfile, so the two
 * read as the same screen: banner + avatar hero, stats card, icon tabs, grid
 * cell and the titled about cards.
 */
import React, { memo } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import Avatar from '../Avatar';
import AvatarZoom from '../ui/AvatarZoom';
import { Card } from '../ui/kit';
import { getFullUrl, getThumbUrl } from '../../utils/imageUtils';
import { C } from '../../constants/colors';

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000';

/** Banner, zoomable avatar, name, handle, bio, college; `children` go under it (stats, actions). */
export function ProfileHero({
  user, banner, bio, college, children,
}: {
  user: any; banner?: string; bio?: string; college?: string; children?: React.ReactNode;
}) {
  return (
    <View className="bg-card">
      <View className="h-64 w-full">
        <ExpoImage
          source={{ uri: getFullUrl(banner) || DEFAULT_BANNER }}
          style={{ width: '100%', height: '100%', backgroundColor: C.paper2 }} contentFit="cover" cachePolicy="disk" />
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.2)']} className="absolute inset-0" />
      </View>

      <View className="items-center pb-6 px-5 bg-paper rounded-t-sheet -mt-12">
        <AvatarZoom avatar={user?.avatar} className="-mt-14 p-1.5 bg-card rounded-full shadow-hair">
          <View className="rounded-full overflow-hidden border-[3px] border-brand-500">
            <Avatar user={user} size={110} />
          </View>
        </AvatarZoom>

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

export type Stat = { label: string; value: number | string; onPress?: () => void };

/** Light card of 2-3 numbers split by hairlines. Tappable ones open their list. */
export function StatsCard({ items, style }: { items: Stat[]; style?: any }) {
  return (
    <View className="flex-row w-full bg-card border border-line rounded-2xl mt-5 py-4" style={style}>
      {items.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <View className="w-px self-stretch bg-line my-1" />}
          <Pressable
            className="items-center flex-1 active:opacity-60"
            onPress={s.onPress}
            disabled={!s.onPress}
            accessibilityRole={s.onPress ? 'button' : 'text'}
            accessibilityLabel={`${s.value} ${s.label}`}
          >
            <Text className="text-xl font-display text-ink">{s.value}</Text>
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
            className="flex-1 items-center justify-center active:opacity-60"
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

/** Small variant first, full file only if the twin is missing. */
function GridImage({ path }: { path: string }) {
  const [src, setSrc] = React.useState(getThumbUrl(path) || '');
  return (
    <ExpoImage
      source={{ uri: src }}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      cachePolicy="disk"
      onError={() => { const full = getFullUrl(path); if (full && src !== full) setSrc(full); }}
    />
  );
}

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
      className="m-[1px] rounded-lg overflow-hidden bg-paper-2 active:opacity-80"
      style={{ width: COL - 2, height: short ? COL * 1.6 : COL - 2 }}
      accessibilityRole="button"
      accessibilityLabel={short ? `Short${item.title ? `: ${item.title}` : ''}` : `Post${item.description ? `: ${String(item.description).slice(0, 60)}` : ''}`}
    >
      {short ? (
        <View className="w-full h-full">
          {/* A still, not a decoder: a <Video> per cell meant a dozen hardware
              decoders. Shorts from before the thumbnail field fall back. */}
          {item.thumbnail ? (
            <ExpoImage source={{ uri: getFullUrl(item.thumbnail) || '' }} style={{ width: '100%', height: '100%' }}
              contentFit="cover" cachePolicy="disk" transition={120} />
          ) : (
            <Video source={{ uri: getFullUrl(item.video) || '' }} style={{ width: '100%', height: '100%' }}
              resizeMode={ResizeMode.COVER} shouldPlay={false} positionMillis={100} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} className="absolute inset-0" />
          <View className="absolute bottom-2 left-2 right-2 flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="play" size={12} color="white" />
            <Text className="text-white text-xs font-semibold flex-shrink" numberOfLines={1}>
              {typeof item.views === 'number' ? item.views : item.title}
            </Text>
          </View>
        </View>
      ) : item.image?.length > 0 ? (
        <GridImage path={item.image[0]} />
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
