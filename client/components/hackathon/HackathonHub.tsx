import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  RefreshControl,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C } from '../../constants/colors';
import { Image } from 'expo-image';
import { AppBar } from '../ui/kit';

// ─── Layout constants ─────────────────────────────────────────────────────────
// Fixed pixel heights, not percentages of the screen. The banner used to be
// hp(28–35) and the header hp(35–45), so on a 6.1" phone a single card was
// taller than the viewport and you could never see two hackathons at once.
const GUTTER = 20;
const BANNER_H = 148;
const CARD_GAP = 14;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Hackathon {
  _id: string;
  title: string;
  bannerImage?: string;
  logo?: string;
  status: 'draft' | 'upcoming' | 'active' | 'completed';
  hackathonstarts: string;
  hackathonends: string;
  registrationstart: string;
  registrationends: string;
  prizepool?: string;
  prizes?: { rank: number; title: string; amount: string }[];
  tags?: string[];
  applyLink?: string;
  applyLabel?: string;
  mode?: string;
  location?: string;
  teamSize?: string;
  winners?: { rank: number }[];
  isDraft?: boolean;
  organiser?: { _id: string; name: string; avatar?: string };
  sponsors?: { name: string; logo?: string; level: string }[];
  description?: string;
  myRole?: 'organiser' | 'winner';
  myWin?: { rank?: number; title?: string; amount?: string } | null;
}

// ─── Status config ────────────────────────────────────────────────────────────
// Semantic tokens from tailwind.config.js — success / info / warning / slate.
// The accent (brand-500) is reserved for interactive affordances, so it is
// deliberately not used as a status colour here.
const STATUS_META: Record<string, { label: string; chip: string; text: string; dot: string }> = {
  active: { label: 'Live', chip: 'bg-success/10 border-success/25', text: 'text-success', dot: '#047857' },
  upcoming: { label: 'Upcoming', chip: 'bg-fam-career/10 border-fam-career/25', text: 'text-fam-career', dot: '#2563EB' },
  completed: { label: 'Ended', chip: 'bg-paper-2 border-line', text: 'text-ink-3', dot: '#8B857E' },
  draft: { label: 'Draft', chip: 'bg-paper-2 border-line', text: 'text-ink-3', dot: '#C4BEB6' },
};

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Live', value: 'active' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Ended', value: 'completed' },
];

const TABS = [
  { label: 'Discover', value: 'discover', icon: 'compass-outline' },
  { label: 'My Hackathons', value: 'mine', icon: 'person-outline' },
];

// Fync no longer runs registration, so the only roles it can honestly claim
// are "you host this" and "the host tagged you as a winner".
const ROLE_LABEL: Record<string, string> = {
  organiser: 'Hosting',
  winner: 'You won',
};

/** "unstop.com" — students decide partly on where a listing sends them. */
const hostOf = (url?: string) => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
};

const fmtDate = (d?: string) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t.getTime()) ? t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
};

/**
 * The same rule the server filters by, applied at render time.
 *
 * Cards live in state across mounts and tab switches, so a stored label would
 * be whatever was true when the request landed. Deriving costs two date
 * comparisons and is right every time the row draws.
 */
const deriveStatus = (h: Hackathon): string => {
  if (h.isDraft || h.status === 'draft') return 'draft';
  const now = Date.now();
  const starts = h.hackathonstarts ? new Date(h.hackathonstarts).getTime() : null;
  const ends = h.hackathonends ? new Date(h.hackathonends).getTime() : null;
  if (ends && ends < now) return 'completed';
  if (starts && starts > now) return 'upcoming';
  if (starts && ends) return 'active';
  return 'upcoming';
};

/** "Starts in 3 days" / "2 days left" — the line students actually scan for. */
const countdown = (h: Hackathon, status: string): string | null => {
  const target = status === 'upcoming' ? h.hackathonstarts : status === 'active' ? h.hackathonends : null;
  if (!target) return null;
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;

  const mins = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  const when = days >= 2 ? `${days} days` : hours >= 2 ? `${hours} hours` : `${Math.max(mins, 1)} min`;
  return status === 'upcoming' ? `Starts in ${when}` : `${when} left`;
};

// ─── Hackathon Card ───────────────────────────────────────────────────────────
const HackathonCard = memo(
  ({
    item,
    width,
    onOpen,
    stamped,
  }: {
    item: Hackathon;
    width: number;
    /** The one live hackathon carries the screen's stamp. */
    stamped?: boolean;
    onOpen: (id: string) => void;
  }) => {
    const derived = deriveStatus(item);
    const status = STATUS_META[derived] ?? STATUS_META.upcoming;
    const hasWinners = !!item.winners?.length;
    const remaining = countdown(item, derived);

    return (
      <View
        className={`bg-card rounded-card overflow-hidden ${stamped ? 'border-2 border-ink' : 'border border-line'}`}
        style={{
          width,
          marginBottom: CARD_GAP,
          shadowColor: '#12100E',
          shadowOffset: stamped ? { width: 4, height: 4 } : { width: 0, height: 4 },
          shadowOpacity: stamped ? 1 : 0.06,
          shadowRadius: stamped ? 0 : 12,
          elevation: 2,
        }}
      >
        <Pressable
          onPress={() => onOpen(item._id)}
          android_ripple={{ color: 'rgba(18, 16, 14,0.06)' }}
        >
          {/* Pressed state in children: NativeWind can drop a style function. */}
          {({ pressed }) => (
          <View style={{ opacity: pressed ? 0.9 : 1 }}>
          {/* Banner */}
          <View style={{ height: BANNER_H }} className="bg-ink">
            {item.bannerImage ? (
              <Image source={{ uri: item.bannerImage }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.bannerImage} />
            ) : (
              <View
                className="w-full h-full items-center justify-center"
               style={{ backgroundColor: '#12100E' }}>
                <MaterialCommunityIcons name="code-braces" size={40} color="rgba(255,255,255,0.12)" />
              </View>
            )}

            {/* Legibility scrim under the pills */}
            <LinearGradient
              colors={['rgba(18, 16, 14,0.55)', 'transparent', 'rgba(18, 16, 14,0.65)']}
              className="absolute inset-0"
            />

            {/* Status pill */}
            <View className="absolute top-3 left-3 flex-row items-center bg-card/95 px-2.5 py-1.5 rounded-lg">
              <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: status.dot }} />
              <Text className={`text-label font-semibold ${status.text}`}>{status.label}</Text>
              {remaining ? (
                <>
                  <View className="w-1 h-1 rounded-full bg-line mx-1.5" />
                  <Text className="text-ink-2 text-label font-semibold">{remaining}</Text>
                </>
              ) : null}
            </View>

            {/* My role, when this is one of mine */}
            {item.myRole ? (
              <View className="absolute top-3 right-3 bg-ink/80 px-2.5 py-1.5 rounded-lg">
                <Text className="text-label font-semibold text-white">{ROLE_LABEL[item.myRole] ?? item.myRole}</Text>
              </View>
            ) : null}

            {/* Prize pool */}
            {item.prizepool ? (
              <View className="absolute bottom-3 left-3 flex-row items-center">
                <Ionicons name="trophy" size={13} color={C.brand[500]} />
                <Text className="text-white text-sm font-semibold ml-1.5">{item.prizepool}</Text>
                <Text className="text-white/60 text-label font-semibold ml-1.5">prize pool</Text>
              </View>
            ) : null}
          </View>

          {/* Body */}
          <View style={{ padding: 14 }}>
            {/* Organiser + dates */}
            <View className="flex-row items-center justify-between mb-2.5">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-7 h-7 rounded-lg bg-paper-2 border border-line items-center justify-center overflow-hidden mr-2">
                  {item.logo ? (
                    <Image source={{ uri: item.logo }} style={{ width: '100%', height: '100%' }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={item.logo} />
                  ) : (
                    <MaterialCommunityIcons name="domain" size={14} color={C.ink3} />
                  )}
                </View>
                <Text className="text-ink-3 text-label font-semibold flex-1" numberOfLines={1}>
                  {item.organiser?.name || 'Fync'}
                </Text>
              </View>
              <View className="flex-row items-center bg-paper-2 px-2 py-1 rounded-md">
                <Feather name="calendar" size={11} color={C.ink3} />
                <Text className="text-ink-2 text-label font-semibold ml-1">
                  {fmtDate(item.hackathonstarts)} – {fmtDate(item.hackathonends)}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text className="text-ink text-lg font-display leading-6 mb-2.5" numberOfLines={2}>
              {item.title}
            </Text>

            {/* Meta — mode, team size, and where the button actually goes */}
            <View className="flex-row items-center flex-wrap mb-3">
              <Feather name="map-pin" size={12} color={C.ink3} />
              <Text className="text-ink-3 text-label font-semibold ml-1.5">
                {item.mode === 'Online' || !item.mode ? 'Online' : item.location || item.mode}
              </Text>
              {item.teamSize ? (
                <>
                  <View className="w-1 h-1 rounded-full bg-line mx-2" />
                  <Text className="text-ink-3 text-label font-semibold">Teams of {item.teamSize}</Text>
                </>
              ) : null}
              {item.applyLink ? (
                <>
                  <View className="w-1 h-1 rounded-full bg-line mx-2" />
                  <Feather name="external-link" size={11} color={C.ink3} />
                  <Text className="text-ink-3 text-label font-semibold ml-1">{hostOf(item.applyLink)}</Text>
                </>
              ) : null}
            </View>

            {hasWinners ? (
              <View className="flex-row items-center bg-warning/10 border border-warning/25 self-start px-2.5 py-1.5 rounded-md mb-3">
                <MaterialCommunityIcons name="trophy" size={12} color={C.warning} />
                <Text className="text-warning text-label font-semibold ml-1.5">Winners announced</Text>
              </View>
            ) : null}

            {/* Tags */}
            {item.tags?.length ? (
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {item.tags.slice(0, 3).map((tag, i) => (
                  <View key={`${tag}-${i}`} className="bg-paper-2 border border-line px-2 py-1 rounded-md">
                    <Text className="text-label text-ink-3 font-semibold">{tag}</Text>
                  </View>
                ))}
                {item.tags.length > 3 ? (
                  <View className="px-2 py-1">
                    <Text className="text-label text-ink-3 font-semibold">+{item.tags.length - 3}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          </View>
          )}
        </Pressable>

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
  }: {
    search: string;
    onSearch: (v: string) => void;
    view: 'discover' | 'mine';
    onView: (v: 'discover' | 'mine') => void;
    activeFilter: string;
    onFilter: (v: string) => void;
  }) => (
    <View style={{ paddingTop: 8 }}>

      {/* Search */}
      <View className="flex-row items-center bg-card border-2 border-ink px-3 mb-3 rounded-md" style={{ height: 44 }}>
        <Feather name="search" size={16} color={C.ink3} />
        <TextInput
          placeholder="Search hackathons or tags"
          placeholderTextColor={C.ink3}
          value={search}
          onChangeText={onSearch}
          returnKeyType="search"
          autoCorrect={false}
          className="flex-1 ml-2 text-ink text-sm"
          style={{ paddingVertical: 0 }}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => onSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={C.ink4} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Discover / Mine */}
      <View className="flex-row bg-paper-2 rounded-xl p-1 mb-3">
        {TABS.map((t) => {
          const on = view === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => onView(t.value as 'discover' | 'mine')}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${on ? 'bg-card' : ''}`}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon as any} size={14} color={on ? '#F97316' : '#8B857E'} />
              <Text className={`ml-1.5 text-label font-semibold ${on ? 'text-ink' : 'text-ink-3'}`}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status filters — hidden in "mine", where they did nothing but sat at
          30% opacity taking up a row of vertical space. */}
      {view === 'discover' ? (
        <ScrollView keyboardShouldPersistTaps="handled"
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
                className={`px-3.5 py-2 rounded-lg border ${ on ? 'bg-ink border-ink' : 'bg-card border-line' }`}
                activeOpacity={0.8}
              >
                <Text className={`text-label font-semibold ${on ? 'text-white' : 'text-ink-2'}`}>
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
  const openCreate = useCallback(() => navigation.navigate('HackathonCreate'), [navigation]);

  const onFilter = useCallback((v: string) => setActiveFilter(v), []);
  const onView = useCallback((v: 'discover' | 'mine') => setView(v), []);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? hackathons.filter(
            (h) =>
              h.title?.toLowerCase().includes(q) ||
              h.tags?.some((t) => t?.toLowerCase().includes(q))
          )
        : hackathons,
    [hackathons, q]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Hackathon; index: number }) => (
      <HackathonCard
        item={item}
        width={cardWidth}
        stamped={index === 0 && deriveStatus(item) === 'active'}
        onOpen={openDetail}
      />
    ),
    [cardWidth, openDetail]
  );

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View className="flex-1">
        <AppBar
          title="Hackathon Hub"
          onBack={() => navigation.goBack()}
          right={
            <TouchableOpacity
              onPress={openCreate}
              className="flex-row items-center bg-ink px-3.5 border-2 border-ink rounded-md"
              style={{ minHeight: 40, marginRight: 11 }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Host a hackathon"
            >
              <MaterialCommunityIcons name="plus" size={15} color={C.brand[500]} />
              <Text className="text-white text-label font-semibold ml-1">Host</Text>
            </TouchableOpacity>
          }
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={4}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} colors={['#F97316']} />
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
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color={C.brand[500]} />
              </View>
            ) : (
              <View style={{ height: 8 }} />
            )
          }
          ListEmptyComponent={
            loading ? (
              <View className="py-20 items-center">
                <ActivityIndicator size="large" color={C.brand[500]} />
              </View>
            ) : (
              <View className="items-center px-gutter" style={{ paddingTop: 56 }}>
                <View className="w-16 h-16 rounded-card bg-card border border-line items-center justify-center mb-4">
                  <MaterialCommunityIcons name="rocket-launch-outline" size={28} color={C.ink4} />
                </View>
                <Text className="text-ink text-base font-semibold text-center mb-1">
                  {search
                    ? 'No matches'
                    : view === 'mine'
                    ? 'Nothing here yet'
                    : 'No hackathons yet'}
                </Text>
                <Text className="text-ink-3 text-label font-semibold text-center leading-4">
                  {search
                    ? `Nothing matches “${search}”.`
                    : view === 'mine'
                    ? 'Hackathons you host, join or judge will show up here.'
                    : 'Check back soon, or host the first one.'}
                </Text>
                {!search && view === 'discover' ? (
                  <TouchableOpacity
                    onPress={openCreate}
                    className="flex-row items-center bg-ink px-4 py-3 mt-5 border-2 border-ink rounded-md"
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="plus" size={15} color={C.brand[500]} />
                    <Text className="text-white text-label font-semibold ml-1.5">Host a hackathon</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          }
        />
      </View>
    </View>
  );
};

export default HackathonHub;
