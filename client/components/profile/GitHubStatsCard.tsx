import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
      <View className="mx-4 mb-4 bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <View className="flex-row items-center gap-3 mb-4">
          <View className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center">
            <Ionicons name="logo-github" size={22} color="white" />
          </View>
          <View>
            <Text className="text-white font-bold">Connect GitHub</Text>
            <Text className="text-gray-400 text-xs">Boost your Fync Score by +150 pts</Text>
          </View>
        </View>
        <Pressable onPress={onConnect}
          className="bg-white py-3 rounded-xl items-center">
          <Text className="text-gray-900 font-bold">Connect with GitHub</Text>
        </Pressable>
      </View>
    );
  }

  const lastSync = stats?.lastFetched
    ? new Date(stats.lastFetched).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : 'Never';

  return (
    <View className="mx-4 mb-4 bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="logo-github" size={20} color="white" />
          <Text className="text-white font-bold">@{username}</Text>
        </View>
        {isOwner && (
          <View className="flex-row gap-2">
            <Pressable onPress={onSync}
              className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <Text className="text-white text-xs font-semibold">Sync</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`https://github.com/${username}`)}
              className="bg-white/10 p-1.5 rounded-lg border border-white/10">
              <Ionicons name="open-outline" size={14} color="white" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Stats Grid */}
      <View className="flex-row border-t border-white/10">
        {[
          { label: 'Commits',  value: stats?.totalCommits || 0,           icon: 'git-commit-outline' },
          { label: 'Repos',    value: stats?.totalRepos || 0,             icon: 'file-tray-stacked-outline' },
          { label: '⭐ Stars', value: stats?.totalStars || 0,             icon: 'star-outline' },
          { label: 'Streak',   value: `${stats?.contributionStreak || 0}d`, icon: 'flame-outline' },
        ].map((s, i) => (
          <View key={i} className="flex-1 items-center py-3 border-r border-white/10 last:border-r-0">
            <Text className="text-white font-bold text-base">{s.value}</Text>
            <Text className="text-gray-500 text-[10px] uppercase tracking-wider mt-0.5">{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Top Languages */}
      {stats?.topLanguages && stats.topLanguages.length > 0 && (
        <View className="px-4 py-3 border-t border-white/10">
          <Text className="text-gray-500 text-[10px] font-bold uppercase mb-2">Top Languages</Text>
          <View className="flex-row flex-wrap gap-2">
            {stats.topLanguages.map((lang, i) => {
              const color = LANG_COLORS[lang] || LANG_COLORS.default;
              return (
                <View key={i} className="flex-row items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <Text className="text-gray-300 text-xs">{lang}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Footer */}
      <View className="px-4 py-2 border-t border-white/5 flex-row justify-between">
        <Text className="text-gray-600 text-[10px]">Last synced: {lastSync}</Text>
        {isOwner && (
          <Pressable onPress={onDisconnect}>
            <Text className="text-red-500/70 text-[10px]">Disconnect</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
