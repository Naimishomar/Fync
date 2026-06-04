import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator, Dimensions, Animated, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
      <View className="mx-4 mb-6 bg-white rounded-[32px] p-8 items-center shadow-xl shadow-black/5 border border-slate-100">
        <LinearGradient
          colors={['#18181b', '#27272a']}
          className="w-20 h-20 rounded-[24px] items-center justify-center mb-6 shadow-lg"
        >
          <Ionicons name="logo-github" size={40} color="#f97316" />
        </LinearGradient>
        <Text className="text-zinc-900 font-black text-xl tracking-tighter text-center">Open Source Identity</Text>
        <Text className="text-slate-400 text-[11px] font-medium text-center mt-3 leading-5 px-6 uppercase tracking-wider">
          Connect your GitHub to showcase your contributions, streaks, and top languages to recruiters.
        </Text>
        <Pressable
          onPress={onConnect}
          className="mt-8 bg-zinc-900 w-full py-4 rounded-2xl shadow-lg flex-row items-center justify-center gap-3"
        >
          <Ionicons name="logo-github" size={18} color="white" />
          <Text className="text-white font-black uppercase text-[11px] tracking-widest">Connect GitHub</Text>
        </Pressable>
      </View>
    );
  }

  const StatItem = ({ label, value, icon, color }: any) => (
    <View className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 items-center">
      <View className="bg-white p-2 rounded-xl mb-2 shadow-sm">
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text className="text-zinc-900 font-black text-lg tracking-tighter">{value}</Text>
      <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-0.5">{label}</Text>
    </View>
  );

  return (
    <View className="mx-4 mb-6 bg-white rounded-[32px] overflow-hidden shadow-xl shadow-black/5 border border-slate-100">
      {/* Header Profile Section */}
      <View className="p-6 pb-0">
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center gap-4">
            <View className="relative">
              <ExpoImage 
                source={{ uri: stats?.avatarUrl || `https://github.com/${username}.png` }}
                style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: '#f8fafc' }}
              />
              <View className="absolute -bottom-1 -right-1 bg-zinc-900 p-1 rounded-lg border-2 border-white">
                <Ionicons name="logo-github" size={10} color="white" />
              </View>
            </View>
            <View>
              <Text className="text-zinc-900 font-black text-lg tracking-tight">@{username}</Text>
              <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">GitHub Analytics</Text>
            </View>
          </View>
          {isOwner && (
            <View className="flex-row gap-2">
              <Pressable onPress={handleSync} disabled={isSyncing} className="w-10 h-10 bg-slate-50 items-center justify-center rounded-xl border border-slate-100">
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="refresh" size={18} color="#18181b" />
                </Animated.View>
              </Pressable>
              <Pressable onPress={onDisconnect} className="w-10 h-10 bg-rose-50 items-center justify-center rounded-xl border border-rose-100">
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </Pressable>
            </View>
          )}
        </View>

        {/* Dynamic Stats Row */}
        <View className="flex-row gap-3 mb-4">
          <StatItem label="Commits" value={stats?.totalCommits || 0} icon="git-commit" color="#f97316" />
          <StatItem label="Stars" value={stats?.totalStars || 0} icon="star" color="#fbbf24" />
          <StatItem label="Streak" value={`${stats?.contributionStreak || 0}d`} icon="flame" color="#ef4444" />
        </View>

        {/* Bio if exists */}
        {stats?.bio && (
          <View className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
            <Text className="text-slate-500 text-[11px] leading-4 font-medium italic">"{stats.bio}"</Text>
          </View>
        )}

        {/* Visual Analytics Section */}
        <View className="mt-6 px-2">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center gap-2">
              <View className="w-1.5 h-5 bg-orange-500 rounded-full" />
              <Text className="text-zinc-900 font-black uppercase text-[11px] tracking-widest">Dev Analytics</Text>
            </View>
            <View className="bg-zinc-100 px-2 py-1 rounded-lg">
              <Text className="text-zinc-400 font-black text-[7px] uppercase tracking-widest">Real-time Data</Text>
            </View>
          </View>
          
          <View className="gap-5">
            {/* Hero Card: General Performance */}
            <View className="bg-white rounded-[32px] border border-slate-100 shadow-sm shadow-black/5 overflow-hidden">
              <View className="flex-row items-center gap-2 px-5 py-4 border-b border-slate-50 bg-slate-50/30">
                <Ionicons name="bar-chart" size={14} color="#18181b" />
                <Text className="text-zinc-900 font-black uppercase text-[8px] tracking-widest">General Performance</Text>
              </View>
              <View className="p-4 bg-zinc-50/50 justify-center items-center relative" style={{ minHeight: 180 }}>
                {loadingStates.general && (
                  <View className="absolute z-10">
                    <ActivityIndicator color="#f97316" />
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
              <View className="flex-1 bg-white rounded-[32px] border border-slate-100 shadow-sm shadow-black/5 overflow-hidden">
                <View className="px-4 py-3 border-b border-slate-50 bg-slate-50/30 items-center">
                  <Text className="text-zinc-900 font-black uppercase text-[7px] tracking-widest">Languages</Text>
                </View>
                <View className="p-3 bg-zinc-50/50 justify-center items-center relative" style={{ minHeight: 150 }}>
                  {loadingStates.langs && (
                    <View className="absolute z-10">
                      <ActivityIndicator color="#f97316" />
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
              <View className="flex-1 bg-white rounded-[32px] border border-slate-100 shadow-sm shadow-black/5 overflow-hidden">
                <View className="px-4 py-3 border-b border-slate-50 bg-slate-50/30 items-center">
                  <Text className="text-zinc-900 font-black uppercase text-[7px] tracking-widest">Momentum</Text>
                </View>
                <View className="p-3 bg-zinc-50/50 justify-center items-center relative" style={{ minHeight: 150 }}>
                  {loadingStates.streak && (
                    <View className="absolute z-10">
                      <ActivityIndicator color="#f97316" />
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
            <View className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <Text className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
              Updated {stats?.lastFetched ? new Date(stats.lastFetched).toLocaleDateString() : 'Just now'}
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(`https://github.com/${username}`)}
            className="flex-row items-center gap-1.5"
          >
            <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-widest">View Profile</Text>
            <Ionicons name="arrow-forward" size={12} color="#18181b" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
