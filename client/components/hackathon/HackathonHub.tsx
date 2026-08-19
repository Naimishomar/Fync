import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  RefreshControl,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/auth.context';

// ─── Layout constants ─────────────────────────────────────────────────────────
// Fixed pixel heights, not percentages of the screen. The banner used to be
// hp(28–35) and the header hp(35–45), so on a 6.1" phone a single card was
// taller than the viewport and you could never see two hackathons at once.
const GUTTER = 16;
const BANNER_H = 148;
const CARD_GAP = 14;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Hackathon {
  _id: string;
  title: string;
  bannerImage?: string;
  logo?: string;
  status: 'draft' | 'upcoming' | 'active' | 'judging' | 'completed';
  hackathonstarts: string;
  hackathonends: string;
  registrationstart: string;
  registrationends: string;
  prizepool?: string;
  prizes?: { rank: number; title: string; amount: string }[];
  tags?: string[];
  MaxTeamSize?: number;
  participants?: string[];
  organiser?: { _id: string; name: string; avatar?: string };
  sponsors?: { name: string; logo?: string; level: string }[];
  description?: string;
  myRole?: 'organiser' | 'participant' | 'team-member' | 'judge';
  myTeam?: { _id?: string; name?: string };
  mySubmission?: { _id?: string; status?: string };
}

// ─── Status config ────────────────────────────────────────────────────────────
// Semantic tokens from tailwind.config.js — success / info / warning / slate.
// The accent (brand-500) is reserved for interactive affordances, so it is
// deliberately not used as a status colour here.
const STATUS_META: Record<string, { label: string; chip: string; text: string; dot: string }> = {
  active: { label: 'Live', chip: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', dot: '#10b981' },
  upcoming: { label: 'Upcoming', chip: 'bg-blue-50 border-blue-100', text: 'text-blue-600', dot: '#3b82f6' },
  judging: { label: 'Judging', chip: 'bg-amber-50 border-amber-100', text: 'text-amber-600', dot: '#f59e0b' },
  completed: { label: 'Ended', chip: 'bg-slate-100 border-slate-200', text: 'text-slate-500', dot: '#94a3b8' },
  draft: { label: 'Draft', chip: 'bg-slate-100 border-slate-200', text: 'text-slate-500', dot: '#cbd5e1' },
};

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Live', value: 'active' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Judging', value: 'judging' },
  { label: 'Ended', value: 'completed' },
];

const TABS = [
  { label: 'Discover', value: 'discover', icon: 'compass-outline' },
  { label: 'My Hackathons', value: 'mine', icon: 'person-outline' },
];

const ROLE_LABEL: Record<string, string> = {
  organiser: 'Organiser',
  participant: 'Registered',
  'team-member': 'In a team',
  judge: 'Judging',
};

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

// ─── Hackathon Card ───────────────────────────────────────────────────────────
const HackathonCard = memo(
  ({
    item,
    width,
    isOrganiser,
    onOpen,
    onConsole,
  }: {
    item: Hackathon;
    width: number;
    isOrganiser: boolean;
    onOpen: (id: string) => void;
    onConsole: (h: Hackathon) => void;
  }) => {
    const status = STATUS_META[item.status] ?? STATUS_META.upcoming;
    const participants = item.participants?.length ?? 0;

    return (
      <View
        className="bg-white rounded-card overflow-hidden border border-slate-100"
        style={{
          width,
          marginBottom: CARD_GAP,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        <Pressable
          onPress={() => onOpen(item._id)}
          android_ripple={{ color: 'rgba(15,23,42,0.06)' }}
          style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
        >
          {/* Banner */}
          <View style={{ height: BANNER_H }} className="bg-slate-900">
            {item.bannerImage ? (
              <Image source={{ uri: item.bannerImage }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={['#1e293b', '#0f172a']}
                className="w-full h-full items-center justify-center"
              >
                <MaterialCommunityIcons name="code-braces" size={40} color="rgba(255,255,255,0.12)" />
              </LinearGradient>
            )}

            {/* Legibility scrim under the pills */}
            <LinearGradient
              colors={['rgba(15,23,42,0.55)', 'transparent', 'rgba(15,23,42,0.65)']}
              className="absolute inset-0"
            />

            {/* Status pill */}
            <View className="absolute top-3 left-3 flex-row items-center bg-white/95 px-2.5 py-1.5 rounded-lg">
              <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: status.dot }} />
              <Text className={`text-2xs font-bold ${status.text}`}>{status.label}</Text>
            </View>

            {/* My role, when this is one of mine */}
            {item.myRole ? (
              <View className="absolute top-3 right-3 bg-slate-900/80 px-2.5 py-1.5 rounded-lg">
                <Text className="text-2xs font-bold text-white">{ROLE_LABEL[item.myRole] ?? item.myRole}</Text>
              </View>
            ) : null}

            {/* Prize pool */}
            {item.prizepool ? (
              <View className="absolute bottom-3 left-3 flex-row items-center">
                <Ionicons name="trophy" size={13} color="#fdba74" />
                <Text className="text-white text-sm font-bold ml-1.5">{item.prizepool}</Text>
                <Text className="text-white/60 text-2xs font-semibold ml-1.5">prize pool</Text>
              </View>
            ) : null}
          </View>

          {/* Body */}
          <View style={{ padding: 14 }}>
            {/* Organiser + dates */}
            <View className="flex-row items-center justify-between mb-2.5">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 items-center justify-center overflow-hidden mr-2">
                  {item.logo ? (
                    <Image source={{ uri: item.logo }} className="w-full h-full" resizeMode="contain" />
                  ) : (
                    <MaterialCommunityIcons name="domain" size={14} color="#94a3b8" />
                  )}
                </View>
                <Text className="text-slate-500 text-2xs font-semibold flex-1" numberOfLines={1}>
                  {item.organiser?.name || 'Fync'}
                </Text>
              </View>
              <View className="flex-row items-center bg-slate-50 px-2 py-1 rounded-md">
                <Feather name="calendar" size={11} color="#64748b" />
                <Text className="text-slate-600 text-2xs font-semibold ml-1">
                  {fmtDate(item.hackathonstarts)} – {fmtDate(item.hackathonends)}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text className="text-slate-900 text-lg font-extrabold leading-6 mb-2.5" numberOfLines={2}>
              {item.title}
            </Text>

            {/* Meta */}
            <View className="flex-row items-center mb-3">
              <Feather name="users" size={12} color="#94a3b8" />
              <Text className="text-slate-500 text-2xs font-semibold ml-1.5">
                {participants} registered
              </Text>
              {item.MaxTeamSize ? (
                <>
                  <View className="w-1 h-1 rounded-full bg-slate-300 mx-2" />
                  <Text className="text-slate-500 text-2xs font-semibold">
                    Teams of {item.MaxTeamSize}
                  </Text>
                </>
              ) : null}
            </View>

            {/* Tags */}
            {item.tags?.length ? (
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {item.tags.slice(0, 3).map((tag, i) => (
                  <View key={`${tag}-${i}`} className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
                    <Text className="text-2xs text-slate-500 font-semibold">{tag}</Text>
                  </View>
                ))}
                {item.tags.length > 3 ? (
                  <View className="px-2 py-1">
                    <Text className="text-2xs text-slate-400 font-semibold">+{item.tags.length - 3}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>

        {/* Organiser console lives inside the card, as a footer action. It used
            to be a detached sibling button floating between cards. */}
        {isOrganiser ? (
          <TouchableOpacity
            onPress={() => onConsole(item)}
            className="flex-row items-center justify-center border-t border-slate-100 py-3"
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="view-dashboard-outline" size={15} color="#f97316" />
            <Text className="text-brand-600 text-2xs font-bold ml-2">Open organiser console</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
);
HackathonCard.displayName = 'HackathonCard';

// ─── List header ──────────────────────────────────────────────────────────────
// Declared at module scope on purpose. It used to be an inline arrow passed to
// ListHeaderComponent, which makes React see a brand-new component type on
// every render and remount the subtree — so the search field lost focus after
// each keystroke and you could only ever type one character.
const ListHeader = memo(
  ({
    search,
    onSearch,
    view,
    onView,
    activeFilter,
    onFilter,
    onCreate,
  }: {
    search: string;
    onSearch: (v: string) => void;
    view: 'discover' | 'mine';
    onView: (v: 'discover' | 'mine') => void;
    activeFilter: string;
    onFilter: (v: string) => void;
    onCreate: () => void;
  }) => (
    <View style={{ paddingTop: 8 }}>
      {/* Title row */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1 mr-3">
          <Text className="text-slate-900 text-2xl font-extrabold">
            Hackathon <Text className="text-brand-500">Hub</Text>
          </Text>
          <Text className="text-slate-500 text-2xs font-semibold mt-0.5">
            Build, team up and ship
          </Text>
        </View>
        <TouchableOpacity
          onPress={onCreate}
          className="flex-row items-center bg-slate-900 px-3.5 py-2.5 rounded-xl"
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={15} color="#f97316" />
          <Text className="text-white text-2xs font-bold ml-1">Host</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="flex-row items-center bg-white rounded-xl border border-slate-200 px-3 mb-3" style={{ height: 44 }}>
        <Feather name="search" size={16} color="#94a3b8" />
        <TextInput
          placeholder="Search hackathons or tags"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={onSearch}
          returnKeyType="search"
          autoCorrect={false}
          className="flex-1 ml-2 text-slate-900 text-sm"
          style={{ paddingVertical: 0 }}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => onSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color="#cbd5e1" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Discover / Mine */}
      <View className="flex-row bg-slate-100 rounded-xl p-1 mb-3">
        {TABS.map((t) => {
          const on = view === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => onView(t.value as 'discover' | 'mine')}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${on ? 'bg-white' : ''}`}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon as any} size={14} color={on ? '#f97316' : '#94a3b8'} />
              <Text className={`ml-1.5 text-2xs font-bold ${on ? 'text-slate-900' : 'text-slate-500'}`}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status filters — hidden in "mine", where they did nothing but sat at
          30% opacity taking up a row of vertical space. */}
      {view === 'discover' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {FILTERS.map((f) => {
            const on = activeFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value || 'all'}
                onPress={() => onFilter(f.value)}
                className={`px-3.5 py-2 rounded-lg border ${
 on ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'
 }`}
                activeOpacity={0.8}
              >
                <Text className={`text-2xs font-bold ${on ? 'text-white' : 'text-slate-600'}`}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ height: 4 }} />
      )}
    </View>
  )
);
ListHeader.displayName = 'ListHeader';

// ─── Main Screen ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const HackathonHub = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - GUTTER * 2;

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [view, setView] = useState<'discover' | 'mine'>('discover');

  // Every fetch stamps the request it belongs to. The old code guarded with
  // `if (loading) return`, which silently dropped a filter change that landed
  // while the previous page was still in flight — the list then showed results
  // for a filter that was no longer selected.
  const reqId = useRef(0);

  const load = useCallback(
    async (opts: { pageNum: number; status: string; scope: 'discover' | 'mine'; append: boolean }) => {
      const id = ++reqId.current;
      if (opts.append) setLoadingMore(true);
      else setLoading(true);

      try {
        let data: Hackathon[] = [];
        let more = false;

        if (opts.scope === 'mine') {
          const res = await axios.get('/hackathons/my');
          data = res.data.hackathons ?? [];
        } else {
          const payload: any = { page: opts.pageNum, limit: PAGE_SIZE };
          if (opts.status) payload.status = opts.status;
          const res = await axios.post('/hackathons/list', payload);
          data = res.data.hackathons ?? [];
          more = data.length === PAGE_SIZE;
        }

        if (id !== reqId.current) return; // a newer request superseded this one

        setHackathons((prev) => (opts.append ? [...prev, ...data] : data));
        setPage(opts.pageNum);
        setHasMore(more);
      } catch {
        if (id !== reqId.current) return;
        Toast.show({
          type: 'error',
          text1: opts.scope === 'mine' ? 'Could not load your hackathons' : 'Could not load hackathons',
        });
        if (!opts.append) setHackathons([]);
        setHasMore(false);
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    load({ pageNum: 1, status: activeFilter, scope: view, append: false });
  }, [view, activeFilter, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ pageNum: 1, status: activeFilter, scope: view, append: false });
  }, [load, activeFilter, view]);

  const onEndReached = useCallback(() => {
    // Searching filters the pages already loaded, so paging further while a
    // query is active just appends rows the filter will hide.
    if (view === 'mine' || !hasMore || loading || loadingMore || search) return;
    load({ pageNum: page + 1, status: activeFilter, scope: view, append: true });
  }, [view, hasMore, loading, loadingMore, search, page, activeFilter, load]);

  const openDetail = useCallback(
    (id: string) => navigation.navigate('HackathonDetail', { hackathonId: id }),
    [navigation]
  );
  const openConsole = useCallback(
    (h: Hackathon) =>
      navigation.navigate('HackathonDashboard', { hackathonId: h._id, hackathonTitle: h.title }),
    [navigation]
  );
  const openCreate = useCallback(() => navigation.navigate('HackathonCreate'), [navigation]);

  const onFilter = useCallback((v: string) => setActiveFilter(v), []);
  const onView = useCallback((v: 'discover' | 'mine') => setView(v), []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? hackathons.filter(
        (h) =>
          h.title?.toLowerCase().includes(q) ||
          h.tags?.some((t) => t.toLowerCase().includes(q))
      )
    : hackathons;

  const isOrganiserOf = (h: Hackathon) =>
    h.myRole === 'organiser' || (!!user?._id && h.organiser?._id === user._id);

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView className="flex-1" edges={['top']}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <HackathonCard
              item={item}
              width={cardWidth}
              isOrganiser={isOrganiserOf(item)}
              onOpen={openDetail}
              onConsole={openConsole}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" colors={['#f97316']} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={
            <ListHeader
              search={search}
              onSearch={setSearch}
              view={view}
              onView={onView}
              activeFilter={activeFilter}
              onFilter={onFilter}
              onCreate={openCreate}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color="#f97316" />
              </View>
            ) : (
              <View style={{ height: 8 }} />
            )
          }
          ListEmptyComponent={
            loading ? (
              <View className="py-20 items-center">
                <ActivityIndicator size="large" color="#f97316" />
              </View>
            ) : (
              <View className="items-center px-8" style={{ paddingTop: 56 }}>
                <View className="w-16 h-16 rounded-2xl bg-white border border-slate-100 items-center justify-center mb-4">
                  <MaterialCommunityIcons name="rocket-launch-outline" size={28} color="#cbd5e1" />
                </View>
                <Text className="text-slate-900 text-base font-bold text-center mb-1">
                  {search
                    ? 'No matches'
                    : view === 'mine'
                    ? 'Nothing here yet'
                    : 'No hackathons yet'}
                </Text>
                <Text className="text-slate-500 text-2xs font-semibold text-center leading-4">
                  {search
                    ? `Nothing matches “${search}”.`
                    : view === 'mine'
                    ? 'Hackathons you host, join or judge will show up here.'
                    : 'Check back soon, or host the first one.'}
                </Text>
                {!search && view === 'discover' ? (
                  <TouchableOpacity
                    onPress={openCreate}
                    className="flex-row items-center bg-slate-900 px-4 py-3 rounded-xl mt-5"
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="plus" size={15} color="#f97316" />
                    <Text className="text-white text-2xs font-bold ml-1.5">Host a hackathon</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
};

export default HackathonHub;
