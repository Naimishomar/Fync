import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Linking, Animated, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { Card, Button, IconBtn, IconTile, Num, H2, Tag, TagRow } from '../ui/kit';

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
    <Num style={{ fontSize: 19, lineHeight: 24, marginTop: 4 }}>{String(value)}</Num>
    <Text className="text-ink-3 text-xs font-sans mt-0.5">{label}</Text>
  </View>
);

export default function GitHubStatsCard({
  username, stats, isOwner, onConnect, onSync, onDisconnect
}: Props) {
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
        <StatItem label="Repos" value={stats?.totalRepos || 0} icon="folder-outline" color={C.ink2} />
        <StatItem label="Stars" value={stats?.totalStars || 0} icon="star-outline" color={C.warning} />
        <StatItem label="Streak" value={`${stats?.contributionStreak || 0}d`} icon="flame-outline" color={C.danger} />
      </View>

      {!!stats?.bio && (
        <Text className="text-ink-2 text-sm leading-5 font-sans italic bg-paper-2 p-3 rounded-2xl mb-4">&ldquo;{stats.bio}&rdquo;</Text>
      )}

      {/* Native, from our own synced stats. The third-party readme-stats images
          kept hitting their shared rate limit and showed raw error text. */}
      {stats?.topLanguages?.length ? (
        <View>
          <Text className="text-ink-2 text-sm font-semibold mb-2">Top languages</Text>
          <TagRow>
            {stats.topLanguages.slice(0, 8).map((l) => <Tag key={l} label={l} icon="code-slash-outline" />)}
          </TagRow>
        </View>
      ) : null}

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
