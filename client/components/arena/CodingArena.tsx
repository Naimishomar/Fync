import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://fync-zeta.vercel.app';

/**
 * The Arena, as the app shows it: where you stand, not where you type.
 *
 * Solving happens in the browser, so this screen is progress and ranking. It
 * used to open on a list of problems, which invited students to code on a phone
 * — the thing the web app exists to avoid.
 */
export default function CodingArena() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const bottomInset = useBottomInset();

  const [progress, setProgress] = useState<any>(null);
  const [board, setBoard] = useState<any[]>([]);
  const [myRow, setMyRow] = useState<any>(null);
  const [scope, setScope] = useState<'college' | 'global'>('college');
  const [history, setHistory] = useState<any[]>([]);
  const [live, setLive] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Toggling scope quickly fires overlapping loads; only the latest may write.
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const [pr, lb, ct] = await Promise.allSettled([
        axios.get('/arena/progress'),
        axios.get('/arena/leaderboard', { params: { scope } }),
        axios.get('/arena/contests'),
      ]);
      if (id !== reqId.current) return;
      if (pr.status === 'fulfilled') {
        const p = pr.value.data.progress ?? null;
        setProgress(p);
        setHistory(p?.contests ?? []);
      }
      if (lb.status === 'fulfilled') {
        setBoard(lb.value.data.leaderboard ?? []);
        setMyRow(lb.value.data.me ?? null);
      }
      if (ct.status === 'fulfilled') {
        // getUpcomingContests returns a bare array, not { contests }. Reading
        // only the wrapped shape meant this was always empty, deployed or not.
        const d = ct.value.data;
        setLive(Array.isArray(d) ? d : (d?.contests ?? []));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  // Refetched on focus so a solve finished on a laptop is reflected when the
  // student picks their phone back up.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openWeb = (path: string) => Linking.openURL(`${WEB_URL}${path}`);

  const Header = (
    <View>
      {!loading && !progress && (
        <View className="mx-5 mb-4 bg-card border-2 border-ink rounded-card p-4">
          <View className="flex-row items-center">
            <Ionicons name="cloud-offline-outline" size={18} color={C.warning} />
            <Text className="font-display text-ink ml-2" style={{ fontSize: 13 }}>Progress unavailable</Text>
          </View>
          <Text className="font-sans text-ink-2 mt-1" style={{ fontSize: 12 }}>
            Your stats could not be loaded. Pull down to try again.
          </Text>
        </View>
      )}

      {!!progress && (
        <View className="px-5">
          <View className="bg-ink rounded-card p-4">
            <View className="flex-row">
              {[
                { n: progress.solved,      label: 'Solved' },
                { n: progress.solveStreak, label: 'Day streak' },
                { n: progress.activeDays,  label: 'Active days' },
              ].map((s, i) => (
                <View
                  key={s.label}
                  className="flex-1 items-center"
                  style={i < 2 ? { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.18)' } : undefined}
                >
                  <Text className="font-display text-white" style={{ fontSize: 22 }}>{s.n}</Text>
                  <Text className="font-display text-night-3 uppercase mt-1" style={{ fontSize: 9 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Thirty days at a glance. A run you can see is harder to break
                than a number, which is the point of drawing it. */}
            <View className="flex-row mt-4 pt-3" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' }}>
              {(progress.last30 ?? []).map((on: boolean, i: number) => (
                <View
                  key={i}
                  style={{
                    flex: 1, height: 22, marginRight: i === 29 ? 0 : 2, borderRadius: 2,
                    backgroundColor: on ? '#F97316' : 'rgba(255,255,255,0.10)',
                  }}
                />
              ))}
            </View>
            <Text className="font-sans text-night-3 mt-2" style={{ fontSize: 10 }}>
              {progress.solvedToday
                ? 'Solved today — streak safe.'
                : progress.solveStreak > 0
                  ? `Solve one today to keep a ${progress.solveStreak}-day run.`
                  : 'Solve one to start a streak.'}
            </Text>

            <View className="flex-row mt-4 pt-3" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' }}>
              {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
                <View key={d} className="flex-row items-center mr-4">
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: d === 'Easy' ? '#4ADE80' : d === 'Medium' ? '#FB923C' : '#F87171',
                  }} />
                  <Text className="font-sans text-night-3 ml-1.5" style={{ fontSize: 11 }}>
                    {d} {progress.byDifficulty?.[d] ?? 0}
                  </Text>
                </View>
              ))}
              <View className="flex-1" />
              <Text className="font-sans text-night-3" style={{ fontSize: 11 }}>of {progress.totalProblems}</Text>
            </View>
          </View>

          {/* Coins with the place to spend them. A balance with no visible
              outlet is trivia; next to the marketplace it is a reason. */}
          <TouchableOpacity
            onPress={() => navigation.navigate('RewardsMarketplace')}
            className="flex-row items-center bg-card border-2 border-ink rounded-card px-4 mt-3"
            style={{ minHeight: 56 }}
            accessibilityRole="button"
            accessibilityLabel={`${progress.coins} Fync coins. Open the marketplace.`}
          >
            <View className="items-center justify-center rounded-xl border-2 border-ink" style={{ width: 40, height: 40, backgroundColor: '#FFEDD5' }}>
              <Ionicons name="server-outline" size={20} color={C.brand[700]} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-display text-ink" style={{ fontSize: 16 }}>{progress.coins} coins</Text>
              <Text className="font-sans text-ink-2" style={{ fontSize: 11 }}>Spend them in Fync Marketplace</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.ink3} />
          </TouchableOpacity>
        </View>
      )}

      {/* Live and upcoming. A contest you can still enter is the most
          time-sensitive thing on this screen, so it sits above everything that
          has already happened. */}
      {live.length > 0 && (
        <View className="mt-5">
          <View className="flex-row items-center px-5 mb-2">
            <Text className="font-display text-ink uppercase" style={{ fontSize: 13 }}>Happening now</Text>
            <View className="h-[2px] flex-1 bg-ink ml-3" style={{ opacity: 0.82 }} />
          </View>

          {live.map((c: any) => {
            const now = Date.now();
            const starts = c.startTime ? new Date(c.startTime).getTime() : 0;
            const ends = c.endTime ? new Date(c.endTime).getTime() : 0;
            const running = starts <= now && now < ends;
            const mins = Math.max(0, Math.round(((running ? ends : starts) - now) / 60000));
            const when =
              mins < 60 ? `${mins} min`
              : mins < 1440 ? `${Math.round(mins / 60)} hr`
              : `${Math.round(mins / 1440)} days`;

            return (
              <TouchableOpacity
                key={c._id}
                onPress={() => openWeb(`/arena/contest/${c._id}`)}
                className={`mx-5 mb-2 rounded-card border-2 border-ink p-4 ${running ? 'bg-ink' : 'bg-card'}`}
                accessibilityRole="button"
                accessibilityLabel={running ? `${c.title}, live, ends in ${when}` : `${c.title}, starts in ${when}`}
              >
                <View className="flex-row items-center mb-2">
                  <View className={`px-2 py-1 rounded-sm ${running ? 'bg-brand-500' : 'bg-paper-2'}`}>
                    <Text className="font-display text-ink uppercase" style={{ fontSize: 9 }}>
                      {running ? 'Live now' : 'Upcoming'}
                    </Text>
                  </View>
                  <View className="flex-1" />
                  <Text className={`font-display ${running ? 'text-brand-400' : 'text-ink-2'}`} style={{ fontSize: 11 }}>
                    {running ? `Ends in ${when}` : `Starts in ${when}`}
                  </Text>
                </View>

                <Text className={`font-display ${running ? 'text-white' : 'text-ink'}`} style={{ fontSize: 16 }} numberOfLines={2}>
                  {c.title}
                </Text>
                <Text className={`font-sans mt-1 ${running ? 'text-night-3' : 'text-ink-2'}`} style={{ fontSize: 11 }}>
                  {(c.problems?.length ?? 0)} problems · {(c.participants?.length ?? 0)} entered
                </Text>

                <View className={`flex-row items-center justify-center mt-3 rounded-xl border-2 ${running ? 'bg-brand-500 border-brand-500' : 'bg-card border-ink'}`} style={{ minHeight: 42 }}>
                  <Ionicons name={running ? 'flash' : 'calendar-outline'} size={15} color={C.ink} />
                  <Text className="font-display text-ink uppercase ml-1.5" style={{ fontSize: 11 }}>
                    {running ? 'Enter on web' : 'View details'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Past contests. A list of contests without your result is a calendar. */}
      {history.length > 0 && (
        <View className="mt-5">
          <View className="flex-row items-center px-5 mb-2">
            <Text className="font-display text-ink uppercase" style={{ fontSize: 13 }}>Your contests</Text>
            <View className="h-[2px] flex-1 bg-ink ml-3" style={{ opacity: 0.82 }} />
          </View>

          {history.map((c: any) => {
            const played = c.rank != null;
            return (
              <TouchableOpacity
                key={c._id}
                onPress={() => openWeb(`/arena/contest/${c._id}`)}
                className="flex-row items-center bg-card border-2 border-ink rounded-card px-4 py-3 mx-5 mb-2"
                accessibilityRole="button"
                accessibilityLabel={played
                  ? `${c.title}, ranked ${c.rank} of ${c.outOf}, ${c.score} points`
                  : `${c.title}, not attempted`}
              >
                <View
                  className="items-center justify-center rounded-xl border-2 border-ink"
                  style={{ width: 46, height: 46, backgroundColor: played ? '#FFEDD5' : '#EDE8E0' }}
                >
                  {played ? (
                    <>
                      <Text className="font-display text-ink" style={{ fontSize: 15, lineHeight: 17 }}>#{c.rank}</Text>
                      <Text className="font-display text-ink-2" style={{ fontSize: 8 }}>of {c.outOf}</Text>
                    </>
                  ) : (
                    <Ionicons name="remove-outline" size={18} color={C.ink3} />
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-display text-ink" style={{ fontSize: 14 }} numberOfLines={1}>{c.title}</Text>
                  <Text className="font-sans text-ink-2 mt-[2px]" style={{ fontSize: 11 }}>
                    {c.startTime ? new Date(c.startTime).toLocaleDateString() : ''}
                    {played ? ` · ${c.score} pts` : c.attempted ? ' · entered, no score' : ' · not attempted'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View className="flex-row items-center px-5 mt-6 mb-2">
        <Text className="font-display text-ink uppercase" style={{ fontSize: 13 }}>Leaderboard</Text>
        <View className="h-[2px] flex-1 bg-ink mx-3" style={{ opacity: 0.82 }} />
        <View className="flex-row bg-card border-2 border-ink rounded-xl overflow-hidden">
          {(['college', 'global'] as const).map((sc) => (
            <TouchableOpacity
              key={sc}
              onPress={() => setScope(sc)}
              className={`px-3 py-1.5 ${scope === sc ? 'bg-brand-500' : 'bg-card'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: scope === sc }}
            >
              <Text className="font-display text-ink uppercase" style={{ fontSize: 9 }}>
                {sc === 'college' ? 'My college' : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Your own row, pinned. Being 63rd is still the number you came for. */}
      {!!myRow && (
        <View className="px-5 mb-2">
          <View className="flex-row items-center bg-brand-500 border-2 border-ink rounded-card px-4 py-3">
            <Text className="font-display text-ink" style={{ fontSize: 16, width: 34 }}>#{myRow.rank}</Text>
            <Text className="font-display text-ink flex-1" numberOfLines={1}>You</Text>
            <Text className="font-display text-ink" style={{ fontSize: 13 }}>{myRow.points} pts</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderRow = ({ item }: { item: any }) => {
    const isMe = String(item._id) === String((user as any)?._id ?? (user as any)?.id);
    return (
      <View className={`flex-row items-center mx-5 mb-2 px-4 py-3 rounded-card border-2 border-ink ${isMe ? 'bg-brand-100' : 'bg-card'}`}>
        <Text className="font-display text-ink" style={{ fontSize: 15, width: 34 }}>#{item.rank}</Text>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} cachePolicy="memory-disk" />
        ) : (
          <View className="items-center justify-center rounded-full bg-paper-2" style={{ width: 32, height: 32 }}>
            <Text className="font-display text-ink-2" style={{ fontSize: 12 }}>
              {String(item.name ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="ml-3 flex-1">
          <Text className="font-display text-ink" style={{ fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
          <Text className="font-sans text-ink-2" style={{ fontSize: 11 }} numberOfLines={1}>
            {item.solved} solved{item.college ? ` · ${item.college}` : ''}
          </Text>
        </View>
        <Text className="font-display text-ink" style={{ fontSize: 13 }}>{item.points}</Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-paper">
      <AppBar title="Coding Arena" onBack={() => navigation.goBack()} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={C.brand[500]} />
        </View>
      ) : (
        <FlatList keyboardShouldPersistTaps="handled"
          data={board}
          keyExtractor={(r) => String(r._id)}
          renderItem={renderRow}
          ListHeaderComponent={Header}
          // Clears the pinned button AND the device's navigation bar, whether
          // that is a gesture pill or three physical buttons.
          contentContainerStyle={{ paddingBottom: bottomInset + 54 + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.brand[500]} />
          }
          ListEmptyComponent={
            <View className="items-center mt-12 px-8">
              <Ionicons name="podium-outline" size={52} color={C.ink4} />
              <Text className="font-display text-base text-ink mt-4 text-center">Nobody ranked yet</Text>
              <Text className="font-sans text-ink-2 mt-2 text-center" style={{ fontSize: 13 }}>
                {scope === 'college'
                  ? 'Be the first from your college to solve one.'
                  : 'Solve a problem on the web to appear here.'}
              </Text>
            </View>
          }
        />
      )}

      <View className="absolute left-5 right-5" style={{ bottom: bottomInset }}>
        <TouchableOpacity
          onPress={() => openWeb('/arena')}
          className="flex-row items-center justify-center gap-2 bg-brand-500 border-2 border-ink rounded-card"
          style={{ height: 54 }}
          accessibilityRole="button"
          accessibilityLabel="Open the arena in your browser to solve problems"
        >
          <Ionicons name="laptop-outline" size={18} color={C.ink} />
          <Text className="font-display text-ink uppercase">Solve on web</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
