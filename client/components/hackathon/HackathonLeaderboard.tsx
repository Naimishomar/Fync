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
const RANK_CONFIG: Record<number, { gradient: string[]; medal: string; glow: string }> = {
  1: { gradient: ['#f59e0b', '#d97706'], medal: '🥇', glow: '#fef3c7' },
  2: { gradient: ['#94a3b8', '#64748b'], medal: '🥈', glow: '#f1f5f9' },
  3: { gradient: ['#c2945a', '#a16207'], medal: '🥉', glow: '#fef9c3' },
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
        className="rounded-3xl mb-4 overflow-hidden"
        style={{
          backgroundColor: cfg.glow,
          shadowColor: cfg.gradient[0],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <LinearGradient
          colors={cfg.gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-5 py-4"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-4xl">{cfg.medal}</Text>
            <View className="items-end">
              <Text className="text-white/70 text-[10px] font-black uppercase tracking-widest">Score</Text>
              <Text className="text-white text-3xl font-black">{entry.score.toFixed(2)}</Text>
            </View>
          </View>
          <Text className="text-white text-lg font-black italic mt-2 leading-6" numberOfLines={1}>
            {entry.projectName}
          </Text>
          {entry.tagline ? (
            <Text className="text-white/70 text-xs mt-0.5" numberOfLines={1}>{entry.tagline}</Text>
          ) : null}
          <View className="flex-row items-center mt-3">
            <View className="w-5 h-5 rounded-full bg-white/20 items-center justify-center mr-1.5">
              <Ionicons name="people" size={10} color="white" />
            </View>
            <Text className="text-white/90 text-xs font-black">{entry.teamName}</Text>
          </View>
        </LinearGradient>

        {/* Tech stack */}
        {entry.techStack?.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 px-5 py-3">
            {entry.techStack.slice(0, 4).map((t, i) => (
              <View key={i} className="bg-white/60 rounded-lg px-2.5 py-1">
                <Text className="text-[10px] font-black text-slate-700">{t}</Text>
              </View>
            ))}
          </View>
        )}
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
        className="bg-white rounded-2xl px-4 py-3.5 mb-2.5 flex-row items-center border border-slate-100"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}
      >
        {/* Rank */}
        <View className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center mr-3">
          <Text className="text-slate-600 font-black text-base">#{entry.rank}</Text>
        </View>

        {/* Project info */}
        <View className="flex-1 mr-3">
          <Text className="text-zinc-900 font-black text-sm italic leading-5" numberOfLines={1}>
            {entry.projectName}
          </Text>
          <Text className="text-slate-400 text-[11px] font-semibold mt-0.5" numberOfLines={1}>
            {entry.teamName}
          </Text>
          {entry.techStack?.length > 0 && (
            <View className="flex-row gap-1.5 mt-1.5 flex-wrap">
              {entry.techStack.slice(0, 3).map((t, i) => (
                <View key={i} className="bg-indigo-50 rounded-md px-1.5 py-0.5">
                  <Text className="text-indigo-500 text-[9px] font-black">{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Score */}
        <View className="items-end">
          <Text className="text-indigo-600 font-black text-lg">{entry.score.toFixed(2)}</Text>
          <Text className="text-slate-300 text-[10px] font-semibold">pts</Text>
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
      const res = await axios.get(`/leaderboard/${hackathonId}`);
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
      <View className="flex-1 bg-[#F8FAFC] items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="light-content" />

      {/* Hero Header */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4338ca']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="pb-6 pt-2"
      >
        <SafeAreaView>
          <View className="flex-row items-center px-5 pt-2 mb-5">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-2xl bg-white/10 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-xl font-black italic tracking-tight">Leaderboard</Text>
              <Text className="text-indigo-300 text-[10px] font-black uppercase tracking-widest" numberOfLines={1}>
                {hackathonTitle ?? 'Hackathon'}
              </Text>
            </View>
            <TouchableOpacity onPress={onRefresh} className="w-10 h-10 rounded-2xl bg-white/10 items-center justify-center">
              <Ionicons name="refresh" size={18} color="white" />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View className="flex-row px-5 gap-4">
            {[
              { label: 'Total Teams', val: leaderboard.length, icon: 'people' },
              { label: 'Top Score', val: leaderboard[0]?.score?.toFixed(2) ?? '—', icon: 'trophy' },
            ].map((s, i) => (
              <View key={i} className="flex-1 bg-white/10 rounded-2xl px-4 py-3 border border-white/10">
                <Ionicons name={s.icon as any} size={14} color="rgba(255,255,255,0.6)" />
                <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1">{s.label}</Text>
                <Text className="text-white font-black text-lg">{s.val}</Text>
              </View>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {leaderboard.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <LinearGradient colors={['#ede9fe', '#fce7f3']} className="w-24 h-24 rounded-[32px] items-center justify-center mb-5">
            <Ionicons name="trophy-outline" size={44} color="#6366f1" />
          </LinearGradient>
          <Text className="text-zinc-900 font-black italic text-xl tracking-tight text-center uppercase mb-2">
            No Scores Yet
          </Text>
          <Text className="text-slate-400 text-center font-semibold text-xs uppercase tracking-widest">
            Scores will appear here once judging starts
          </Text>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={item => item.submissionId}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} tintColor="#6366f1" />}
          ListHeaderComponent={() => (
            <View className="mb-4">
              {/* Trophy banner */}
              <View className="flex-row items-center mb-4">
                <View className="flex-1 h-px bg-slate-200" />
                <View className="mx-3 flex-row items-center bg-amber-100 rounded-full px-3 py-1.5">
                  <Ionicons name="trophy" size={12} color="#d97706" />
                  <Text className="text-amber-700 font-black text-[10px] uppercase tracking-widest ml-1">Top 3</Text>
                </View>
                <View className="flex-1 h-px bg-slate-200" />
              </View>

              {podium.map(e => <PodiumCard key={e.submissionId} entry={e} />)}

              {rest.length > 0 && (
                <View className="flex-row items-center my-4">
                  <View className="flex-1 h-px bg-slate-200" />
                  <Text className="mx-3 text-slate-400 text-[10px] font-black uppercase tracking-widest">Rankings</Text>
                  <View className="flex-1 h-px bg-slate-200" />
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
