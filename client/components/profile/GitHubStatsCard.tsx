import React from 'react';
import { View, Text, Pressable, Image, Linking, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  username?: string;
  stats?: any;
  isOwner?: boolean;
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
}

export default function GitHubStatsCard({
  username, stats, isOwner, onConnect, onSync, onDisconnect
}: Props) {
  if (!username && !isOwner) return null;

  if (!username) {
    return (
      <View className="mx-4 mb-6 bg-white rounded-[28px] border border-slate-100 p-6 items-center shadow-sm shadow-black/5">
        <View className="bg-zinc-900 p-3 rounded-2xl mb-4">
          <Ionicons name="logo-github" size={32} color="white" />
        </View>
        <Text className="text-zinc-900 font-black uppercase text-[14px] tracking-widest text-center">GitHub Integration</Text>
        <Text className="text-slate-400 text-[10px] font-medium text-center mt-2 leading-4 px-4">
          Connect your GitHub account to showcase your repository stats and top languages on your Fync profile.
        </Text>
        <Pressable 
          onPress={onConnect}
          className="mt-6 bg-zinc-900 px-8 py-3 rounded-2xl shadow-sm"
        >
          <Text className="text-white font-black uppercase text-[10px] tracking-widest">Connect GitHub</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="mx-4 mb-6 bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm shadow-black/5">
      <View className="p-6">
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center gap-3">
            <View className="bg-zinc-900 p-2 rounded-xl">
              <Ionicons name="logo-github" size={20} color="white" />
            </View>
            <View>
              <Text className="text-zinc-900 font-black uppercase text-[12px] tracking-widest">GitHub Stats</Text>
              <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">@{username}</Text>
            </View>
          </View>
          {isOwner && (
            <View className="flex-row gap-2">
              <Pressable onPress={onSync} className="w-9 h-9 bg-slate-50 items-center justify-center rounded-xl border border-slate-100">
                <Ionicons name="refresh" size={16} color="#18181b" />
              </Pressable>
              <Pressable onPress={onDisconnect} className="w-9 h-9 bg-rose-50 items-center justify-center rounded-xl border border-rose-100">
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </Pressable>
            </View>
          )}
        </View>

        <View className="gap-4">
          <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
             <Image 
              source={{ uri: `https://github-readme-stats.vercel.app/api?username=${username}&show_icons=true&theme=transparent&hide_border=true&title_color=18181b&text_color=64748b&icon_color=f97316&bg_color=ffffff` }}
              className="w-full h-44"
              resizeMode="contain"
            />
          </View>
          <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <Image 
              source={{ uri: `https://github-readme-stats.vercel.app/api/top-langs/?username=${username}&layout=compact&theme=transparent&hide_border=true&title_color=18181b&text_color=64748b&bg_color=ffffff` }}
              className="w-full h-36"
              resizeMode="contain"
            />
          </View>
        </View>

        <Pressable 
          onPress={() => Linking.openURL(`https://github.com/${username}`)}
          className="mt-6 flex-row items-center justify-center gap-2 py-4 bg-zinc-900 rounded-2xl"
        >
          <Ionicons name="logo-github" size={16} color="white" />
          <Text className="text-white font-black uppercase text-[10px] tracking-widest">Open GitHub Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}
