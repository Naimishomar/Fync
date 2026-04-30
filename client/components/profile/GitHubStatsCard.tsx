import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

interface GitHubStats {
  totalCommits?: number;
  totalRepos?: number;
  totalStars?: number;
  topLanguages?: string[];
  contributionStreak?: number;
  lastFetched?: string;
}

interface Props {
  username?: string;
  stats?: GitHubStats;
  isOwner?: boolean;
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6', JavaScript: '#F7DF1E', Python: '#3776AB',
  Java: '#ED8B00', 'C++': '#00599C', Go: '#00ADD8', Rust: '#000000',
  Kotlin: '#7F52FF', Swift: '#FA7343', Dart: '#0175C2', default: '#6B7280',
};

export default function GitHubStatsCard({ username, stats, isOwner, onConnect, onSync, onDisconnect }: Props) {
  if (!username) {
    if (!isOwner) return null;
    return (
      <View className="mx-4 mb-6 bg-zinc-900 rounded-[28px] p-8 border border-zinc-800 shadow-xl shadow-black/20">
        <View className="flex-row items-center gap-4 mb-6">
          <View className="w-14 h-14 bg-white/10 rounded-2xl items-center justify-center shadow-inner">
            <Ionicons name="logo-github" size={28} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-black uppercase text-[15px] tracking-tight">Connect GitHub</Text>
            <Text className="text-zinc-500 font-bold text-[10px] uppercase tracking-wider mt-0.5">Boost your Fync Score (+150 Pts)</Text>
          </View>
        </View>
        <Pressable onPress={onConnect}
          className="bg-white py-4 rounded-2xl items-center shadow-lg shadow-black/10">
          <Text className="text-zinc-900 font-black uppercase text-xs tracking-widest">Connect with GitHub</Text>
        </Pressable>
      </View>
    );
  }

  const lastSync = stats?.lastFetched
    ? new Date(stats.lastFetched).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : 'Never';

  return (
    <View className="mx-4 mb-6 bg-zinc-900 rounded-[28px] overflow-hidden border border-zinc-800 shadow-xl shadow-black/20">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
        <View className="flex-row items-center gap-3">
          <Ionicons name="logo-github" size={20} color="#f97316" />
          <Text className="text-white font-black uppercase text-xs tracking-widest">@{username}</Text>
        </View>
        {isOwner && (
          <View className="flex-row gap-3">
            <Pressable onPress={onSync}
              className="bg-white/10 px-4 py-2 rounded-xl border border-white/5">
              <Text className="text-white text-[8px] font-black uppercase tracking-widest">Sync</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`https://github.com/${username}`)}
              className="bg-white/10 w-9 h-9 items-center justify-center rounded-xl border border-white/5">
              <Feather name="external-link" size={14} color="white" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Stats Grid */}
      <View className="flex-row border-t border-white/5">
        {[
          { label: 'Commits',  value: stats?.totalCommits || 0,           icon: 'git-commit' },
          { label: 'Repos',    value: stats?.totalRepos || 0,             icon: 'package' },
          { label: 'Stars',    value: stats?.totalStars || 0,             icon: 'star' },
          { label: 'Streak',   value: `${stats?.contributionStreak || 0}d`, icon: 'zap' },
        ].map((s, i) => (
          <View key={i} className="flex-1 items-center py-5 border-r border-white/5 last:border-r-0">
            <Text className="text-white font-black text-xl tracking-tighter">{s.value}</Text>
            <Text className="text-zinc-500 font-black uppercase text-[8px] tracking-widest mt-1.5">{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Top Languages */}
      {stats?.topLanguages && stats.topLanguages.length > 0 && (
        <View className="px-6 py-4 border-t border-white/5">
          <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-[2px] mb-3">Top Languages</Text>
          <View className="flex-row flex-wrap gap-2">
            {stats.topLanguages.map((lang, i) => {
              const color = LANG_COLORS[lang] || LANG_COLORS.default;
              return (
                <View key={i} className="flex-row items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl">
                  <View className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                  <Text className="text-zinc-300 font-bold text-[10px] uppercase tracking-wider">{lang}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Footer */}
      <View className="px-6 py-3 border-t border-white/5 flex-row justify-between items-center bg-black/20">
        <Text className="text-zinc-600 font-bold text-[8px] uppercase tracking-widest">Last synced: {lastSync}</Text>
        {isOwner && (
          <Pressable onPress={onDisconnect}>
            <Text className="text-rose-500/60 font-black text-[8px] uppercase tracking-widest">Disconnect</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
