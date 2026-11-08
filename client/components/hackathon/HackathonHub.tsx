import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StatusBar,
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
import { AppBar, Button, Empty, FilterChips, SearchField, SegmentedTabs, Tag, TagRow } from '../ui/kit';
import { ListingSwitcher } from '../opportunity/OpportunityCard';

import FyncRefreshControl from '../ui/FyncRefreshControl';
// ─── Layout constants ─────────────────────────────────────────────────────────
// Fixed pixel heights, not percentages of the screen. The banner used to be
// hp(28–35) and the header hp(35–45), so on a 6.1" phone a single card was
// taller than the viewport and you could never see two hackathons at once.
const GUTTER = 20;
const BANNER_H = 148;
const CARD_GAP = 12;

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
const STATUS_META = (): Record<string, { label: string; chip: string; text: string; dot: string }> => ({
  active: { label: 'Live', chip: 'bg-success/10 border-success/25', text: 'text-success', dot: C.success },
  upcoming: { label: 'Upcoming', chip: 'bg-fam-career/10 border-fam-career/25', text: 'text-fam-career', dot: C.info },
  completed: { label: 'Ended', chip: 'bg-paper-2 border-line', text: 'text-ink-3', dot: C.ink3 },
  draft: { label: 'Draft', chip: 'bg-paper-2 border-line', text: 'text-ink-3', dot: C.ink4 },
});

const FILTERS = ['', 'active', 'upcoming', 'completed'] as const;
const FILTER_LABELS = { '': 'All', active: 'Live', upcoming: 'Upcoming', completed: 'Ended' };

const TABS = ['discover', 'mine'] as const;
const TAB_LABELS = { discover: 'Discover', mine: 'My hackathons' };

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
  }: {
    item: Hackathon;
    width: number;
    onOpen: (id: string) => void;
  }) => {
    const derived = deriveStatus(item);
    const status = STATUS_META()[derived] ?? STATUS_META().upcoming;
    const hasWinners = !!item.winners?.length;
    const remaining = countdown(item, derived);

    return (
      <View className="bg-card rounded-2xl overflow-hidden border border-line" style={{ width, marginBottom: CARD_GAP }}>
        <Pressable
          onPress={() => onOpen(item._id)}
          className="active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${status.label}`}
        >
          <View>
          {/* Banner */}
          <View style={{ height: BANNER_H }} className="bg-night">
            {item.bannerImage ? (
              <Image source={{ uri: item.bannerImage }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.bannerImage} />
            ) : (
              <View
                className="w-full h-full items-center justify-center"
               style={{ backgroundColor: C.night }}>
                <MaterialCommunityIcons name="code-braces" size={40} color="rgba(255,255,255,0.12)" />
              </View>
            )}

            {/* Legibility scrim under the pills */}
            <LinearGradient
              colors={['rgba(18, 16, 14,0.55)', 'transparent', 'rgba(18, 16, 14,0.65)']}
              className="absolute inset-0"
            />

            {/* Status pill */}
            <View className="absolute top-3 left-3 flex-row items-center bg-card/95 px-2.5 py-1.5 rounded-full">
              <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: status.dot }} />
              <Text className={`text-xs font-semibold ${status.text}`}>{status.label}</Text>
              {remaining ? (
                <>
                  <View className="w-1 h-1 rounded-full bg-line mx-1.5" />
                  <Text className="text-ink-2 text-xs font-semibold">{remaining}</Text>
                </>
              ) : null}
            </View>

            {/* My role, when this is one of mine */}
            {item.myRole ? (
              <View className="absolute top-3 right-3 bg-night/80 px-2.5 py-1.5 rounded-full">
                <Text className="text-xs font-semibold text-white">{ROLE_LABEL[item.myRole] ?? item.myRole}</Text>
              </View>
            ) : null}

            {/* Prize pool */}
            {item.prizepool ? (
              <View className="absolute bottom-3 left-3 flex-row items-center">
                <Ionicons name="trophy" size={13} color={C.brand[500]} />
                <Text className="text-white text-sm font-semibold ml-1.5">{item.prizepool}</Text>
                <Text className="text-white/60 text-xs font-semibold ml-1.5">prize pool</Text>
              </View>
            ) : null}
          </View>

          {/* Body */}
          <View style={{ padding: 16 }}>
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
                <Text className="text-ink-3 text-xs font-semibold flex-1" numberOfLines={1}>
                  {item.organiser?.name || 'Fync'}
                </Text>
              </View>
              <View className="flex-row items-center bg-paper-2 px-2 py-1 rounded-full">
                <Feather name="calendar" size={11} color={C.ink3} />
                <Text className="text-ink-2 text-xs font-semibold ml-1">
                  {fmtDate(item.hackathonstarts)} – {fmtDate(item.hackathonends)}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text className="text-ink text-lg font-semibold leading-6 mb-2" numberOfLines={2}>
              {item.title}
            </Text>

            {/* Meta — mode, team size, and where the button actually goes */}
            <View className="flex-row items-center flex-wrap mb-3">
              <Feather name="map-pin" size={12} color={C.ink3} />
              <Text className="text-ink-3 text-xs font-semibold ml-1.5">
                {item.mode === 'Online' || !item.mode ? 'Online' : item.location || item.mode}
              </Text>
              {item.teamSize ? (
                <>
                  <View className="w-1 h-1 rounded-full bg-line mx-2" />
                  <Text className="text-ink-3 text-xs font-semibold">Teams of {item.teamSize}</Text>
                </>
              ) : null}
              {item.applyLink ? (
                <>
                  <View className="w-1 h-1 rounded-full bg-line mx-2" />
                  <Feather name="external-link" size={11} color={C.ink3} />
                  <Text className="text-ink-3 text-xs font-semibold ml-1">{hostOf(item.applyLink)}</Text>
                </>
              ) : null}
            </View>

            {hasWinners ? (
              <View className="flex-row items-center bg-warning/10 border border-warning/25 self-start px-2.5 py-1.5 rounded-full mb-3">
                <MaterialCommunityIcons name="trophy" size={12} color={C.warning} />
                <Text className="text-warning text-xs font-semibold ml-1.5">Winners announced</Text>
              </View>
            ) : null}

            {/* Tags */}
            {item.tags?.length ? (
              <TagRow>
                {item.tags.slice(0, 3).map((tag, i) => <Tag key={`${tag}-${i}`} label={tag} />)}
                {item.tags.length > 3 ? <Tag label={`+${item.tags.length - 3}`} /> : null}
              </TagRow>
            ) : null}
          </View>
          </View>
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

      <SearchField
        placeholder="Search hackathons or tags"
        value={search}
        onChangeText={onSearch}
        containerStyle={{ marginBottom: 12 }}
      />

      <SegmentedTabs items={TABS} labels={TAB_LABELS} value={view} onChange={onView} style={{ marginBottom: 12 }} />

      {/* Status filters — hidden in "mine", where they did nothing. */}
      {view === 'discover' ? (
        <FilterChips
          items={FILTERS}
          labels={FILTER_LABELS}
          value={activeFilter as (typeof FILTERS)[number]}
          onChange={onFilter}
          style={{ marginHorizontal: -GUTTER, marginBottom: 12 }}
        />
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

        // Dedupe on append: a listing published between page fetches shifts the
        // pages and repeats a row, which FlatList renders twice under one key.
        setHackathons((prev) =>
          opts.append ? [...prev, ...data.filter((d) => !prev.some((p) => p._id === d._id))] : data
        );
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
    ({ item }: { item: Hackathon }) => (
      <HackathonCard
        item={item}
        width={cardWidth}
        onOpen={openDetail}
      />
    ),
    [cardWidth, openDetail]
  );

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} backgroundColor="transparent" translucent />
      <View className="flex-1">
        <AppBar
          title="Hackathon Hub"
          onBack={() => navigation.goBack()}
          right={
            <Button small variant="primary" icon="add" title="Host" onPress={openCreate} accessibilityLabel="Host a hackathon" />
          }
        />
        <ListingSwitcher current="hackathons" />
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
            <FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} colors={[C.brand[500]]} />
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
              <Empty
                icon="rocket-outline"
                title={search ? 'No matches' : view === 'mine' ? 'Nothing here yet' : 'No hackathons yet'}
                hint={
                  search
                    ? `Nothing matches “${search}”.`
                    : view === 'mine'
                    ? 'Hackathons you host, join or judge will show up here.'
                    : 'Check back soon, or host the first one.'
                }
                action={!search && view === 'discover' ? <Button variant="primary" icon="add" title="Host a hackathon" onPress={openCreate} /> : undefined}
              />
            )
          }
        />
      </View>
    </View>
  );
};

export default HackathonHub;
