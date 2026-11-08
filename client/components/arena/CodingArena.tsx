import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';
import { AppBar, Avatar, Button, Card, Empty, IconTile, ListRow, Num, SectionHeader, SegmentedTabs } from '../ui/kit';

import FyncRefreshControl from '../ui/FyncRefreshControl';
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
        <Card padded style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <View className="flex-row items-center">
            <Ionicons name="cloud-offline-outline" size={18} color={C.warning} />
            <Text className="font-semibold text-ink text-sm ml-2">Progress unavailable</Text>
          </View>
          <Text className="font-sans text-ink-2 text-xs mt-1">
            Your stats could not be loaded. Pull down to try again.
          </Text>
        </Card>
      )}

      {!!progress && (
        <View className="px-5">
          <View className="bg-night rounded-2xl p-4">
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
                  <Num style={{ fontSize: 22, color: '#fff' }}>{s.n}</Num>
                  <Text className="font-medium text-night-3 text-xs mt-1">{s.label}</Text>
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
                    backgroundColor: on ? C.brand[500] : 'rgba(255,255,255,0.10)',
                  }}
                />
              ))}
            </View>
            <Text className="font-sans text-night-3 text-xs mt-2">
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
                  <Text className="font-sans text-night-3 text-xs ml-1.5">
                    {d} {progress.byDifficulty?.[d] ?? 0}
                  </Text>
                </View>
              ))}
              <View className="flex-1" />
              <Text className="font-sans text-night-3 text-xs">of {progress.totalProblems}</Text>
            </View>
          </View>

          {/* Coins with the place to spend them. A balance with no visible
              outlet is trivia; next to the marketplace it is a reason. */}
          <Card style={{ marginTop: 12, paddingHorizontal: 16 }}>
            <ListRow
              leading={<IconTile icon="server-outline" bg={C.brand[100]} color={C.brand[700]} />}
              title={`${progress.coins} coins`}
              subtitle="Spend them in Fync Marketplace"
              onPress={() => navigation.navigate('RewardsMarketplace')}
              accessibilityLabel={`${progress.coins} Fync coins. Open the marketplace.`}
            />
          </Card>
        </View>
      )}

      {/* Live and upcoming. A contest you can still enter is the most
          time-sensitive thing on this screen, so it sits above everything that
          has already happened. */}
      {live.length > 0 && (
        <View className="px-5">
          <SectionHeader title="Happening now" />

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
              <Pressable
                key={c._id}
                onPress={() => openWeb(`/arena/contest/${c._id}`)}
                className={`mb-3 rounded-2xl p-4 active:opacity-85 ${running ? 'bg-night border border-line' : 'bg-card border border-line'}`}
                accessibilityRole="button"
                accessibilityLabel={running ? `${c.title}, live, ends in ${when}` : `${c.title}, starts in ${when}`}
              >
                <View className="flex-row items-center mb-2">
                  <View className={`px-2.5 py-1 rounded-full ${running ? 'bg-brand-500' : 'bg-paper-2'}`}>
                    <Text className={`font-semibold text-xs ${running ? 'text-on-brand' : 'text-ink'}`}>
                      {running ? 'Live now' : 'Upcoming'}
                    </Text>
                  </View>
                  <View className="flex-1" />
                  <Text className={`font-medium text-xs ${running ? 'text-brand-400' : 'text-ink-2'}`}>
                    {running ? `Ends in ${when}` : `Starts in ${when}`}
                  </Text>
                </View>

                <Text className={`font-semibold text-base ${running ? 'text-white' : 'text-ink'}`} numberOfLines={2}>
                  {c.title}
                </Text>
                <Text className={`font-sans text-xs mt-1 ${running ? 'text-night-3' : 'text-ink-2'}`}>
                  {(c.problems?.length ?? 0)} problems · {(c.participants?.length ?? 0)} entered
                </Text>

                <View
                  className={`flex-row items-center justify-center mt-3 rounded-full ${running ? 'bg-brand-500' : 'bg-paper-2'}`}
                  style={{ minHeight: 44 }}
                >
                  <Ionicons name={running ? 'flash' : 'calendar-outline'} size={16} color={running ? C.onBrand : C.ink} />
                  <Text className={`font-semibold text-sm ml-1.5 ${running ? 'text-on-brand' : 'text-ink'}`}>
                    {running ? 'Enter on web' : 'View details'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Past contests. A list of contests without your result is a calendar. */}
      {history.length > 0 && (
        <View className="px-5">
          <SectionHeader title="Your contests" />
          <Card style={{ paddingHorizontal: 16 }}>
            {history.map((c: any) => {
              const played = c.rank != null;
              return (
                <ListRow
                  key={c._id}
                  onPress={() => openWeb(`/arena/contest/${c._id}`)}
                  accessibilityLabel={played
                    ? `${c.title}, ranked ${c.rank} of ${c.outOf}, ${c.score} points`
                    : `${c.title}, not attempted`}
                  leading={
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 44, height: 44, backgroundColor: played ? C.brand[100] : C.paper2 }}
                    >
                      {played ? (
                        <>
                          <Num style={{ fontSize: 14, lineHeight: 16 }}>#{c.rank}</Num>
                          <Text className="font-medium text-ink-2" style={{ fontSize: 9 }}>of {c.outOf}</Text>
                        </>
                      ) : (
                        <Ionicons name="remove-outline" size={18} color={C.ink3} />
                      )}
                    </View>
                  }
                  title={c.title}
                  subtitle={`${c.startTime ? new Date(c.startTime).toLocaleDateString() : ''}${played ? ` · ${c.score} pts` : c.attempted ? ' · entered, no score' : ' · not attempted'}`}
                />
              );
            })}
          </Card>
        </View>
      )}

      <View className="px-5">
        <SectionHeader
          title="Leaderboard"
          right={
            <SegmentedTabs
              items={['college', 'global'] as const}
              value={scope}
              onChange={setScope}
              labels={{ college: 'My college', global: 'All' }}
            />
          }
        />
      </View>

      {/* Your own row, pinned. Being 63rd is still the number you came for. */}
      {!!myRow && (
        <View className="px-5 mb-3">
          <View className="flex-row items-center bg-brand-500 rounded-2xl px-4" style={{ minHeight: 56 }}>
            <Num style={{ fontSize: 16, width: 40, color: C.onBrand }}>#{myRow.rank}</Num>
            <Text className="font-semibold text-on-brand flex-1" numberOfLines={1}>You</Text>
            <Text className="font-semibold text-on-brand text-sm">{myRow.points} pts</Text>
          </View>
        </View>
      )}
    </View>
  );

  const myId = String((user as any)?._id ?? (user as any)?.id);
  const renderRow = ({ item }: { item: any }) => <BoardRow item={item} isMe={String(item._id) === myId} />;

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
          contentContainerStyle={{ paddingBottom: bottomInset + 48 + 24 }}
          refreshControl={
            <FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.brand[500]} />
          }
          ListEmptyComponent={
            <Empty
              icon="podium-outline"
              title="Nobody ranked yet"
              hint={scope === 'college'
                ? 'Be the first from your college to solve one.'
                : 'Solve a problem on the web to appear here.'}
            />
          }
        />
      )}

      <View className="absolute left-5 right-5" style={{ bottom: bottomInset }}>
        <Button
          variant="primary"
          block
          icon="laptop-outline"
          title="Solve on web"
          onPress={() => openWeb('/arena')}
          accessibilityLabel="Open the arena in your browser to solve problems"
        />
      </View>
    </View>
  );
}

// Module scope + memo: FlatList rows re-render only when their item changes.
const BoardRow = React.memo(function BoardRow({ item, isMe }: { item: any; isMe: boolean }) {
  return (
    <View className={`flex-row items-center mx-5 mb-3 px-4 rounded-2xl border border-line ${isMe ? 'bg-brand-100' : 'bg-card'}`} style={{ minHeight: 56 }}>
      <Num style={{ fontSize: 15, width: 40 }}>#{item.rank}</Num>
      <Avatar uri={item.avatar || undefined} initials={String(item.name ?? '?').charAt(0)} size={32} />
      <View className="ml-3 flex-1" style={{ minWidth: 0 }}>
        <Text className="font-semibold text-ink text-sm" numberOfLines={1}>{item.name}</Text>
        <Text className="font-sans text-ink-2 text-xs" numberOfLines={1}>
          {item.solved} solved{item.college ? ` · ${item.college}` : ''}
        </Text>
      </View>
      <Num style={{ fontSize: 13 }}>{item.points}</Num>
    </View>
  );
});
