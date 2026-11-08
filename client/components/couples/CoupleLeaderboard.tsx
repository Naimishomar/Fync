import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { AppBar, Button, Chip, Empty, Screen } from '../ui/kit';
import Avatar from '../Avatar';

import FyncRefreshControl from '../ui/FyncRefreshControl';
/**
 * Top couples by daily-question streak. Only couples where both partners
 * opted in (Couple Space → "Show us on the leaderboard") are listed.
 */

type Person = { _id: string; name?: string; username?: string; avatar?: string; college?: string };
type Row = { id: string; users: Person[]; score: number; days: number };
type Board = { couples: Row[]; me: { score: number; listed: boolean; rank: number | null } | null };

const first = (p?: Person) => (p?.name || p?.username || '').split(' ')[0];
const MEDAL = ['🥇', '🥈', '🥉'];

const CoupleLeaderboard = () => {
  const navigation = useNavigation<any>();
  const [type, setType] = useState<'live' | 'best'>('live');
  const [data, setData] = useState<Board | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await axios.get('/couple/leaderboard', { params: { type } });
      setData(r.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, [type]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const unit = type === 'live' ? 'day streak' : 'best streak';
  const me = data?.me;

  return (
    <Screen>
      <AppBar title="Top Couples" onBack={() => navigation.goBack()} />
      <View className="flex-row px-gutter pb-3" style={{ gap: 8 }}>
        <Chip label="🔥 Live streaks" active={type === 'live'} onPress={() => setType('live')} />
        <Chip label="👑 All-time best" active={type === 'best'} onPress={() => setType('best')} />
      </View>

      {me ? (
        <View className="mx-5 mb-3 rounded-2xl px-4 py-3 flex-row items-center" style={{ backgroundColor: '#e11d48' }}>
          <Text className="font-semibold flex-1" style={{ color: '#FFFFFF', fontSize: 15 }}>
            {me.listed ? `You two are #${me.rank}` : me.score > 0 ? 'Not on the board yet' : 'Start a streak to climb'}
          </Text>
          <Text className="font-display" style={{ color: '#FFFFFF', fontSize: 15 }}>🔥 {me.score}</Text>
        </View>
      ) : null}
      {me && !me.listed && me.score > 0 ? (
        <Text className="font-sans text-ink-3 text-xs mx-5 mb-3">Both of you switch on "Show us on the leaderboard" in Couple Space to appear here.</Text>
      ) : null}

      {data === null && !error ? (
        <ActivityIndicator color={C.ink3} style={{ marginTop: 40 }} />
      ) : error ? (
        <View className="mt-10">
          <Empty icon="cloud-offline-outline" title="Couldn't load the leaderboard" action={<Button title="Try again" small onPress={load} />} />
        </View>
      ) : (
        <FlatList
          data={data?.couples ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={<FyncRefreshControl refreshing={refreshing} tintColor={C.ink3} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={
            <View className="mt-10">
              <Empty icon="heart-outline" title="No couples here yet" hint="Answer the daily question together, opt in, and be the first." />
            </View>
          }
          renderItem={({ item, index }) => <CoupleRow item={item} index={index} unit={unit} />}
        />
      )}
    </Screen>
  );
};

const CoupleRow = memo(function CoupleRow({ item, index, unit }: { item: Row; index: number; unit: string }) {
  const [a, b] = item.users;
  return (
    <View className={`flex-row items-center rounded-2xl border mb-3 px-3 py-3 bg-card ${index < 3 ? 'border-brand-500/30' : 'border-line'}`}>
      <Text className="font-display text-ink text-center" style={{ width: 32, fontSize: index < 3 ? 22 : 15 }} accessibilityLabel={`Rank ${index + 1}`}>
        {MEDAL[index] ?? index + 1}
      </Text>
      <View className="flex-row ml-1" style={{ width: 62 }}>
        <Avatar user={a} size={36} showBadge={false} />
        <View style={{ marginLeft: -12, borderRadius: 20, borderWidth: 2, borderColor: C.card }}>
          <Avatar user={b} size={36} showBadge={false} />
        </View>
      </View>
      <View className="flex-1 ml-2" style={{ minWidth: 0 }}>
        <Text className="font-semibold text-ink" numberOfLines={1}>{first(a)} & {first(b)}</Text>
        <Text className="font-sans text-ink-3 text-xs mt-0.5" numberOfLines={1}>
          {item.days} days together{a?.college ? ` · ${a.college}` : ''}
        </Text>
      </View>
      <View className="items-end">
        <Text className="font-display text-ink" style={{ fontSize: 17 }}>🔥 {item.score}</Text>
        <Text className="font-sans text-ink-3 text-2xs">{unit}</Text>
      </View>
    </View>
  );
});

export default CoupleLeaderboard;
