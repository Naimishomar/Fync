import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { artUrl } from '../../constants/features';
import Avatar from '../Avatar';
import { AppBar, Button, Card, Empty, Screen } from '../ui/kit';
import Skeleton from '../Skeleton';
import { TYPE } from '../../constants/type';
import { Sheet } from '../ui/Sheet';
import { SearchField } from '../ui/Field';
import { Alert } from '../ui/AlertModal';
import { PressScale, buzz, enterAt, tick } from '../ui/motion';

type U = { _id: string; name?: string; username?: string; avatar?: string; year?: number };
type Pick = { user: U; matched: boolean; unlockAt: string };
type State = { max: number; admirers: number; picks: Pick[] };

const PINK = '#db2777';
// Pink as text on card/paper: deeper on light, lighter on dark so it keeps AA contrast.
const pinkInk = () => C.pinkInk;
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

/** First-load placeholder in the footprint of hero, admirer card and the 3 slots. */
const CrushSkeleton = () => (
  <View style={{ paddingHorizontal: 20 }}>
    <Skeleton lightMode height={132} borderRadius={16} />
    <Skeleton lightMode height={72} borderRadius={16} style={{ marginTop: 20 }} />
    <Skeleton lightMode width={120} height={16} style={{ marginTop: 24 }} />
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
      {[0, 1, 2].map((i) => <Skeleton key={i} lightMode height={140} borderRadius={16} style={{ flex: 1 }} />)}
    </View>
  </View>
);

const SearchSkeleton = () => (
  <View style={{ gap: 16, paddingTop: 8 }}>
    {[0, 1, 2, 3].map((i) => (
      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Skeleton lightMode width={44} height={44} borderRadius={22} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton lightMode width="60%" height={14} />
          <Skeleton lightMode width="40%" height={12} />
        </View>
      </View>
    ))}
  </View>
);

const ResultRow = React.memo(function ResultRow({ u, already, busy, loading, onPick }: {
  u: U; already: boolean; busy: boolean; loading: boolean; onPick: (u: U) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }}>
      <Avatar user={u} size={44} />
      <View style={{ flex: 1 }}>
        <Text className="text-ink" style={TYPE.heading} numberOfLines={1}>{u.name}</Text>
        <Text className="text-ink-3" style={TYPE.sm} numberOfLines={1}>@{u.username}</Text>
      </View>
      <Button title={already ? 'Picked' : 'Pick'} small variant={already ? 'secondary' : 'primary'} disabled={already || busy}
        loading={loading} onPress={() => onPick(u)} accessibilityLabel={already ? `${u.name} already picked` : `Pick ${u.name}`} />
    </View>
  );
});

/**
 * Dil Se: pick up to 3 people from your college in secret. Nobody learns who
 * picked them unless it's mutual — then both get "It's a match".
 */
export default function CrushMatch() {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<State | null>(null);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<U[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/couple/crush', { params: { noCache: true } });
      if (res.data?.success) setData(res.data);
    } catch {
      setData((d) => d ?? { max: 3, admirers: 0, picks: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Debounced college search.
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await axios.get('/couple/crush/search', { params: { q: q.trim(), noCache: true } });
        setResults(res.data?.users || []);
      } catch { setResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q]);

  const picked = useMemo(() => new Set((data?.picks || []).map((p) => p.user._id)), [data]);
  const matches = (data?.picks || []).filter((p) => p.matched);
  const slots = data?.max ?? 3;

  const pick = useCallback(async (u: U) => {
    setBusyId(u._id);
    try {
      const res = await axios.post('/couple/crush', { userId: u._id });
      setPicking(false); setQ('');
      if (res.data?.matched) {
        buzz();
        Alert.alert("It's a match 💘", `You and ${u.name?.split(' ')[0] || 'they'} picked each other!`);
      } else {
        tick();
        Toast.show({ type: 'success', text1: 'Picked in secret 🤫', text2: "They'll only know if they pick you too" });
      }
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not pick' });
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const remove = (p: Pick) => {
    const left = daysLeft(p.unlockAt);
    if (left > 0) {
      Toast.show({ type: 'info', text1: `Locked for ${left} more day${left === 1 ? '' : 's'}`, text2: 'Picks stay for a week so nobody can game the matches' });
      return;
    }
    Alert.alert('Remove this pick?', p.matched ? 'This also ends your match.' : 'You can pick someone else after.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try { await axios.delete(`/couple/crush/${p.user._id}`); load(); } catch (e: any) {
            Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not remove' });
          }
        },
      },
    ]);
  };

  const renderResult = useCallback(({ item }: { item: U }) => (
    <ResultRow u={item} already={picked.has(item._id)} busy={busyId != null} loading={busyId === item._id} onPick={pick} />
  ), [picked, busyId, pick]);

  const openProfile = (u: U) => navigation.navigate('PublicProfile', { userId: u._id });

  return (
    <Screen>
      <AppBar title="Dil Se" onBack={() => navigation.goBack()} />
      {!data ? (
        <CrushSkeleton />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {/* Hero */}
          <View className="rounded-2xl overflow-hidden mb-5" style={{ backgroundColor: PINK }}>
            <View className="p-5 flex-row items-center">
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[TYPE.title, { color: '#fff' }]} accessibilityRole="header">Secret crush 💘</Text>
                <Text style={[TYPE.sm, { color: 'rgba(255,255,255,0.92)', marginTop: 4 }]}>
                  Pick up to {slots} people from your college. They only find out if they pick you too.
                </Text>
              </View>
              <Image source={{ uri: artUrl('assets/Heart with arrow/3D/heart_with_arrow_3d.png') }} style={{ width: 72, height: 72 }} contentFit="contain" cachePolicy="disk" accessible={false} />
            </View>
          </View>

          {/* Admirers teaser: a count, never names */}
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 28 }} accessible={false}>{data.admirers > 0 ? '🔥' : '🤫'}</Text>
            <View style={{ flex: 1 }}>
              <Text className="text-ink" style={TYPE.heading}>
                {data.admirers > 0
                  ? `${data.admirers} ${data.admirers === 1 ? 'person has' : 'people have'} a secret crush on you`
                  : 'No secret admirers yet'}
              </Text>
              <Text className="text-ink-3" style={[TYPE.sm, { marginTop: 2 }]}>
                {data.admirers > 0 ? 'Pick them back to find out who 👀' : 'Stay active, they might be shy'}
              </Text>
            </View>
          </Card>

          {/* Matches */}
          {matches.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <Text className="text-ink" style={[TYPE.heading, { marginBottom: 12 }]} accessibilityRole="header">Your matches 💞</Text>
              {matches.map((m, i) => (
                <Animated.View key={m.user._id} entering={enterAt(i)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, borderColor: PINK }}>
                    <Avatar user={m.user} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text className="text-ink" style={TYPE.heading} numberOfLines={1}>{m.user.name}</Text>
                      <Text className="text-ink-3" style={TYPE.sm} numberOfLines={1}>You picked each other</Text>
                    </View>
                    <Button title="Say hi" small variant="primary" onPress={() => openProfile(m.user)} accessibilityLabel={`Say hi to ${m.user.name}`} />
                  </Card>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {/* Slots */}
          <Text className="text-ink" style={[TYPE.heading, { marginBottom: 12 }]} accessibilityRole="header">
            Your picks · {data.picks.length}/{slots}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {Array.from({ length: slots }, (_, i) => {
              const p = data.picks[i];
              if (!p) {
                return (
                  <PressScale key={`empty-${i}`} onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel="Pick someone"
                    style={{ flex: 1, aspectRatio: 0.8, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Ionicons name="add" size={28} color={pinkInk()} />
                    <Text className="text-ink-3" style={TYPE.caption}>Pick</Text>
                  </PressScale>
                );
              }
              const left = daysLeft(p.unlockAt);
              return (
                <PressScale key={p.user._id} onPress={() => openProfile(p.user)} onLongPress={() => remove(p)} accessibilityRole="button"
                  accessibilityLabel={`${p.user.name}${p.matched ? ', matched' : left > 0 ? `, locked for ${left} days` : ''}. Long press to remove`}
                  style={{ flex: 1, aspectRatio: 0.8, borderRadius: 16, borderWidth: p.matched ? 2 : 1, borderColor: p.matched ? PINK : C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 6 }}>
                  <Avatar user={p.user} size={52} showBadge={false} />
                  <Text className="text-ink font-semibold" style={TYPE.sm} numberOfLines={1}>{p.user.name?.split(' ')[0]}</Text>
                  <Text style={[TYPE.micro, { color: p.matched ? pinkInk() : C.ink3 }]} numberOfLines={1}>
                    {p.matched ? 'Match 💘' : left > 0 ? `🔒 ${left}d` : 'Waiting…'}
                  </Text>
                </PressScale>
              );
            })}
          </View>
          <Text className="text-ink-3" style={[TYPE.caption, { marginTop: 12 }]}>
            Picks are private and stay locked for 7 days. Long-press a pick to change it after that.
          </Text>
        </ScrollView>
      )}

      <Sheet visible={picking} onClose={() => { setPicking(false); setQ(''); }} title="Pick someone" subtitle="Only people from your college" height="80%" scroll={false}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <SearchField value={q} onChangeText={setQ} placeholder="Search by name or username" autoFocus />
        </View>
        <FlatList
          data={results}
          keyExtractor={(u) => u._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          ListEmptyComponent={
            searching ? <SearchSkeleton />
              : q.trim().length >= 2 ? <Empty icon="search-outline" title="No one found" hint="Only students from your college show up here" />
                : <Text className="text-ink-3" style={[TYPE.sm, { textAlign: 'center', marginTop: 24 }]}>Type at least 2 letters to search</Text>
          }
          renderItem={renderResult}
        />
      </Sheet>
    </Screen>
  );
}
