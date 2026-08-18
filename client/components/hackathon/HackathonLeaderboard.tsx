import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
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
import socket from '../../utils/socket';

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

// ─── Rank podium ──────────────────────────────────────────────────────────────
// Medal metals are the one place a non-brand hue is meaningful: gold, silver and
// bronze are the content, not decoration.
const RANK_META: Record<number, { medal: string; ring: string }> = {
  1: { medal: '🥇', ring: '#f59e0b' },
  2: { medal: '🥈', ring: '#94a3b8' },
  3: { medal: '🥉', ring: '#b45309' },
};

// ─── Podium Card (top 3) ──────────────────────────────────────────────────────
const PodiumCard = memo(({ entry }: { entry: LeaderboardEntry }) => {
  const meta = RANK_META[entry.rank] ?? RANK_META[3];
  const first = entry.rank === 1;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      delay: entry.rank * 80,
      tension: 70,
      friction: 9,
    }).start();
  }, [entry.rank, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        className="rounded-card mb-3 overflow-hidden border border-slate-100"
        style={{
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        <LinearGradient
          colors={first ? ['#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-4 py-4"
        >
          <View className="flex-row items-center justify-between mb-3">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center border"
              style={{
                backgroundColor: first ? 'rgba(255,255,255,0.08)' : '#ffffff',
                borderColor: meta.ring,
              }}
            >
              <Text className="text-xl">{meta.medal}</Text>
            </View>
            <View className="items-end">
              <Text className={`text-2xs font-semibold ${first ? 'text-white/60' : 'text-slate-500'}`}>
                Score
              </Text>
              <Text className={`text-2xl font-extrabold ${first ? 'text-white' : 'text-slate-900'}`}>
                {entry.score.toFixed(1)}
              </Text>
            </View>
          </View>

          <Text
            className={`text-base font-extrabold leading-5 ${first ? 'text-white' : 'text-slate-900'}`}
            numberOfLines={1}
          >
            {entry.projectName}
          </Text>
          {entry.tagline ? (
            <Text
              className={`text-2xs font-semibold mt-0.5 ${first ? 'text-white/60' : 'text-slate-500'}`}
              numberOfLines={1}
            >
              {entry.tagline}
            </Text>
          ) : null}

          <View className="flex-row items-center justify-between mt-3">
            <View
              className="flex-row items-center px-2 py-1 rounded-md"
              style={{ backgroundColor: first ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}
            >
              <Ionicons name="people" size={11} color={first ? '#fdba74' : '#f97316'} />
              <Text
                className={`text-2xs font-semibold ml-1.5 ${first ? 'text-white/80' : 'text-slate-600'}`}
                numberOfLines={1}
              >
                {entry.teamName}
              </Text>
            </View>

            <View className="flex-row" style={{ gap: 6 }}>
              {entry.techStack?.slice(0, 2).map((t, i) => (
                <View
                  key={`${t}-${i}`}
                  className="px-2 py-1 rounded-md"
                  style={{ backgroundColor: first ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}
                >
                  <Text className={`text-2xs font-semibold ${first ? 'text-white/70' : 'text-slate-500'}`}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
});
PodiumCard.displayName = 'PodiumCard';

// ─── Regular Row ──────────────────────────────────────────────────────────────
const LeaderboardRow = memo(({ entry, index }: { entry: LeaderboardEntry; index: number }) => {
  const translateX = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, delay: index * 40, tension: 70, friction: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, delay: index * 40, useNativeDriver: true }),
    ]).start();
  }, [index, translateX, opacity]);

  return (
    <Animated.View style={{ transform: [{ translateX }], opacity }}>
      <View className="bg-white rounded-xl px-3.5 py-3 mb-2 flex-row items-center border border-slate-100">
        <View className="w-9 h-9 rounded-lg bg-slate-900 items-center justify-center mr-3">
          <Text className="text-white font-extrabold text-2xs">#{entry.rank}</Text>
        </View>

        <View className="flex-1 mr-3">
          <Text className="text-slate-900 font-bold text-sm leading-5" numberOfLines={1}>
            {entry.projectName}
          </Text>
          <Text className="text-slate-500 text-2xs font-semibold mt-0.5" numberOfLines={1}>
            {entry.teamName}
          </Text>
        </View>

        <View className="items-end">
          <Text className="text-slate-900 font-extrabold text-base">{entry.score.toFixed(1)}</Text>
          <Text className="text-slate-400 text-2xs font-semibold">pts</Text>
        </View>
      </View>
    </Animated.View>
  );
});
LeaderboardRow.displayName = 'LeaderboardRow';

// ─── List header ──────────────────────────────────────────────────────────────
// Module scope, not an inline arrow. As an inline arrow React remounted the
// whole podium on every render, so the entry animations replayed on each pull
// to refresh and on every socket tick during judging.
const PodiumHeader = memo(({ podium, hasRest }: { podium: LeaderboardEntry[]; hasRest: boolean }) => (
  <View className="mb-3">
    {podium.map((e) => (
      <PodiumCard key={e.submissionId} entry={e} />
    ))}
    {hasRest ? (
      <View className="flex-row items-center mt-4 mb-2">
        <View className="flex-1 h-px bg-slate-200" />
        <Text className="text-slate-400 text-2xs font-bold mx-3">All rankings</Text>
        <View className="flex-1 h-px bg-slate-200" />
      </View>
    ) : null}
  </View>
));
PodiumHeader.displayName = 'PodiumHeader';

// ─── Main Screen ──────────────────────────────────────────────────────────────
const HackathonLeaderboard = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId, hackathonTitle } = route.params ?? {};

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`/hackathon-leaderboard/${hackathonId}`);
      setLeaderboard(res.data.leaderboard ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load leaderboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hackathonId]);

  useEffect(() => {
    load();
    socket.emit('subscribe:leaderboard', { hackathonId });

    const onUpdate = () => {
      load();
      Toast.show({ type: 'info', text1: 'Leaderboard updated' });
    };
    socket.on('leaderboard:updated', onUpdate);
    return () => {
      socket.off('leaderboard:updated', onUpdate);
    };
  }, [hackathonId, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const podium = leaderboard.filter((e) => e.rank <= 3);
  const rest = leaderboard.filter((e) => e.rank > 3);

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="bg-white border-b border-slate-100 px-4 pt-2 pb-4">
          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-9 h-9 rounded-lg bg-slate-100 items-center justify-center"
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color="#0f172a" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRefresh}
              className="w-9 h-9 rounded-lg bg-slate-100 items-center justify-center"
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={16} color="#f97316" />
            </TouchableOpacity>
          </View>

          <Text className="text-slate-900 text-2xl font-extrabold">Leaderboard</Text>
          <Text className="text-slate-500 text-2xs font-semibold mt-0.5" numberOfLines={1}>
            {hackathonTitle ?? 'Live rankings'}
          </Text>

          <View className="flex-row mt-3" style={{ gap: 10 }}>
            {[
              { label: 'Projects', val: String(leaderboard.length), icon: 'people-outline' },
              { label: 'Top score', val: leaderboard[0]?.score?.toFixed(1) ?? '—', icon: 'flash-outline' },
            ].map((s) => (
              <View key={s.label} className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <View className="flex-row items-center">
                  <Ionicons name={s.icon as any} size={12} color="#f97316" />
                  <Text className="text-slate-500 text-2xs font-semibold ml-1.5">{s.label}</Text>
                </View>
                <Text className="text-slate-900 font-extrabold text-lg mt-0.5">{s.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : leaderboard.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-16 h-16 rounded-2xl bg-white border border-slate-100 items-center justify-center mb-4">
              <Ionicons name="trophy-outline" size={28} color="#cbd5e1" />
            </View>
            <Text className="text-slate-900 text-base font-bold text-center mb-1">No scores yet</Text>
            <Text className="text-slate-500 text-2xs font-semibold text-center leading-4">
              Rankings appear once judges start scoring submissions.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rest}
            keyExtractor={(item) => item.submissionId}
            contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f97316']} tintColor="#f97316" />
            }
            ListHeaderComponent={<PodiumHeader podium={podium} hasRest={rest.length > 0} />}
            renderItem={({ item, index }) => <LeaderboardRow entry={item} index={index} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

export default HackathonLeaderboard;
