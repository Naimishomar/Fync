import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { artUrl } from '../../constants/features';
import { useBottomInset } from '../../constants/layout';
import Avatar from '../Avatar';
import { AppBar, Button, Chip, ChipRow, Empty, FilterChips, IconBtn, Screen } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { FormField } from '../ui/Field';
import { PressScale, buzz, enterAt, tick } from '../ui/motion';
import Animated from 'react-native-reanimated';

export const PINK = '#db2777';
export const CATS = {
  movie: { emoji: '🎬', label: 'Movie night' },
  potluck: { emoji: '🍲', label: 'Potluck' },
  sports: { emoji: '🏏', label: 'Sports' },
  jam: { emoji: '🎸', label: 'Music jam' },
  games: { emoji: '🎲', label: 'Games night' },
  chai: { emoji: '☕', label: 'Chill / chai' },
  study: { emoji: '📚', label: 'Study + snacks' },
  other: { emoji: '✨', label: 'Other' },
} as const;
export type Cat = keyof typeof CATS;
const CAT_KEYS = Object.keys(CATS) as Cat[];
const FILTERS = ['all', ...CAT_KEYS] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABELS = Object.fromEntries([['all', 'All'], ...CAT_KEYS.map((k) => [k, `${CATS[k].emoji} ${CATS[k].label}`])]) as Record<Filter, string>;

type U = { _id: string; name?: string; username?: string; avatar?: string };
type PlanCard = {
  _id: string; title: string; category: Cat; place: string; startsAt: string;
  capacity: number; going: number; host: U; faces: U[]; status: 'host' | 'going' | null;
};

const HOUR = 3600000;
const IST = 5.5 * HOUR;
/** Start of this IST Sunday (today if it is Sunday), as epoch ms. Mirrors backend/utils/sundayPlanRules.js. */
export const sundayStart = (now = Date.now()) => {
  const ist = new Date(now + IST);
  const dayStart = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST;
  return dayStart + ((7 - ist.getUTCDay()) % 7) * 24 * HOUR;
};
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

const countdown = (now: number) => {
  const ms = sundayStart(now) - now;
  if (ms <= 0) return "It's Sunday! Plans are on today";
  const d = Math.floor(ms / (24 * HOUR));
  const h = Math.floor((ms % (24 * HOUR)) / HOUR);
  const m = Math.floor((ms % HOUR) / 60000);
  return `Sunday in ${d ? `${d}d ` : ''}${h}h ${m}m`;
};

const PRESETS = [11, 16, 19, 21];
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const BLANK = { title: '', place: '', description: '', category: 'chai' as Cat, hour: 16, custom: false, capacity: 10, bring: [] as string[], item: '' };

const AvatarStack = memo(function AvatarStack({ faces }: { faces: U[] }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {faces.map((u, i) => (
        <View key={u._id} style={{ marginLeft: i ? -8 : 0, borderRadius: 99, borderWidth: 2, borderColor: C.card }}>
          <Avatar user={u} size={24} showBadge={false} />
        </View>
      ))}
    </View>
  );
});

const PlanRow = memo(function PlanRow({ plan, index, onOpen }: { plan: PlanCard; index: number; onOpen: (id: string) => void }) {
  const cat = CATS[plan.category] || CATS.other;
  const full = plan.going >= plan.capacity;
  return (
    <Animated.View entering={enterAt(index)}>
      <PressScale onPress={() => onOpen(plan._id)} accessibilityRole="button"
        accessibilityLabel={`${plan.title}, ${cat.label}, ${fmtTime(plan.startsAt)} at ${plan.place}, ${plan.going} of ${plan.capacity} going`}
        style={{ backgroundColor: C.card, borderColor: plan.status ? PINK : C.line, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>{cat.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text className="text-ink font-semibold" style={{ fontSize: 16 }} numberOfLines={1}>{plan.title}</Text>
            <Text className="text-ink-3" style={{ fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {fmtTime(plan.startsAt)} · {plan.place}
            </Text>
          </View>
          {plan.status ? (
            <Text style={{ color: PINK, fontSize: 12, fontWeight: '600' }}>{plan.status === 'host' ? 'Hosting' : 'Going ✓'}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <AvatarStack faces={plan.faces} />
          <Text style={{ fontSize: 13, color: full ? C.danger : C.ink2, fontWeight: '600' }}>
            {plan.going}/{plan.capacity} going{full ? ' · full' : ''}
          </Text>
          <View style={{ flex: 1 }} />
          <Text className="text-ink-3" style={{ fontSize: 12 }} numberOfLines={1}>by {plan.host?.name?.split(' ')[0] || 'someone'}</Text>
        </View>
      </PressScale>
    </Animated.View>
  );
});

/** Sunday Plans: free/potluck Sunday hangouts hosted by students, for their own college. */
export default function SundayPlans() {
  const navigation = useNavigation<any>();
  const bottom = useBottomInset();
  const [plans, setPlans] = useState<PlanCard[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hosting, setHosting] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/plans', { params: { noCache: true } });
      setPlans(res.data?.plans || []);
    } catch {
      setPlans((p) => p ?? []);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  const shown = useMemo(() => (plans || []).filter((p) => filter === 'all' || p.category === filter), [plans, filter]);
  const open = useCallback((id: string) => navigation.navigate('PlanDetail', { id }), [navigation]);
  const set = (patch: Partial<typeof BLANK>) => setForm((f) => ({ ...f, ...patch }));

  const sunday = sundayStart(now);
  const isPast = (h: number) => sunday + h * HOUR <= now;

  const addItem = () => {
    const it = form.item.trim().slice(0, 24);
    if (!it || form.bring.includes(it) || form.bring.length >= 8) return set({ item: '' });
    set({ bring: [...form.bring, it], item: '' });
  };

  const submit = async () => {
    if (isPast(form.hour)) return Toast.show({ type: 'error', text1: 'That time has already passed' });
    setSaving(true);
    try {
      const res = await axios.post('/plans', {
        title: form.title, place: form.place, description: form.description, category: form.category,
        capacity: form.capacity, bring: form.bring, startsAt: new Date(sunday + form.hour * HOUR).toISOString(),
      });
      buzz();
      setHosting(false); setForm(BLANK);
      Toast.show({ type: 'success', text1: 'Plan is live 🎉', text2: 'Your college can see it now' });
      load();
      if (res.data?.plan?._id) open(res.data.plan._id);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not create plan' });
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View>
      <View className="rounded-2xl overflow-hidden mb-4" style={{ backgroundColor: PINK }}>
        <View className="p-5 flex-row items-center">
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text className="font-display" style={{ color: '#fff', fontSize: 24, lineHeight: 30 }}>Sunday Plans 🎉</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18, marginTop: 6 }}>
              Free hangouts by students in your college. Movie nights, potlucks, jams.
            </Text>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 10 }}>{countdown(now)}</Text>
          </View>
          <Image source={{ uri: artUrl('assets/Confetti ball/3D/confetti_ball_3d.png') }} style={{ width: 72, height: 72 }} contentFit="contain" />
        </View>
      </View>
      <FilterChips items={FILTERS} value={filter} onChange={(v) => { tick(); setFilter(v); }} labels={FILTER_LABELS} style={{ marginBottom: 12 }} />
    </View>
  );

  return (
    <Screen>
      <AppBar title="Sunday Plans" onBack={() => navigation.goBack()} />
      {!plans ? (
        <ActivityIndicator color={PINK} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p._id}
          renderItem={({ item, index }) => <PlanRow plan={item} index={index} onOpen={open} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Empty icon="calendar-outline" art="assets/Party popper/3D/party_popper_3d.png"
              title={filter === 'all' ? 'No plans yet this Sunday' : 'Nothing in this vibe yet'}
              hint="Be the one who makes Sunday happen"
              action={<Button title="Host the first plan" variant="primary" onPress={() => setHosting(true)} />} />
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 88 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={PINK} colors={[PINK]}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        />
      )}

      {plans && plans.length > 0 ? (
        <View style={{ position: 'absolute', right: 20, bottom: bottom + 16 }}>
          <Button title="Host a plan" icon="add" variant="primary" onPress={() => setHosting(true)} />
        </View>
      ) : null}

      <Sheet visible={hosting} onClose={() => setHosting(false)} title="Host a Sunday plan" subtitle="Free or potluck, for your college only" height="90%"
        footer={<Button title="Post plan" variant="primary" block loading={saving}
          disabled={form.title.trim().length < 3 || form.place.trim().length < 2} onPress={submit} />}>
        <FormField label="What's the plan?" value={form.title} onChangeText={(t) => set({ title: t })} maxLength={60} placeholder="Movie night: 3 Idiots" />
        <Text className="text-ink-3 font-semibold" style={{ fontSize: 13, marginBottom: 8 }}>Vibe</Text>
        <ChipRow style={{ marginBottom: 16 }}>
          {CAT_KEYS.map((k) => (
            <Chip key={k} label={`${CATS[k].emoji} ${CATS[k].label}`} active={form.category === k} onPress={() => set({ category: k })} />
          ))}
        </ChipRow>
        <FormField label="Where?" value={form.place} onChangeText={(t) => set({ place: t })} maxLength={80} placeholder="Hostel B terrace"
          hint="Keep it to common areas. No room numbers." />
        <Text className="text-ink-3 font-semibold" style={{ fontSize: 13, marginBottom: 8 }}>When on Sunday?</Text>
        <ChipRow style={{ marginBottom: form.custom ? 8 : 16 }}>
          {PRESETS.map((h) => (
            <Chip key={h} label={hourLabel(h)} active={!form.custom && form.hour === h} onPress={() => set({ hour: h, custom: false })} />
          ))}
          <Chip label="Custom" active={form.custom} onPress={() => set({ custom: true })} />
        </ChipRow>
        {form.custom ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            {Array.from({ length: 17 }, (_, i) => i + 7).map((h) => (
              <Chip key={h} label={hourLabel(h)} active={form.hour === h} onPress={() => set({ hour: h })} />
            ))}
          </ScrollView>
        ) : null}
        {isPast(form.hour) ? <Text style={{ color: C.danger, fontSize: 12, marginTop: -8, marginBottom: 12 }}>That time has already passed today</Text> : null}
        <Text className="text-ink-3 font-semibold" style={{ fontSize: 13, marginBottom: 8 }}>How many people (including you)?</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <IconBtn name="remove" boxed accessibilityLabel="Fewer people" disabled={form.capacity <= 2} onPress={() => set({ capacity: form.capacity - 1 })} />
          <Text className="text-ink font-display" style={{ fontSize: 24, minWidth: 40, textAlign: 'center' }}>{form.capacity}</Text>
          <IconBtn name="add" boxed accessibilityLabel="More people" disabled={form.capacity >= 50} onPress={() => set({ capacity: form.capacity + 1 })} />
        </View>
        <FormField label="Bring list (optional)" value={form.item} onChangeText={(t) => set({ item: t })} maxLength={24}
          placeholder={form.bring.length >= 8 ? 'Up to 8 items' : 'chips, speaker… then press add'} editable={form.bring.length < 8}
          onSubmitEditing={addItem} returnKeyType="done" submitBehavior="submit"
          right={<Pressable onPress={addItem} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add item" className="active:opacity-85">
            <Ionicons name="add-circle" size={24} color={PINK} />
          </Pressable>} />
        {form.bring.length ? (
          <ChipRow style={{ marginBottom: 16 }}>
            {form.bring.map((b) => (
              <Chip key={b} label={`${b}  ✕`} onPress={() => set({ bring: form.bring.filter((x) => x !== b) })} />
            ))}
          </ChipRow>
        ) : null}
        <FormField label="Details (optional)" value={form.description} onChangeText={(t) => set({ description: t })} maxLength={300} multiline
          placeholder="What to expect, what's provided…" />
      </Sheet>
    </Screen>
  );
}
