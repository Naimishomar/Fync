import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LeaderboardEntry {
  rank: number;
  submissionId: string;
  score: number;
  projectName: string;
  tagline: string;
  techStack: string[];
  teamName: string;
  status: string;
}

// ─── Rank podium colors ───────────────────────────────────────────────────────
const RANK_CONFIG: Record<number, { gradient: string[]; medal: string; glow: string; text: string }> = {
  1: { gradient: ['#f59e0b', '#d97706'], medal: '🥇', glow: '#fffbeb', text: '#d97706' },
  2: { gradient: ['#94a3b8', '#64748b'], medal: '🥈', glow: '#f8fafc', text: '#64748b' },
  3: { gradient: ['#c2945a', '#a16207'], medal: '🥉', glow: '#fffbeb', text: '#a16207' },
};

// ─── Podium Card (top 3) ──────────────────────────────────────────────────────
const PodiumCard = ({ entry }: { entry: LeaderboardEntry }) => {
  const cfg = RANK_CONFIG[entry.rank];
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      delay: entry.rank * 120,
      tension: 60,
      friction: 8,
    }).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        className="rounded-[32px] mb-6 overflow-hidden border border-gray-100"
        style={{
          backgroundColor: 'white',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        <LinearGradient
          colors={entry.rank === 1 ? ['#000', '#111'] : ['#f8fafc', '#f1f5f9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-6 py-6"
        >
          <View className="flex-row items-center justify-between">
            <View className="w-14 h-14 bg-white/10 rounded-2xl items-center justify-center border border-white/5">
                <Text className="text-4xl">{cfg.medal}</Text>
            </View>
            <View className="items-end">
              <Text className="text-pink-500 text-[10px] font-black uppercase tracking-widest">Protocol Score</Text>
              <Text className={`${entry.rank === 1 ? 'text-white' : 'text-zinc-900'} text-4xl font-black italic tracking-tighter`}>
                {entry.score.toFixed(1)}
              </Text>
            </View>
          </View>
          
          <View className="mt-6">
            <Text className={`${entry.rank === 1 ? 'text-white' : 'text-zinc-900'} text-2xl font-black italic uppercase tracking-tighter leading-7`} numberOfLines={1}>
                {entry.projectName}
            </Text>
            {entry.tagline ? (
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1" numberOfLines={1}>{entry.tagline}</Text>
            ) : null}
          </View>

          <View className="flex-row items-center justify-between mt-6">
            <View className="flex-row items-center bg-zinc-900/10 px-3 py-1.5 rounded-xl">
                <View className="w-5 h-5 rounded-full bg-pink-500 items-center justify-center mr-2">
                    <Ionicons name="people" size={10} color="white" />
                </View>
                <Text className={`${entry.rank === 1 ? 'text-white/80' : 'text-zinc-700'} text-[10px] font-black uppercase tracking-widest`}>{entry.teamName}</Text>
            </View>
            
            <View className="flex-row gap-1.5">
                {entry.techStack?.slice(0, 2).map((t, i) => (
                    <View key={i} className="bg-zinc-500/10 px-2.5 py-1 rounded-lg border border-white/5">
                        <Text className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t}</Text>
                    </View>
                ))}
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
};

// ─── Regular Row ──────────────────────────────────────────────────────────────
const LeaderboardRow = ({ entry, index }: { entry: LeaderboardEntry; index: number }) => {
  const translateX = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, delay: index * 60, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateX }], opacity }}>
      <View
        className="bg-white rounded-[24px] px-5 py-4 mb-3 flex-row items-center border border-gray-100"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 }}
      >
        {/* Rank */}
        <View className="w-12 h-12 rounded-2xl bg-zinc-900 items-center justify-center mr-4 border border-zinc-800 shadow-lg shadow-zinc-900/20">
          <Text className="text-white font-black italic text-lg leading-tight uppercase">#{entry.rank}</Text>
        </View>

        {/* Project info */}
        <View className="flex-1 mr-4">
          <Text className="text-zinc-900 font-black text-base italic uppercase tracking-tighter leading-5" numberOfLines={1}>
            {entry.projectName}
          </Text>
          <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5" numberOfLines={1}>
            {entry.teamName}
          </Text>
        </View>

        {/* Score */}
        <View className="items-end bg-slate-50 px-4 py-2 rounded-2xl border border-gray-100">
          <Text className="text-pink-500 font-black italic text-xl tracking-tighter">{entry.score.toFixed(1)}</Text>
          <Text className="text-slate-300 text-[8px] font-black uppercase tracking-widest -mt-1">PTS</Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const HackathonLeaderboard = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId, hackathonTitle } = route.params ?? {};

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await axios.get(`/hackathon-leaderboard/${hackathonId}`);
      setLeaderboard(res.data.leaderboard ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load leaderboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, []);

  const podium = leaderboard.filter(e => e.rank <= 3);
  const rest = leaderboard.filter(e => e.rank > 3);

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#ec4899" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      {/* Hero Header */}
      <View className="px-8 pt-10 pb-6 bg-white border-b border-slate-50">
          <View className="flex-row items-center justify-between mb-8">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-12 h-12 rounded-[20px] bg-zinc-900 items-center justify-center shadow-lg shadow-zinc-900/20"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onRefresh} className="w-12 h-12 rounded-[20px] bg-slate-50 items-center justify-center border border-gray-100">
              <Ionicons name="refresh" size={20} color="#ec4899" />
            </TouchableOpacity>
          </View>

          <View>
            <Text className="text-zinc-900 text-5xl font-black italic uppercase tracking-tighter leading-[44px]">Leader</Text>
            <Text className="text-zinc-900 text-5xl font-black italic uppercase tracking-tighter leading-[44px]">Board</Text>
            <Text className="text-pink-500 text-[10px] font-black uppercase tracking-widest mt-4" numberOfLines={1}>
                {hackathonTitle ?? 'Fync Protocol Registry'}
            </Text>
          </View>

          {/* Stats row */}
          <View className="flex-row gap-4 mt-8">
            {[
              { label: 'Signals', val: leaderboard.length, icon: 'people' },
              { label: 'Peak Score', val: leaderboard[0]?.score?.toFixed(1) ?? '—', icon: 'flash' },
            ].map((s, i) => (
              <View key={i} className="flex-1 bg-slate-50 rounded-[24px] px-6 py-4 border border-gray-100">
                <Ionicons name={s.icon as any} size={14} color="#ec4899" />
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">{s.label}</Text>
                <Text className="text-zinc-900 font-black italic text-2xl tracking-tighter mt-1">{s.val}</Text>
              </View>
            ))}
          </View>
      </View>

      {leaderboard.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-24 h-24 rounded-[32px] bg-slate-50 items-center justify-center mb-6">
            <Ionicons name="trophy-outline" size={44} color="#CBD5E1" />
          </View>
          <Text className="text-zinc-900 font-black italic text-xl tracking-tighter text-center uppercase mb-1">
            Registry Dark
          </Text>
          <Text className="text-slate-400 text-center font-black text-[10px] uppercase tracking-widest">
            No active signals recorded in the ledger yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={item => item.submissionId}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ec4899']} tintColor="#ec4899" />}
          ListHeaderComponent={() => (
            <View className="mb-8">
              {/* Trophy banner */}
              <View className="flex-row items-center mb-8">
                <View className="flex-1 h-[2px] bg-slate-50" />
                <View className="mx-4 flex-row items-center bg-zinc-900 rounded-2xl px-5 py-2">
                  <Ionicons name="trophy" size={14} color="#ec4899" />
                  <Text className="text-white font-black italic text-[10px] uppercase tracking-widest ml-2">Elite Protocols</Text>
                </View>
                <View className="flex-1 h-[2px] bg-slate-50" />
              </View>

              {podium.map(e => <PodiumCard key={e.submissionId} entry={e} />)}

              {rest.length > 0 && (
                <View className="flex-row items-center my-8">
                  <View className="flex-1 h-[2px] bg-slate-50" />
                  <View className="mx-4 bg-slate-50 px-5 py-2 rounded-2xl border border-gray-100">
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Ranking Fleet</Text>
                  </View>
                  <View className="flex-1 h-[2px] bg-slate-50" />
                </View>
              )}
            </View>
          )}
          renderItem={({ item, index }) => <LeaderboardRow entry={item} index={index} />}
        />
      )}
    </View>
  );
};


export default HackathonLeaderboard;
