import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator, Animated, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { Card, Button, IconBtn, IconTile, Num, H2 } from '../ui/kit';

// The stat cards are transparent SVGs: their text must follow the theme or it
// vanishes on the dark card.
const hx = (c: string) => c.replace('#', '');

interface Props {
  username?: string;
  stats?: {
    totalCommits: number;
    totalRepos: number;
    totalStars: number;
    topLanguages: string[];
    contributionStreak: number;
    avatarUrl: string | null;
    bio: string | null;
    lastFetched: string | null;
  };
  isOwner?: boolean;
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
}

const StatItem = ({ label, value, icon, color }: any) => (
  <View className="flex-1 bg-paper-2 p-3 items-center rounded-2xl">
    <Ionicons name={icon} size={18} color={color} />
    <Num style={{ fontSize: 17, lineHeight: 22, marginTop: 4 }}>{String(value)}</Num>
    <Text className="text-ink-3 text-xs font-sans mt-0.5">{label}</Text>
  </View>
);

/** Titled panel holding one remote stats image with a spinner until it loads. */
const Widget = ({ title, uri, height, loading, onLoading, transition, flex }: {
  title: string; uri: string; height: number; loading: boolean; onLoading: (v: boolean) => void; transition: number; flex?: boolean;
}) => (
  <View className="rounded-2xl border border-line overflow-hidden" style={flex ? { flex: 1 } : undefined}>
    <Text className="text-ink-2 text-sm font-semibold px-4 py-3 border-b border-line">{title}</Text>
    <View className="p-3 bg-paper-2 justify-center items-center" style={{ minHeight: height }}>
      {loading ? <View className="absolute z-10"><ActivityIndicator color={C.brand[500]} /></View> : null}
      <ExpoImage
        source={{ uri }}
        style={{ width: '100%', height }}
        contentFit="contain"
        transition={transition}
        onLoadStart={() => onLoading(true)}
        onLoad={() => onLoading(false)}
        onError={() => onLoading(false)}
        accessibilityLabel={`${title} chart`}
      />
    </View>
  </View>
);

export default function GitHubStatsCard({
  username, stats, isOwner, onConnect, onSync, onDisconnect
}: Props) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({
    general: true,
    langs: true,
    streak: true,
  });

  const updateLoading = (key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: isLoading }));
  };

  // Cache-buster for the stat images. Falling back to Date.now() inline gave a
  // new URL on every render, so each parent re-render reloaded all three.
  const [mountedAt] = useState(() => Date.now());
  const bust = stats?.lastFetched ? new Date(stats.lastFetched).getTime() || mountedAt : mountedAt;

  const spinValue = useRef(new Animated.Value(0)).current;
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!onSync || isSyncing) return;
    setIsSyncing(true);
    
    const spinAnim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinAnim.start();

    try {
      await onSync();
    } finally {
      spinAnim.stop();
      spinValue.setValue(0);
      setIsSyncing(false);
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!username && !isOwner) return null;

  if (!username) {
    return (
      <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 20, alignItems: 'center' }}>
        <IconTile icon="logo-github" size={64} iconSize={32} />
        <H2 style={{ textAlign: 'center', marginTop: 12 }}>Connect GitHub</H2>
        <Text className="font-sans text-sm text-ink-3 text-center mt-2 px-4">
          Connect your GitHub to showcase your contributions, streaks, and top languages to recruiters.
        </Text>
        <Button variant="solid" block icon="logo-github" title="Connect GitHub" onPress={onConnect} style={{ marginTop: 20 }} />
      </Card>
    );
  }

  const u = encodeURIComponent(username || '');

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
        <ExpoImage
          source={{ uri: stats?.avatarUrl || `https://github.com/${username}.png` }}
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.paper2 }}
          cachePolicy="memory-disk"
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text className="text-ink font-semibold text-base" numberOfLines={1}>@{username}</Text>
          <Text className="text-ink-3 font-sans text-sm">GitHub</Text>
        </View>
        {isOwner ? (
          <View className="flex-row">
            <Pressable
              onPress={handleSync}
              disabled={isSyncing}
              accessibilityRole="button"
              accessibilityLabel="Sync GitHub stats"
              accessibilityState={{ busy: isSyncing }}
              className="w-11 h-11 items-center justify-center rounded-full active:opacity-85"
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="refresh" size={20} color={C.ink2} />
              </Animated.View>
            </Pressable>
            <IconBtn name="trash-outline" size={18} color={C.danger} onPress={onDisconnect} accessibilityLabel="Disconnect GitHub" />
          </View>
        ) : null}
      </View>

      <View className="flex-row mb-4" style={{ gap: 8 }}>
        <StatItem label="Commits" value={stats?.totalCommits || 0} icon="git-commit-outline" color={C.ink2} />
        <StatItem label="Stars" value={stats?.totalStars || 0} icon="star-outline" color={C.warning} />
        <StatItem label="Streak" value={`${stats?.contributionStreak || 0}d`} icon="flame-outline" color={C.danger} />
      </View>

      {!!stats?.bio && (
        <Text className="text-ink-2 text-sm leading-5 font-sans italic bg-paper-2 p-3 rounded-2xl mb-4">"{stats.bio}"</Text>
      )}

      <View style={{ gap: 12 }}>
        <Widget
          title="Overview"
          height={180}
          transition={500}
          loading={loadingStates.general}
          onLoading={(v) => updateLoading('general', v)}
          uri={`https://github-readme-stats-sigma-five.vercel.app/api?username=${u}&show_icons=true&theme=transparent&hide_border=true&title_color=${hx(C.ink)}&text_color=${hx(C.ink3)}&icon_color=f97316&cache_seconds=1800&t=${bust}`}
        />
        <View className="flex-row" style={{ gap: 12 }}>
          <Widget
            flex
            title="Languages"
            height={150}
            transition={600}
            loading={loadingStates.langs}
            onLoading={(v) => updateLoading('langs', v)}
            uri={`https://github-readme-stats-sigma-five.vercel.app/api/top-langs/?username=${u}&layout=compact&theme=transparent&hide_border=true&title_color=${hx(C.ink)}&text_color=${hx(C.ink3)}&cache_seconds=1800&t=${bust}`}
          />
          <Widget
            flex
            title="Streak"
            height={150}
            transition={700}
            loading={loadingStates.streak}
            onLoading={(v) => updateLoading('streak', v)}
            uri={`https://streak-stats.demolab.com/?user=${u}&theme=transparent&hide_border=true&stroke=00000000&background=00000000&ring=f97316&fire=f97316&currStreakLabel=f97316&currStreakNum=${hx(C.ink)}&sideNums=${hx(C.ink3)}&sideLabels=${hx(C.ink3)}&dates=${hx(C.ink3)}&t=${bust}`}
          />
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-xs text-ink-3 font-sans">
          Updated {stats?.lastFetched ? new Date(stats.lastFetched).toLocaleDateString() : 'just now'}
        </Text>
        <Pressable
          onPress={() => Linking.openURL(`https://github.com/${username}`).catch(() => {})}
          hitSlop={12}
          accessibilityRole="link"
          className="flex-row items-center active:opacity-85"
          style={{ gap: 4 }}
        >
          <Text className="text-accent-text font-semibold text-sm">View profile</Text>
          <Ionicons name="arrow-forward" size={14} color={C.accentText} />
        </Pressable>
      </View>
    </Card>
  );
}
