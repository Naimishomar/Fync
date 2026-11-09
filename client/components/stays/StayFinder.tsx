import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { C } from '../../constants/colors';
import { useBottomInset } from '../../constants/layout';
import { AppBar, Badge, Button, Chip, Empty, FilterChips, IconBtn, Label, Screen, SegmentedTabs, Tag, TagRow } from '../ui/kit';
import Skeleton from '../Skeleton';
import { TYPE } from '../../constants/type';
import { ActionSheet, Sheet, type SheetAction } from '../ui/Sheet';
import { Alert } from '../ui/AlertModal';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { PressScale, enterAt, tick } from '../ui/motion';

// Labels shared with StayDetail / StayForm. Keys mirror backend/utils/stayRules.js.
export const KIND_LABEL = { pg: 'PG', flat: 'Flat', roommate: 'Roommate' } as const;
export type Kind = keyof typeof KIND_LABEL;
export const GENDER_LABEL = { any: 'Anyone', male: 'Boys', female: 'Girls' } as const;
export const FOOD_LABEL = { none: 'No food', veg: 'Veg', nonveg: 'Non-veg', both: 'Veg + non-veg' } as const;
export const AMENITY_LABEL: Record<string, string> = {
  wifi: 'Wi-Fi', ac: 'AC', laundry: 'Laundry', food: 'Meals', 'power-backup': 'Power backup', parking: 'Parking',
  gym: 'Gym', 'attached-bathroom': 'Attached bath', furnished: 'Furnished', housekeeping: 'Housekeeping',
};
export const HABIT_LABEL: Record<string, string> = {
  'early-bird': 'Early bird', 'night-owl': 'Night owl', 'non-smoker': 'Non-smoker', clean: 'Clean', studious: 'Studious', social: 'Social',
};
export const rupees = (n?: number | null) => (n == null ? '' : `₹${n.toLocaleString('en-IN')}`);
export const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
/** " · 1.2 km<suffix>", " · near college" under 0.5 km ("0 km" read like a bug), "" when unknown. */
export const distanceText = (km: number | null | undefined, suffix = '') =>
  km == null ? '' : km < 0.5 ? ' · near college' : ` · ${km} km${suffix}`;
export const expiresText = (iso: string) => { const d = daysLeft(iso); return d <= 1 ? 'Expires today' : `Expires in ${d}d`; };

export type StayCard = {
  _id: string; kind: Kind; title: string; rent: number; area: string; distanceKm?: number | null;
  forGender: keyof typeof GENDER_LABEL; food: keyof typeof FOOD_LABEL; amenities: string[];
  status: 'active' | 'filled'; expiresAt: string; photo: string | null; renewed?: boolean;
};

const KINDS = ['all', 'pg', 'flat', 'roommate'] as const;
type KindTab = (typeof KINDS)[number];
const KIND_TABS = { all: 'All', ...KIND_LABEL };
const BUDGETS = ['any', '5000', '8000', '12000', '20000'] as const;
const BUDGET_LABEL = { any: 'Any', 5000: 'Under ₹5k', 8000: 'Under ₹8k', 12000: 'Under ₹12k', 20000: 'Under ₹20k' };
const GENDERS = ['any', 'male', 'female'] as const;
const FOODS = ['any', 'veg', 'nonveg'] as const;
type Filters = { budget: (typeof BUDGETS)[number]; gender: (typeof GENDERS)[number]; food: (typeof FOODS)[number]; amenities: string[] };
const NO_FILTERS: Filters = { budget: 'any', gender: 'any', food: 'any', amenities: [] };

export const StayRow = memo(function StayRow({ stay, index, onOpen }: { stay: StayCard; index: number; onOpen: (id: string) => void }) {
  return (
    <Animated.View entering={enterAt(index)}>
      <PressScale onPress={() => onOpen(stay._id)} accessibilityRole="button"
        accessibilityLabel={`${KIND_LABEL[stay.kind]}: ${stay.title}, ${rupees(stay.rent)} a month, ${stay.area}`}
        style={{ backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 16, marginBottom: 12, overflow: 'hidden', flexDirection: 'row' }}>
        <ProgressiveImage path={stay.photo} thumbOnly style={{ width: 104, minHeight: 112 }} accessible={false} />
        <View style={{ flex: 1, padding: 12, gap: 4 }}>
          <Text className="text-ink-3 font-semibold" style={TYPE.caption} numberOfLines={1}>
            {KIND_LABEL[stay.kind]} · {GENDER_LABEL[stay.forGender]}{stay.status === 'filled' ? ' · Filled' : ''}
          </Text>
          <Text className="text-ink" style={TYPE.heading} numberOfLines={1}>{stay.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="location-outline" size={13} color={C.ink3} />
            <Text className="text-ink-2" style={[TYPE.sm, { flexShrink: 1 }]} numberOfLines={1}>{stay.area}{distanceText(stay.distanceKm)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 'auto' }}>
            <Text className="text-ink font-display" style={{ fontSize: 17 }} numberOfLines={1}>{rupees(stay.rent)}<Text className="text-ink-3" style={TYPE.caption}>/mo</Text></Text>
            <View style={{ flex: 1, minWidth: 8 }} />
            <Text className="text-ink-3" style={TYPE.micro} numberOfLines={1}>{expiresText(stay.expiresAt)}</Text>
          </View>
        </View>
      </PressScale>
    </Animated.View>
  );
});

/** First-load placeholder in the footprint of the tabs, chips and StayRow cards. */
const StaySkeleton = () => (
  <View style={{ paddingHorizontal: 20 }}>
    <Skeleton lightMode height={44} borderRadius={22} />
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 }}>
      {[96, 80, 88].map((w) => <Skeleton key={w} lightMode width={w} height={36} borderRadius={18} />)}
    </View>
    {[0, 1, 2, 3].map((i) => <Skeleton key={i} lightMode height={112} borderRadius={16} style={{ marginBottom: 12 }} />)}
  </View>
);

/** PG & Roommates: students list PGs, flats and roommate spots near their own college. */
export default function StayFinder() {
  const navigation = useNavigation<any>();
  const { user } = useAuth() as any;
  const bottom = useBottomInset();
  const [kind, setKind] = useState<KindTab>('all');
  const sort = 'newest';
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [stays, setStays] = useState<StayCard[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [mine, setMine] = useState<StayCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadingMore = useRef(false);
  const college = user?.college || 'your college';

  const params = useMemo(() => ({
    kind: kind === 'all' ? undefined : kind, sort,
    maxRent: filters.budget === 'any' ? undefined : filters.budget,
    gender: filters.gender === 'any' ? undefined : filters.gender,
    food: filters.food === 'any' ? undefined : filters.food,
    amenities: filters.amenities.length ? filters.amenities.join(',') : undefined,
    noCache: true,
  }), [kind, sort, filters]);

  const load = useCallback(async () => {
    try {
      const [res, my] = await Promise.all([
        axios.get('/stays', { params }),
        axios.get('/stays/mine', { params: { noCache: true } }).catch(() => null),
      ]);
      setStays(res.data?.stays || []);
      setNext(res.data?.next ?? null);
      if (my) setMine(my.data?.stays || []);
      setFailed(false);
    } catch {
      setFailed(true);
      setStays((s) => s ?? []);
    }
  }, [params]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const more = async () => {
    if (!next || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const res = await axios.get('/stays', { params: { ...params, cursor: next } });
      setStays((s) => [...(s || []), ...(res.data?.stays || [])]);
      setNext(res.data?.next ?? null);
    } catch { /* keep what we have */ }
    loadingMore.current = false;
  };

  const open = useCallback((id: string) => navigation.navigate('StayDetail', { id }), [navigation]);
  const renderItem = useCallback(({ item, index }: { item: StayCard; index: number }) => <StayRow stay={item} index={index} onOpen={open} />, [open]);
  const create = () => navigation.navigate('StayForm', {});
  const activeFilters = (filters.budget !== 'any' ? 1 : 0) + (filters.gender !== 'any' ? 1 : 0) + (filters.food !== 'any' ? 1 : 0) + filters.amenities.length;

  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); tick(); Toast.show({ type: 'success', text1: ok }); load(); } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Something went wrong' });
    }
  };
  // One sheet for all my-listing rows: a row sets the target, the sheet builds from it.
  const [manageTarget, setManageTarget] = useState<StayCard | null>(null);
  const manage = setManageTarget;
  const t = manageTarget;
  const manageActions: SheetAction[] = !t ? [] : [
    { label: 'Edit', icon: 'create-outline', onPress: () => navigation.navigate('StayForm', { id: t._id }) },
    t.status === 'active'
      ? { label: 'Mark as filled', icon: 'checkmark-done-outline', onPress: () => act(() => axios.patch(`/stays/${t._id}`, { status: 'filled' }), 'Marked as filled') }
      : { label: 'Mark as available', icon: 'refresh-outline', onPress: () => act(() => axios.patch(`/stays/${t._id}`, { status: 'active' }), 'Listed again') },
    ...(!t.renewed ? [{ label: 'Renew 30 days', icon: 'time-outline' as const, onPress: () => act(() => axios.post(`/stays/${t._id}/renew`), 'Renewed for 30 more days') }] : []),
    {
      label: 'Delete', icon: 'trash-outline', danger: true, onPress: () => Alert.alert('Delete this listing?', 'Photos are deleted too.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => act(() => axios.delete(`/stays/${t._id}`), 'Listing deleted') },
      ]),
    },
  ];

  const header = (
    <View>
      {mine.length ? (
        <View style={{ marginBottom: 16 }}>
          <Text className="text-ink" style={[TYPE.heading, { marginBottom: 8 }]} accessibilityRole="header">My listings · {mine.length}</Text>
          {mine.map((s) => (
            <PressScale key={s._id} onPress={() => manage(s)} accessibilityRole="button" accessibilityLabel={`Manage ${s.title}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, marginBottom: 8,
                borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
              <View style={{ flex: 1 }}>
                <Text className="text-ink font-semibold" numberOfLines={1}>{s.title}</Text>
                <Text className="text-ink-3" style={TYPE.caption} numberOfLines={1}>
                  {s.status === 'filled' ? 'Filled' : 'Live'} · {expiresText(s.expiresAt)}{s.renewed ? ' · renewed' : ''}
                </Text>
              </View>
              <IconBtn name="ellipsis-horizontal" accessibilityLabel={`Options for ${s.title}`} onPress={() => manage(s)} />
            </PressScale>
          ))}
        </View>
      ) : null}
      {/* Type tabs + filters on one row; listings are always newest first. */}
      <View className="flex-row items-center" style={{ gap: 8, marginBottom: 12 }}>
        <SegmentedTabs items={KINDS} value={kind} onChange={(v) => { tick(); setKind(v); }} labels={KIND_TABS} style={{ flex: 1 }} />
        <View>
          <IconBtn name="options-outline" boxed color={activeFilters ? C.accentText : C.ink2}
            onPress={() => { setDraft(filters); setSheet(true); }}
            accessibilityLabel={activeFilters ? `Filters, ${activeFilters} on` : 'Filters'} />
          {activeFilters ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: -2, right: -2 }}><Badge value={activeFilters} tone={C.brand[500]} /></View>
          ) : null}
        </View>
      </View>
    </View>
  );

  const setD = (p: Partial<Filters>) => setDraft((d) => ({ ...d, ...p }));
  const toggleAmenity = (a: string) => setD({ amenities: draft.amenities.includes(a) ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a] });

  return (
    <Screen>
      <AppBar title="PG & Roommates" onBack={() => navigation.goBack()} />
      {!stays ? (
        <StaySkeleton />
      ) : (
        <FlatList
          data={stays}
          keyExtractor={(s) => s._id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={failed ? (
            <Empty icon="cloud-offline-outline" title="Couldn't load listings" hint="Check your connection and try again"
              action={<Button title="Retry" variant="primary" onPress={load} />} />
          ) : (
            <Empty art="assets/House with garden/3D/house_with_garden_3d.png"
              title={kind === 'all' && !activeFilters ? `Be the first to list a PG near ${college}` : 'Nothing matches these filters'}
              hint={kind === 'all' && !activeFilters ? 'Rooms, flats and roommate spots from students at your college' : 'Try a higher budget or fewer filters'}
              action={kind === 'all' && !activeFilters
                ? <Button title="List a place" variant="primary" onPress={create} />
                : <Button title="Clear filters" onPress={() => { setKind('all'); setFilters(NO_FILTERS); }} />} />
          )}
          onEndReached={more}
          onEndReachedThreshold={0.5}
          ListFooterComponent={next ? <ActivityIndicator color={C.brand[500]} style={{ marginVertical: 16 }} /> : null}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 88 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.brand[500]} colors={[C.brand[500]]}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        />
      )}

      {stays && (stays.length > 0 || mine.length > 0) ? (
        <View style={{ position: 'absolute', right: 20, bottom: bottom + 16 }}>
          <Button title="List a place" icon="add" variant="primary" onPress={create} />
        </View>
      ) : null}

      <ActionSheet visible={!!t} onClose={() => setManageTarget(null)} icon="home-outline"
        title={t?.title} subtitle={t ? expiresText(t.expiresAt) : undefined} actions={manageActions} />

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Filters"
        footer={<View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="Reset" style={{ flex: 1 }} onPress={() => setDraft(NO_FILTERS)} />
          <Button title="Show places" variant="primary" style={{ flex: 2 }} onPress={() => { setFilters(draft); setSheet(false); }} />
        </View>}>
        <Label style={{ marginBottom: 8 }}>Budget per month</Label>
        <FilterChips items={BUDGETS} value={draft.budget} onChange={(v) => setD({ budget: v })} labels={BUDGET_LABEL} style={{ marginBottom: 16 }} />
        <Label style={{ marginBottom: 8 }}>For</Label>
        <FilterChips items={GENDERS} value={draft.gender} onChange={(v) => setD({ gender: v })} labels={GENDER_LABEL} style={{ marginBottom: 16 }} />
        <Label style={{ marginBottom: 8 }}>Food</Label>
        <FilterChips items={FOODS} value={draft.food} onChange={(v) => setD({ food: v })} labels={{ any: 'Any', veg: 'Veg', nonveg: 'Non-veg' }} style={{ marginBottom: 16 }} />
        <Label style={{ marginBottom: 8 }}>Must have</Label>
        <TagRow>
          {Object.keys(AMENITY_LABEL).map((a) => (
            <Chip key={a} label={AMENITY_LABEL[a]} active={draft.amenities.includes(a)} onPress={() => toggleAmenity(a)} />
          ))}
        </TagRow>
      </Sheet>
    </Screen>
  );
}

/** Amenity pills, read-only. */
export const AmenityTags = ({ items }: { items: string[] }) => (
  <TagRow>{items.map((a) => <Tag key={a} label={AMENITY_LABEL[a] || a} />)}</TagRow>
);
