import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Linking,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';
import { Alert } from '../ui/AlertModal';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';

/**
 * A hackathon listing.
 *
 * Fync does not run the hackathon — the organiser does, on whatever stack they
 * already use. This screen's job is to make the listing worth reading and then
 * hand the student off to the organiser's own registration link. The only
 * thing that comes back is the winner list, tagged here once it is over.
 */

// ─── Types ───────────────────────────────────────────────────────────────────
interface WinnerUser {
  _id: string;
  name: string;
  avatar?: string;
  college?: string;
}

interface Winner {
  rank: number;
  title?: string;
  amount?: string;
  teamName?: string;
  users?: WinnerUser[];
  projectLink?: string;
  note?: string;
}

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS_META = (): Record<string, { label: string; text: string; chip: string; dot: string }> => ({
  active: { label: 'Live now', text: 'text-success', chip: 'bg-success/10 border-success/25', dot: C.success },
  upcoming: { label: 'Upcoming', text: 'text-fam-career', chip: 'bg-fam-career/10 border-fam-career/25', dot: C.info },
  completed: { label: 'Ended', text: 'text-ink-3', chip: 'bg-paper-2 border-line', dot: C.ink3 },
  draft: { label: 'Draft', text: 'text-ink-3', chip: 'bg-paper-2 border-line', dot: C.ink4 },
});

const RANK_META = (): Record<number, { label: string; medal: string; tint: string }> => ({
  1: { label: '1st', medal: '#D97706', tint: 'bg-warning/10 border-warning/30' },
  2: { label: '2nd', medal: '#78716C', tint: 'bg-paper-2 border-line' },
  3: { label: '3rd', medal: C.warning, tint: 'bg-paper-2 border-line' },
});

const TABS = ['Overview', 'Timeline', 'Tracks', 'Prizes', 'FAQs'];

const fmtWith = (opts: Intl.DateTimeFormatOptions) => (d?: string) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t.getTime()) ? t.toLocaleDateString('en-IN', opts) : '—';
};
const fmtDate = fmtWith({ day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = fmtWith({ day: 'numeric', month: 'short' });

/** "yourhackathon.com" — what the student is actually about to open. */
const hostOf = (url?: string) => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
};

// ─── Small pieces ────────────────────────────────────────────────────────────
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-ink text-base font-display mb-3">{children}</Text>
);

const InfoCell = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View className="flex-1 bg-card border border-line rounded-card p-3.5">
    <View className="flex-row items-center mb-1.5">
      <Feather name={icon} size={12} color={C.ink3} />
      <Text className="text-ink-3 text-label font-semibold ml-1.5">{label}</Text>
    </View>
    <Text className="text-ink text-sm font-semibold" numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const FAQItem = ({ faq }: { faq: { question: string; answer: string } }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setExpanded((e) => !e)}
      activeOpacity={0.85}
      className="bg-card border border-line rounded-card p-4 mb-2.5"
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View className="flex-row items-start justify-between">
        <Text className="text-ink text-sm font-semibold flex-1 mr-3">{faq.question}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.ink3} />
      </View>
      {expanded ? (
        <Text className="text-ink-2 text-sm leading-5 mt-2.5">{faq.answer}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

const WinnerCard = ({ winner, onOpenProfile }: { winner: Winner; onOpenProfile: (id: string) => void }) => {
  const meta = RANK_META()[winner.rank] ?? { label: `#${winner.rank}`, medal: C.ink3, tint: 'bg-paper-2 border-line' };
  return (
    <View className={`border rounded-card p-4 mb-2.5 ${meta.tint}`}>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="trophy-variant" size={16} color={meta.medal} />
          <Text className="text-ink text-sm font-display ml-2">
            {meta.label}
            {winner.title ? ` · ${winner.title}` : ''}
          </Text>
        </View>
        {winner.amount ? (
          <Text className="text-ink text-sm font-semibold">{winner.amount}</Text>
        ) : null}
      </View>

      {winner.teamName ? (
        <Text className="text-ink-2 text-sm font-semibold mb-2">{winner.teamName}</Text>
      ) : null}

      {winner.users?.length ? (
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {winner.users.map((u) => (
            <TouchableOpacity
              key={u._id}
              onPress={() => onOpenProfile(u._id)}
              activeOpacity={0.8}
              className="flex-row items-center bg-card border border-line rounded-full pl-1 pr-2.5 py-1"
              accessibilityRole="button"
              accessibilityLabel={`Open ${u.name}'s profile`}
            >
              {u.avatar ? (
                <Image source={{ uri: u.avatar }} className="w-6 h-6 rounded-full mr-1.5" />
              ) : (
                <View className="w-6 h-6 rounded-full bg-paper-2 items-center justify-center mr-1.5">
                  <Text className="text-ink-3 text-label font-semibold">{u.name?.[0]?.toUpperCase()}</Text>
                </View>
              )}
              <Text className="text-ink text-label font-semibold">{u.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {winner.note ? <Text className="text-ink-3 text-label mt-2 leading-4">{winner.note}</Text> : null}

      {winner.projectLink ? (
        <TouchableOpacity
          onPress={() => Linking.openURL(winner.projectLink!).catch(() => {})}
          className="flex-row items-center mt-2.5"
          accessibilityRole="link"
        >
          <Feather name="external-link" size={12} color={C.brand[700]} />
          <Text className="text-brand-700 text-label font-semibold ml-1.5">View the project</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────
const HackathonDetail = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const bottomInset = useBottomInset();
  const { hackathonId } = route.params ?? {};
  const { user } = useAuth();

  const [hackathon, setHackathon] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [solidHeader, setSolidHeader] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 160], outputRange: [0, 1], extrapolate: 'clamp' });

  const loadHackathon = useCallback(async () => {
    try {
      const res = await axios.get(`/hackathons/${hackathonId}`);
      setHackathon(res.data.hackathon);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load this hackathon' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hackathonId]);

  useEffect(() => {
    loadHackathon();
  }, [loadHackathon]);

  // Coming back from the winners screen should show what was just announced.
  // A ref, not the `loading` flag: `loading` would be captured as `true` in the
  // focus callback's closure and the refetch would never run.
  const mounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (mounted.current) loadHackathon();
      else mounted.current = true;
    }, [loadHackathon])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHackathon();
  }, [loadHackathon]);

  const isOrganiser =
    !!hackathon?.organiser?._id &&
    String(hackathon.organiser._id) === String(user?._id || user?.id);

  /**
   * The hand-off. Everything past this point belongs to the organiser, so the
   * button says where it goes rather than pretending the flow stays in Fync.
   */
  const openApplyLink = useCallback(async () => {
    const raw = hackathon?.applyLink?.trim();
    if (!raw) {
      Toast.show({ type: 'info', text1: 'The organiser has not added a registration link yet' });
      return;
    }
    // Organisers paste "unstop.com/…" without a scheme, and canOpenURL reports
    // false on Android 11+ for links it can open, so open directly.
    const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    try {
      await Linking.openURL(url);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open that link', text2: url });
    }
  }, [hackathon?.applyLink]);

  const shareListing = useCallback(async () => {
    if (!hackathon) return;
    try {
      await Share.share({
        message: `${hackathon.title} — ${hackathon.prizepool ? `${hackathon.prizepool} prize pool. ` : ''}${hackathon.applyLink ? `Register: ${hackathon.applyLink}` : ''}`,
      });
    } catch {
      /* the user dismissed the sheet */
    }
  }, [hackathon]);

  /**
   * Publish or hide. Live / upcoming / ended are not settable — they follow
   * the dates, so an organiser who wants to end early edits the end date.
   */
  const setVisibility = (next: 'draft' | 'published') => {
    const hiding = next === 'draft';
    Alert.alert(
      hiding ? 'Hide this listing?' : 'Publish this listing?',
      hiding
        ? 'Students will no longer find it in the hub. You can publish it again any time.'
        : 'It will appear in the hub straight away.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hiding ? 'Hide' : 'Publish',
          onPress: async () => {
            try {
              const res = await axios.patch(`/hackathons/${hackathonId}/status`, { status: next });
              setHackathon((h: any) => ({ ...h, ...res.data.hackathon }));
              Toast.show({ type: 'success', text1: hiding ? 'Listing hidden' : 'Listing published' });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Could not update the listing' });
            }
          },
        },
      ]
    );
  };

  const deleteListing = () => {
    Alert.alert(
      'Delete listing',
      'This removes the hackathon from Fync. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`/hackathons/${hackathonId}`);
              Toast.show({ type: 'success', text1: 'Listing deleted' });
              navigation.goBack();
            } catch {
              Toast.show({ type: 'error', text1: 'Could not delete the listing' });
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator size="large" color={C.brand[500]} />
      </View>
    );
  }

  if (!hackathon) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center px-gutter">
        <MaterialCommunityIcons name="rocket-launch-outline" size={40} color={C.ink4} />
        <Text className="text-ink text-base font-semibold mt-4">Hackathon not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-5 bg-ink px-4 py-3 rounded-md border-2 border-ink">
          <Text className="text-paper text-label font-semibold">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isDraft = hackathon.isDraft || hackathon.status === 'draft';
  const winners: Winner[] = hackathon.winners ?? [];
  const hasEnded = new Date(hackathon.hackathonends) < new Date();
  // Derived from the dates like the hub card, so the two never disagree when
  // the stored status lags behind.
  const derived = isDraft ? 'draft'
    : hasEnded ? 'completed'
    : new Date(hackathon.hackathonstarts) > new Date() ? 'upcoming'
    : hackathon.hackathonstarts ? 'active' : hackathon.status;
  const statusMeta = STATUS_META()[derived] ?? STATUS_META().upcoming;
  const regClosed =
    hackathon.registrationends && new Date(hackathon.registrationends) < new Date();

  return (
    <View className="flex-1 bg-paper">
      {/* Light icons over the dark banner; theme icons once the paper header covers it. */}
      <StatusBar style={solidHeader && C.scheme !== 'dark' ? 'dark' : 'light'} />

      {/* Collapsed header — appears once the banner scrolls away */}
      <Animated.View
        pointerEvents="none"
        style={{ opacity: headerOpacity }}
        className="absolute top-0 left-0 right-0 z-20 bg-paper border-b border-line"
      >
        <View style={{ paddingTop: insets.top }}>
          <View className="h-14 justify-center px-14">
            <Text className="text-ink text-sm font-display text-center" numberOfLines={1}>
              {hackathon.title}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Back + share, always tappable above the banner */}
      <View className="absolute top-0 left-0 right-0 z-30" pointerEvents="box-none">
        <AppBar
          overlay
          onBack={() => navigation.goBack()}
          right={<IconBtn overlay name="share-outline" onPress={shareListing} />}
        />
      </View>

      <Animated.ScrollView keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: (e: any) => {
            const solid = e.nativeEvent.contentOffset.y > 120;
            if (solid !== solidHeader) setSolidHeader(solid);
          },
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} colors={[C.brand[500]]} />}
        contentContainerStyle={{ paddingBottom: 140 + bottomInset }}
      >
        {/* Banner */}
        <View style={{ height: 210 }} className="bg-night">
          {hackathon.bannerImage ? (
            <Image source={{ uri: hackathon.bannerImage }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <MaterialCommunityIcons name="code-braces" size={52} color="rgba(255,255,255,0.12)" />
            </View>
          )}
          <LinearGradient colors={['rgba(18,16,14,0.65)', 'transparent', 'rgba(18,16,14,0.85)']} className="absolute inset-0" />
        </View>

        <View className="px-gutter" style={{ marginTop: -34 }}>
          {/* Identity card */}
          <View className="bg-card border-2 border-ink rounded-card p-4" style={{ shadowColor: '#12100E', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 }}>
            <View className="flex-row items-start">
              <View className="w-12 h-12 rounded-card bg-paper-2 border border-line items-center justify-center overflow-hidden mr-3">
                {hackathon.logo ? (
                  <Image source={{ uri: hackathon.logo }} className="w-full h-full" resizeMode="contain" />
                ) : (
                  <MaterialCommunityIcons name="domain" size={20} color={C.ink3} />
                )}
              </View>
              <View className="flex-1">
                <View className={`self-start flex-row items-center border px-2 py-1 rounded-md mb-1.5 ${statusMeta.chip}`}>
                  <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: statusMeta.dot }} />
                  <Text className={`text-label font-semibold ${statusMeta.text}`}>{statusMeta.label}</Text>
                </View>
                <Text className="text-ink text-xl font-display leading-6">{hackathon.title}</Text>
                <Text className="text-ink-3 text-label font-semibold mt-1">
                  Hosted by {hackathon.organiser?.name || 'an organiser'}
                </Text>
              </View>
            </View>

            {/* Fync lists, the organiser runs it. Saying so up front stops
                students waiting for a Fync-side registration that never comes. */}
            <View className="flex-row items-start bg-paper-2 border border-line rounded-card p-3 mt-3.5">
              <Feather name="info" size={13} color={C.ink3} style={{ marginTop: 1 }} />
              <Text className="text-ink-2 text-label leading-4 ml-2 flex-1">
                Registration, teams and judging are handled by the organiser
                {hackathon.applyLink ? ` on ${hostOf(hackathon.applyLink)}` : ''}. Fync just lists it.
              </Text>
            </View>
          </View>

          {/* Key facts */}
          <View className="flex-row mt-3" style={{ gap: 10 }}>
            <InfoCell icon="calendar" label="Runs" value={`${fmtShort(hackathon.hackathonstarts)} – ${fmtShort(hackathon.hackathonends)}`} />
            <InfoCell icon="map-pin" label={hackathon.mode || 'Mode'} value={hackathon.location || hackathon.mode || 'Online'} />
          </View>
          <View className="flex-row mt-2.5" style={{ gap: 10 }}>
            <InfoCell icon="award" label="Prize pool" value={hackathon.prizepool || 'Not disclosed'} />
            <InfoCell icon="users" label="Team size" value={hackathon.teamSize || 'Organiser decides'} />
          </View>

          {hackathon.registrationends ? (
            <View className="flex-row items-center bg-card border border-line rounded-card p-3.5 mt-2.5">
              <Feather name={regClosed ? 'lock' : 'clock'} size={13} color={regClosed ? C.ink3 : C.brand[700]} />
              <Text className="text-ink-2 text-label font-semibold ml-2">
                {regClosed
                  ? `Registration closed ${fmtDate(hackathon.registrationends)}`
                  : `Register by ${fmtDate(hackathon.registrationends)}`}
              </Text>
            </View>
          ) : null}

          {/* Winners — the one thing that comes back to Fync */}
          {winners.length ? (
            <View className="mt-6">
              <View className="flex-row items-center mb-3">
                <MaterialCommunityIcons name="trophy" size={17} color="#D97706" />
                <Text className="text-ink text-base font-display ml-2">Winners</Text>
              </View>
              {[...winners]
                .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                .map((w, i) => (
                  <WinnerCard
                    key={`${w.rank}-${i}`}
                    winner={w}
                    onOpenProfile={(id) => navigation.navigate('PublicProfile', { userId: id })}
                  />
                ))}
            </View>
          ) : hasEnded ? (
            <View className="items-center bg-card border border-line rounded-card p-5 mt-6">
              <MaterialCommunityIcons name="trophy-outline" size={24} color={C.ink4} />
              <Text className="text-ink-2 text-label font-semibold mt-2 text-center">
                Results not announced yet
              </Text>
              <Text className="text-ink-3 text-label text-center mt-1 leading-4">
                The organiser will tag the winners here once they are out.
              </Text>
            </View>
          ) : null}

          {/* Tabs */}
          <View className="mt-6">
            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
              {TABS.map((tab, i) => {
                const on = activeTab === i;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(i)}
                    className={`px-3.5 py-2 rounded-lg border ${on ? 'bg-ink border-ink' : 'bg-card border-line'}`}
                    activeOpacity={0.85}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                  >
                    <Text className={`text-label font-semibold ${on ? 'text-paper' : 'text-ink-2'}`}>{tab}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Overview */}
            {activeTab === 0 ? (
              <View>
                {hackathon.description ? (
                  <>
                    <SectionTitle>About</SectionTitle>
                    <Text className="text-ink-2 text-sm leading-5 mb-5">{hackathon.description}</Text>
                  </>
                ) : null}

                {hackathon.tags?.length ? (
                  <View className="flex-row flex-wrap mb-5" style={{ gap: 6 }}>
                    {hackathon.tags.map((t: string, i: number) => (
                      <View key={`${t}-${i}`} className="bg-paper-2 border border-line px-2.5 py-1 rounded-md">
                        <Text className="text-ink-2 text-label font-semibold">{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Always shown. An empty list means "open to all", and a
                    missing section reads as the host forgetting rather than
                    the hackathon being open. */}
                <SectionTitle>Who can apply</SectionTitle>
                <View className="bg-card border border-line rounded-card p-4 mb-5">
                  {[
                    ['Colleges', hackathon.eligibility?.colleges, 'All colleges'],
                    ['Batches', hackathon.eligibility?.Year, 'All batches'],
                    ['Branches', hackathon.eligibility?.branch, 'All branches'],
                  ].map(([label, vals, allLabel]: any, i: number) => {
                    const open = !vals?.length;
                    return (
                      <View key={label} className={`flex-row ${i < 2 ? 'mb-3' : ''}`}>
                        <Text className="text-ink-3 text-label font-semibold w-20">{label}</Text>
                        {open ? (
                          <View className="flex-row items-center flex-1">
                            <Feather name="check" size={12} color={C.success} />
                            <Text className="text-success text-label font-semibold ml-1.5">{allLabel}</Text>
                          </View>
                        ) : (
                          <View className="flex-row flex-wrap flex-1" style={{ gap: 6 }}>
                            {vals.map((v: string) => (
                              <View key={v} className="bg-paper-2 border border-line px-2 py-1 rounded-md">
                                <Text className="text-ink-2 text-label font-semibold">{v}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {hackathon.rules?.length ? (
                  <>
                    <SectionTitle>Rules</SectionTitle>
                    <View className="mb-5">
                      {hackathon.rules.map((r: string, i: number) =>
                        r ? (
                          <View key={i} className="flex-row mb-2">
                            <Text className="text-brand-700 text-label font-semibold mr-2">{i + 1}.</Text>
                            <Text className="text-ink-2 text-sm leading-5 flex-1">{r}</Text>
                          </View>
                        ) : null
                      )}
                    </View>
                  </>
                ) : null}

                {hackathon.sponsors?.length ? (
                  <>
                    <SectionTitle>Sponsors</SectionTitle>
                    <View className="flex-row flex-wrap mb-5" style={{ gap: 8 }}>
                      {hackathon.sponsors.map((s: any, i: number) => (
                        <View key={i} className="flex-row items-center bg-card border border-line rounded-card px-3 py-2">
                          {s.logo ? <Image source={{ uri: s.logo }} className="w-6 h-6 rounded mr-2" resizeMode="contain" /> : null}
                          <Text className="text-ink-2 text-label font-semibold">{s.name}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {/* Organiser's own channels — the listing is a signpost */}
                {hackathon.websiteLink || hackathon.discordLink || hackathon.contactEmail ? (
                  <>
                    <SectionTitle>Organiser links</SectionTitle>
                    <View className="mb-2">
                      {[
                        ['globe', 'Website', hackathon.websiteLink],
                        ['message-circle', 'Discord', hackathon.discordLink],
                        ['mail', 'Contact', hackathon.contactEmail],
                      ].map(([icon, label, val]: any) =>
                        val ? (
                          <TouchableOpacity
                            key={label}
                            onPress={() =>
                              Linking.openURL(label === 'Contact' ? `mailto:${val}` : val).catch(() =>
                                Toast.show({ type: 'error', text1: 'Could not open that link' })
                              )
                            }
                            className="flex-row items-center bg-card border border-line rounded-card p-3.5 mb-2"
                            activeOpacity={0.85}
                            accessibilityRole="link"
                          >
                            <Feather name={icon} size={14} color={C.ink3} />
                            <Text className="text-ink-2 text-sm font-semibold ml-2.5 flex-1" numberOfLines={1}>
                              {val}
                            </Text>
                            <Feather name="external-link" size={13} color={C.ink4} />
                          </TouchableOpacity>
                        ) : null
                      )}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            {/* Timeline */}
            {activeTab === 1 ? (
              hackathon.timeline?.length ? (
                <View>
                  {hackathon.timeline.map((t: any, i: number) => (
                    <View key={i} className="flex-row mb-1">
                      <View className="items-center mr-3" style={{ width: 18 }}>
                        <View className="w-2.5 h-2.5 rounded-full bg-brand-500 border-2 border-ink" style={{ marginTop: 5 }} />
                        {i < hackathon.timeline.length - 1 ? <View className="flex-1 w-0.5 bg-line" /> : null}
                      </View>
                      <View className="flex-1 pb-5">
                        <Text className="text-ink text-sm font-semibold">{t.label}</Text>
                        <Text className="text-brand-700 text-label font-semibold mt-0.5">{fmtDate(t.date)}</Text>
                        {t.description ? <Text className="text-ink-2 text-sm leading-5 mt-1">{t.description}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-ink-3 text-label font-semibold">The organiser has not posted a schedule.</Text>
              )
            ) : null}

            {/* Tracks */}
            {activeTab === 2 ? (
              hackathon.tracks?.length ? (
                <View>
                  {hackathon.tracks.map((t: any, i: number) => (
                    <View key={i} className="bg-card border border-line rounded-card p-4 mb-2.5">
                      <Text className="text-ink text-sm font-semibold mb-1">{t.title}</Text>
                      {t.description ? <Text className="text-ink-2 text-sm leading-5">{t.description}</Text> : null}
                      {t.prizes ? <Text className="text-success text-label font-semibold mt-2">{t.prizes}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-ink-3 text-label font-semibold">No separate tracks for this one.</Text>
              )
            ) : null}

            {/* Prizes */}
            {activeTab === 3 ? (
              hackathon.prizes?.length ? (
                <View>
                  {hackathon.prizes.map((p: any, i: number) => {
                    const meta = RANK_META()[p.rank] ?? { label: `#${p.rank}`, medal: C.ink3, tint: 'bg-card border-line' };
                    return (
                      <View key={i} className={`flex-row items-center justify-between border rounded-card p-4 mb-2.5 ${meta.tint}`}>
                        <View className="flex-row items-center flex-1 mr-3">
                          <MaterialCommunityIcons name="trophy-variant-outline" size={16} color={meta.medal} />
                          <Text className="text-ink text-sm font-semibold ml-2.5" numberOfLines={1}>
                            {p.title || meta.label}
                          </Text>
                        </View>
                        <Text className="text-ink text-sm font-display">{p.amount}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-ink-3 text-label font-semibold">Prize breakdown not published.</Text>
              )
            ) : null}

            {/* FAQs */}
            {activeTab === 4 ? (
              hackathon.faqs?.length ? (
                <View>
                  {hackathon.faqs.map((f: any, i: number) => (f.question ? <FAQItem key={i} faq={f} /> : null))}
                </View>
              ) : (
                <Text className="text-ink-3 text-label font-semibold">No FAQs yet.</Text>
              )
            ) : null}
          </View>

          {/* Organiser controls */}
          {isOrganiser ? (
            <View className="mt-7 border-t border-line pt-5">
              <Text className="text-ink-3 text-label font-semibold mb-3">ORGANISER</Text>

              <TouchableOpacity
                onPress={() => navigation.navigate('HackathonWinners', { hackathonId, hackathonTitle: hackathon.title })}
                className="flex-row items-center bg-ink border-2 border-ink rounded-card p-4 mb-2.5"
                activeOpacity={0.9}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="trophy" size={17} color={C.brand[500]} />
                <View className="flex-1 ml-3">
                  <Text className="text-paper text-sm font-semibold">
                    {winners.length ? 'Edit winners' : 'Announce winners'}
                  </Text>
                  <Text className="text-paper/60 text-label mt-0.5">
                    Tag the students who won — it lands on their profile
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.paper + '80'} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('HackathonCreate', { hackathonId })}
                className="flex-row items-center bg-card border border-line rounded-card p-4 mb-2.5"
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Feather name="edit-3" size={15} color={C.ink} />
                <Text className="text-ink text-sm font-semibold ml-3 flex-1">Edit listing</Text>
                <Ionicons name="chevron-forward" size={16} color={C.ink4} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setVisibility(isDraft ? 'published' : 'draft')}
                className="flex-row items-center bg-card border border-line rounded-card p-4 mb-2.5"
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Feather name={isDraft ? 'eye' : 'eye-off'} size={15} color={C.ink} />
                <View className="flex-1 ml-3">
                  <Text className="text-ink text-sm font-semibold">
                    {isDraft ? 'Publish listing' : 'Hide listing'}
                  </Text>
                  <Text className="text-ink-3 text-label mt-0.5">
                    {isDraft
                      ? 'Not visible in the hub yet'
                      : 'Live / upcoming / ended follow your dates — edit them to change it'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.ink4} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={deleteListing}
                className="flex-row items-center justify-center border border-danger/30 bg-danger/5 rounded-card p-3.5"
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Feather name="trash-2" size={14} color={C.danger} />
                <Text className="text-danger text-label font-semibold ml-2">Delete listing</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* The hand-off, pinned. This is the whole point of the screen. */}
      <View
        className="absolute left-0 right-0 bottom-0 bg-paper border-t border-line px-gutter pt-3"
        style={{ paddingBottom: 12 + bottomInset }}
      >
        <TouchableOpacity
          onPress={openApplyLink}
          className="flex-row items-center justify-center bg-brand-500 border-2 border-ink rounded-card"
          style={{ minHeight: 52, shadowColor: '#12100E', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 }}
          activeOpacity={0.9}
          accessibilityRole="link"
          accessibilityLabel={`${hackathon.applyLabel || 'Register'} — opens ${hostOf(hackathon.applyLink)}`}
        >
          <Text className="text-on-brand text-base font-display">
            {hackathon.applyLabel || 'Register'}
          </Text>
          <Feather name="external-link" size={15} color={C.onBrand} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
        <Text className="text-ink-3 text-label font-semibold text-center mt-2" numberOfLines={1}>
          {hackathon.applyLink ? `Opens ${hostOf(hackathon.applyLink)}` : 'No registration link yet'}
        </Text>
      </View>
    </View>
  );
};

export default HackathonDetail;
