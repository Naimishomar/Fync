import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator, Dimensions, Animated, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

const { width } = Dimensions.get('window');

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
  <View className="flex-1 bg-paper p-4 border border-line items-center rounded-md">
    <View className="bg-card p-2 rounded-xl mb-2 shadow-hair">
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <Text className="text-ink font-display text-lg">{value}</Text>
    <Text className="text-ink-3 text-label font-display uppercase mt-0.5">{label}</Text>
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
      <View className="mx-4 mb-6 bg-card rounded-sheet p-card-pad items-center shadow-hair border border-line">
        <View
          className="w-20 h-20 rounded-card items-center justify-center mb-6 shadow-hair"
         style={{ backgroundColor: '#12100E' }}>
          <Ionicons name="logo-github" size={40} color="#F97316" />
        </View>
        <Text className="text-ink font-display text-xl text-center">Open Source Identity</Text>
        <Text className="font-sans text-sm text-ink-3 text-center mt-3 px-6">
          Connect your GitHub to showcase your contributions, streaks, and top languages to recruiters.
        </Text>
        <Pressable
          onPress={onConnect}
          className="mt-8 bg-ink w-full py-4 flex-row items-center justify-center gap-3 border-2 border-ink rounded-md"
        >
          <Ionicons name="logo-github" size={18} color="white" />
          <Text className="text-white font-display uppercase text-label">Connect GitHub</Text>
        </Pressable>
      </View>
    );
  }


  return (
    <View className="mx-4 mb-6 bg-card rounded-sheet overflow-hidden shadow-hair border border-line">
      {/* Header Profile Section */}
      <View className="p-6 pb-0">
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center gap-4">
            <View className="relative">
              <ExpoImage 
                source={{ uri: stats?.avatarUrl || `https://github.com/${username}.png` }}
                style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#EDE8E0', borderWidth: 2, borderColor: '#F5F2EC' }}
              />
              <View className="absolute -bottom-1 -right-1 bg-ink p-1 rounded-lg border-2 border-white">
                <Ionicons name="logo-github" size={10} color="white" />
              </View>
            </View>
            <View>
              <Text className="text-ink font-display text-lg">@{username}</Text>
              <Text className="text-ink-3 font-semibold text-label uppercase">GitHub Analytics</Text>
            </View>
          </View>
          {isOwner && (
            <View className="flex-row gap-2">
              <Pressable onPress={handleSync} disabled={isSyncing} className="w-10 h-10 bg-paper-2 items-center justify-center rounded-xl border border-line" hitSlop={2}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="refresh" size={18} color="#12100E" />
                </Animated.View>
              </Pressable>
              <Pressable onPress={onDisconnect} className="w-10 h-10 bg-danger/10 items-center justify-center rounded-xl border border-danger/15" hitSlop={2}>
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </Pressable>
            </View>
          )}
        </View>

        {/* Dynamic Stats Row */}
        <View className="flex-row gap-3 mb-4">
          <StatItem label="Commits" value={stats?.totalCommits || 0} icon="git-commit" color="#F97316" />
          <StatItem label="Stars" value={stats?.totalStars || 0} icon="star" color="#B45309" />
          <StatItem label="Streak" value={`${stats?.contributionStreak || 0}d`} icon="flame" color="#DC2626" />
        </View>

        {/* Bio if exists */}
        {stats?.bio && (
          <View className="bg-paper-2 p-4 rounded-card mb-4 border border-line">
            <Text className="text-ink-3 text-label leading-4 font-medium italic">"{stats.bio}"</Text>
          </View>
        )}

        {/* Visual Analytics Section */}
        <View className="mt-6 px-2">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center gap-2">
              <View className="w-1.5 h-5 bg-brand-500 rounded-full" />
              <Text className="text-ink font-display uppercase text-label">Dev Analytics</Text>
            </View>
            <View className="bg-paper-2 px-2.5 py-1 rounded-full">
              <Text className="text-ink-3 font-display text-label uppercase">Real-time Data</Text>
            </View>
          </View>
          
          <View className="gap-5">
            {/* Hero Card: General Performance */}
            <View className="bg-card rounded-sheet border border-line shadow-hair overflow-hidden">
              <View className="flex-row items-center gap-2 px-5 py-4 border-b border-line bg-paper-2/30">
                <Ionicons name="bar-chart" size={14} color="#12100E" />
                <Text className="text-ink font-display uppercase text-label">General Performance</Text>
              </View>
              <View className="p-4 bg-paper-2/50 justify-center items-center relative" style={{ minHeight: 180 }}>
                {loadingStates.general && (
                  <View className="absolute z-10">
                    <ActivityIndicator color="#F97316" />
                  </View>
                )}
                <ExpoImage 
                  source={{ uri: `https://github-readme-stats-sigma-five.vercel.app/api?username=${encodeURIComponent(username || '')}&show_icons=true&theme=transparent&hide_border=true&title_color=18181b&text_color=64748b&icon_color=f97316&cache_seconds=1800&t=${new Date(stats?.lastFetched || Date.now()).getTime()}` }}
                  style={{ width: '100%', height: 180 }}
                  contentFit="contain"
                  transition={500}
                  onLoadStart={() => updateLoading('general', true)}
                  onLoad={() => updateLoading('general', false)}
                />
              </View>
            </View>

            {/* Sub-widgets Grid */}
            <View className="flex-row gap-4">
              {/* Language Distribution */}
              <View className="flex-1 bg-paper rounded-sheet border border-line shadow-hair overflow-hidden">
                <View className="px-4 py-3 border-b border-line bg-paper-2/30 items-center">
                  <Text className="text-ink font-display uppercase text-label">Languages</Text>
                </View>
                <View className="p-3 bg-paper-2/50 justify-center items-center relative" style={{ minHeight: 150 }}>
                  {loadingStates.langs && (
                    <View className="absolute z-10">
                      <ActivityIndicator color="#F97316" />
                    </View>
                  )}
                  <ExpoImage 
                    source={{ uri: `https://github-readme-stats-sigma-five.vercel.app/api/top-langs/?username=${encodeURIComponent(username || '')}&layout=compact&theme=transparent&hide_border=true&title_color=18181b&text_color=64748b&cache_seconds=1800&t=${new Date(stats?.lastFetched || Date.now()).getTime()}` }}
                    style={{ width: '100%', height: 150 }}
                    contentFit="contain"
                    transition={600}
                    onLoadStart={() => updateLoading('langs', true)}
                    onLoad={() => updateLoading('langs', false)}
                  />
                </View>
              </View>

              {/* Momentum / Streak */}
              <View className="flex-1 bg-paper rounded-sheet border border-line shadow-hair overflow-hidden">
                <View className="px-4 py-3 border-b border-line bg-paper-2/30 items-center">
                  <Text className="text-ink font-display uppercase text-label">Momentum</Text>
                </View>
                <View className="p-3 bg-paper-2/50 justify-center items-center relative" style={{ minHeight: 150 }}>
                  {loadingStates.streak && (
                    <View className="absolute z-10">
                      <ActivityIndicator color="#F97316" />
                    </View>
                  )}
                  <ExpoImage 
                    source={{ uri: `https://streak-stats.demolab.com/?user=${encodeURIComponent(username || '')}&theme=transparent&hide_border=true&stroke=00000000&background=00000000&ring=f97316&fire=f97316&currStreakLabel=f97316&sideNums=64748b&sideLabels=64748b&dates=64748b&t=${new Date(stats?.lastFetched || Date.now()).getTime()}` }}
                    style={{ width: '100%', height: 150 }}
                    contentFit="contain"
                    transition={700}
                    onLoadStart={() => updateLoading('streak', true)}
                    onLoad={() => updateLoading('streak', false)}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Footer info */}
        <View className="mt-6 flex-row items-center justify-between pb-6">
          <View className="flex-row items-center gap-2">
            <View className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <Text className="text-label text-ink-3 font-display uppercase">
              Updated {stats?.lastFetched ? new Date(stats.lastFetched).toLocaleDateString() : 'Just now'}
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(`https://github.com/${username}`)}
            className="flex-row items-center gap-1.5"
          >
            <Text className="text-ink font-display uppercase text-label">View Profile</Text>
            <Ionicons name="arrow-forward" size={12} color="#12100E" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
