import React, { useEffect, useState, useCallback, useRef } from 'react';
import {View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Animated, RefreshControl, TextInput} from 'react-native'
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';
import socket from '../../utils/socket';
import { Alert } from '../ui/AlertModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Announcement {
  _id: string;
  Title: string;   // model uses capital T
  body: string;
  type: string;
  isPinned: boolean;
  author: { name: string; avatar?: string; role: string };
  createdAt: string;
  reactions?: { user: string; emoji: string }[];
}

interface Hackathon {
  _id: string;
  title: string;
  bannerImage?: string;
  logo?: string;
  status: string;
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
  judges?: { name: string; avatar?: string }[];
  judgingcriteria?: { name: string; weightage: string; description: string }[];
  eligibility?: { colleges: string[]; Year: string[]; branch: string[] };
  sponsors?: { name: string; logo?: string }[];
}

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; colors: string[] }> = {
  active: { label: 'Live Now', colors: ['#047857', '#047857'] },
  upcoming: { label: 'Upcoming', colors: ['#F97316', '#EA580C'] },
  judging: { label: 'In Judging', colors: ['#B45309', '#B45309'] },
  completed: { label: 'Completed', colors: ['#8B857E', '#57534E'] },
  draft: { label: 'Draft', colors: ['#F97316', '#EA580C'] },
};

// ─── Announcement type config ──────────────────────────────────────────────────
const ANN_TYPES: { value: string; label: string; icon: string; color: string; bg: string }[] = [
  { value: 'general', label: 'General', icon: 'megaphone', color: '#F97316', bg: '#EDE8E0' },
  { value: 'important', label: 'Important', icon: 'alert-circle', color: '#DC2626', bg: '#EDE8E0' },
  { value: 'schedule_change', label: 'Schedule', icon: 'calendar', color: '#B45309', bg: '#EDE8E0' },
  { value: 'result', label: 'Result', icon: 'trophy', color: '#047857', bg: '#EDE8E0' },
];

const TABS = ['Overview', 'Timeline', 'Tracks', 'Mentors', 'FAQs', 'Announcements', 'Teams', 'Prizes'];

// ─── Collapsible FAQ Item ──────────────────────────────────────────────────
const FAQItem = ({ faq }: { faq: { question: string; answer: string } }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      className="bg-paper-2 rounded-card p-5 mb-3 border border-line"
    >
      <View className="flex-row justify-between items-center">
        <Text className="text-ink font-semibold text-xs flex-1">{faq.question}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#F97316" />
      </View>
      {expanded && <Text className="text-ink-3 text-xs leading-5 mt-3">{faq.answer}</Text>}
    </TouchableOpacity>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const HackathonDetail = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId } = route.params;
  const { user } = useAuth();

  const [hackathon, setHackathon] = useState<any | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [annLoading, setAnnLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Announcement form state
  const [annForm, setAnnForm] = useState({ title: '', body: '', isPinned: false, type: 'general' });
  const [postingAnn, setPostingAnn] = useState(false);
  const [annPage, setAnnPage] = useState(1);
  const [annHasMore, setAnnHasMore] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 160], outputRange: [0, 1], extrapolate: 'clamp' });

  useEffect(() => {
    loadHackathon();
  }, [hackathonId]);

  // ─── Socket: join hack room & listen for real-time announcements ───────────
  useEffect(() => {
    socket.emit('join_hack_room', { hackathonId });

    const onNewAnnouncement = (ann: Announcement) => {
      setAnnouncements(prev => {
        const updated = [ann, ...prev];
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });
      Toast.show({
        type: 'info',
        text1: `${ann.Title}`,
        text2: ann.body?.slice(0, 60) + (ann.body?.length > 60 ? '…' : ''),
        visibilityTime: 4000,
      });
    };

    socket.on('announcement:new', onNewAnnouncement);
    socket.on('hackathon:status_changed', () => loadHackathon());
    socket.on('hackathon:winners_announced', () => loadHackathon());

    return () => {
      socket.off('announcement:new', onNewAnnouncement);
      socket.off('hackathon:status_changed');
      socket.off('hackathon:winners_announced');
      socket.emit('leave_hack_room', { hackathonId });
    };
  }, [hackathonId]);

  useEffect(() => {
    if (activeTab === 5) loadAnnouncements(1, true);
  }, [activeTab]);

  const loadHackathon = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/hackathons/${hackathonId}`);
      setHackathon(res.data.hackathon);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load hackathon' });
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAnnouncements = async (page = 1, reset = false) => {
    if (page === 1 && reset) setAnnLoading(true);
    try {
      const res = await axios.get(`/announcements/${hackathonId}`, {
        params: { page, limit: 20 }
      });
      const data: Announcement[] = res.data.announcements ?? [];
      setAnnouncements(prev => reset ? data : [...prev, ...data]);
      setAnnPage(page);
      setAnnHasMore(data.length === 20);
    } catch {
    } finally {
      setAnnLoading(false);
    }
  };

  const postAnnouncement = async () => {
    if (!annForm.title.trim() || !annForm.body.trim()) {
      Toast.show({ type: 'error', text1: 'Needs title & body' });
      return;
    }
    setPostingAnn(true);
    try {
      await axios.post(`/announcements/${hackathonId}`, {
        title: annForm.title.trim(),
        body: annForm.body.trim(),
        type: annForm.type,
        isPinned: annForm.isPinned
      });
      setAnnForm({ title: '', body: '', isPinned: false, type: 'general' });
      Toast.show({ type: 'success', text1: 'Broadcast Live!' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to post signal' });
    } finally {
      setPostingAnn(false);
    }
  };

  const isOfficial = () => {
    if (!hackathon || !user) return false;
    const userId = String(user._id || user.id);
    const organiserId = hackathon.organiser?._id || hackathon.organiser;
    const isOrg = organiserId ? String(organiserId) === userId : false;
    const isJdg = hackathon.judges?.some((j: any) => String(j._id || j) === userId);
    return !!(isOrg || isJdg);
  };

  const handleJoin = async () => {
    Alert.alert('Join Channel', 'Join this hackathon channel?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Join', onPress: async () => {
          setJoining(true);
          try {
            await axios.post(`/hackathons/${hackathonId}/join`);
            Toast.show({ type: 'success', text1: 'Joined hackathon channel!' });
            loadHackathon();
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Could not join' });
          } finally {
            setJoining(false);
          }
        }
      }
    ]);
  };

  const isParticipant = !!hackathon?.participants?.map(String).includes(String(user?._id || user?.id));

  // ─── Registration window awareness (Devfolio-style guardrails) ─────────────
  const now = new Date();
  const isRegOpen =
    hackathon &&
    !['draft', 'completed'].includes(hackathon.status) &&
    (!hackathon.registrationstart || now >= new Date(hackathon.registrationstart)) &&
    (!hackathon.registrationends || now <= new Date(hackathon.registrationends));

  const regStatusLabel = !hackathon
    ? ''
    : hackathon.status === 'completed'
    ? 'Event Concluded'
    : hackathon.status === 'draft'
    ? 'Draft · Not Live'
    : !isRegOpen
    ? (hackathon.registrationends && now > new Date(hackathon.registrationends))
      ? 'Registration Closed'
      : 'Registration Opens Soon'
    : 'Registration Open';

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!hackathon) return null;

  const statusMeta = STATUS_META[hackathon.status] ?? STATUS_META.upcoming;
  const start = new Date(hackathon.hackathonstarts).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const end = new Date(hackathon.hackathonends).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />

      {/* Floating Header */}
      <Animated.View
        className="absolute top-0 left-0 right-0 z-50 bg-card border-b border-line shadow-hair"
        style={{ opacity: headerOpacity }}
        pointerEvents="none"
      >
        <SafeAreaView>
          <View className="flex-row items-center px-6 py-3">
            <Text className="text-ink font-display text-lg flex-1" numberOfLines={1}>{hackathon.title}</Text>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Back button */}
      <SafeAreaView className="absolute top-0 left-0 right-0 z-50 pointer-events-none" pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-6 pt-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl backdrop-blur-md"
          
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-row gap-3">
            {isParticipant && (
              <TouchableOpacity
                onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id })}
                className="bg-card/90 rounded-card px-5 py-2.5 shadow-hair border border-white"
              >
                <Text className="text-ink font-semibold text-label">My Team</Text>
              </TouchableOpacity>
            )}
            {isOfficial() && (
              <TouchableOpacity
                onPress={() => navigation.navigate('HackathonDashboard', { hackathonId: hackathon._id, hackathonTitle: hackathon.title })}
                className="bg-warning/90 rounded-card px-5 py-2.5 shadow-hair border border-warning/40"
              >
                <Text className="font-display text-label text-warning uppercase">Console</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonLeaderboard', { hackathonId: hackathon._id, hackathonTitle: hackathon.title })}
              className="bg-ink/90 rounded-card px-5 py-2.5 shadow-hair border border-ink"
            >
              <Text className="font-display text-label text-white uppercase">Leaderboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHackathon(); }} tintColor="#F97316" />}
      >
        {/* Banner */}
        <View className="h-72 relative">
          {hackathon.bannerImage ? (
            <Image source={{ uri: hackathon.bannerImage }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full bg-ink items-center justify-center">
              <View className="absolute inset-0"  style={{ backgroundColor: '#12100E' }} />
              <Ionicons name="rocket" size={64} color="white" className="opacity-10" />
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} className="absolute inset-0" />

          <View className="absolute bottom-16 px-gutter">
            <View className="flex-row items-center mb-3">
              <View style={{ backgroundColor: statusMeta.colors[0] }} className="border-2 border-ink px-2.5 py-1 rounded-full">
                <Text className="font-display text-label text-white uppercase">{statusMeta.label}</Text>
              </View>
            </View>
            <Text className="font-display text-white uppercase" style={{ fontSize: 34, lineHeight: 35, letterSpacing: -1.2 }}>
              {hackathon.title}
            </Text>
          </View>
        </View>

        {/* Action Bar */}
        <View className="bg-card -mt-10 mx-gutter rounded-sheet p-6 shadow-hair border border-line flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-paper-2 rounded-card items-center justify-center border border-line overflow-hidden">
              {hackathon.logo ? <Image source={{ uri: hackathon.logo }} className="w-full h-full" /> : <Ionicons name="flash" size={24} color="#F97316" />}
            </View>
            <View className="ml-4">
              <Text className="text-label text-ink-3 font-semibold">Organiser</Text>
              <Text className="text-ink text-sm font-semibold">{hackathon.organiser?.name}</Text>
            </View>
          </View>
          <View className="bg-ink border border-ink px-2.5 py-1 rounded-full">
            <Text className="text-ink-3 text-label font-semibold text-center">Prize Pool</Text>
            <Text className="text-white font-semibold text-sm">{hackathon.prizepool || 'TBA'}</Text>
          </View>
        </View>

        {/* Professional Navigation Tabs */}
        <View className="mt-4 px-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 15 }}>
            {TABS.map((tab, i) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(i)}
                className={`px-6 py-3.5 rounded-card border ${activeTab === i ? 'bg-ink border-ink' : 'bg-card border-line'}`}
              >
                <Text className={`font-semibold text-label ${activeTab === i ? 'text-white' : 'text-ink-3'}`}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Dynamic Content Sections */}
        <View className="mx-gutter mb-40">
          {/* Tab 0: Overview */}
          {activeTab === 0 && (
            <View>
              {/* Description */}
              <View className="bg-card rounded-sheet p-card-pad mb-6 border border-line shadow-hair">
                <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}><Text className="font-display text-label text-ink uppercase">About</Text><View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} /></View>
                <Text className="text-ink-3 text-sm leading-6 mb-6">
                  {hackathon.description || "Welcome to the hackathon. Deep dive into the mission details and build something extraordinary."}
                </Text>

                {hackathon.rules && hackathon.rules.length > 0 && (
                  <View>
                    <Text className="text-ink font-semibold text-base mb-4">Rules</Text>
                    {hackathon.rules.map((rule: string, i: number) => (
                      <View key={i} className="flex-row items-start mb-3">
                        <View className="w-5 h-5 bg-brand-500 rounded-lg items-center justify-center mr-3 mt-0.5"><Text className="text-ink text-label font-semibold">{i + 1}</Text></View>
                        <Text className="text-ink-2 text-xs leading-5 flex-1">{rule}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Eligibility Grid */}
              <View className="flex-row flex-wrap gap-4 mb-6">
                <View className="flex-1 min-w-[45%] bg-paper-2 rounded-card p-6 border border-line">
                  <Ionicons name="school" size={20} color="#F97316" />
                  <Text className="text-ink-3 font-semibold text-label mt-4">Colleges</Text>
                  <Text className="text-ink font-semibold text-sm mt-1">
                    {hackathon.eligibility?.colleges?.length > 0 ? hackathon.eligibility.colleges.join(', ') : 'All Institutions'}
                  </Text>
                </View>
                <View className="flex-1 min-w-[45%] bg-warning/10 rounded-card p-6 border border-warning/15">
                  <Ionicons name="people" size={20} color="#B45309" />
                  <Text className="text-warning font-semibold text-label mt-4">Team size</Text>
                  <Text className="text-warning font-semibold text-sm mt-1">Up to {hackathon.MaxTeamSize ?? 4} Agents</Text>
                </View>
              </View>

              {/* Official Seals (Judges & Mentors) */}
              {(hackathon.judges?.length > 0 || hackathon.mentors?.length > 0) && (
                <View className="bg-ink rounded-sheet p-card-pad mb-6 border border-ink shadow-hair">
                  <Text className="text-white font-semibold text-base mb-6">Judges</Text>
                  <View className="flex-row flex-wrap gap-4">
                    {hackathon.judges?.map((j: any, idx: number) => (
                      <View key={`j-${idx}`} className="flex-row items-center bg-ink rounded-card p-2 pr-4 border border-ink">
                        {j.avatar ? <Image source={{ uri: j.avatar }} className="w-8 h-8 rounded-xl" /> : <View className="w-8 h-8 rounded-xl bg-ink items-center justify-center"><Ionicons name="shield" size={12} color="#F97316" /></View>}
                        <View className="ml-3">
                          <Text className="text-brand-600 font-semibold text-label">Judge</Text>
                          <Text className="font-display text-label text-white uppercase">{j.name}</Text>
                        </View>
                      </View>
                    ))}
                    {hackathon.mentors?.map((m: any, idx: number) => (
                      <View key={`m-${idx}`} className="flex-row items-center bg-ink rounded-card p-2 pr-4 border border-ink">
                        {m.avatar ? <Image source={{ uri: m.avatar }} className="w-8 h-8 rounded-xl" /> : <View className="w-8 h-8 rounded-xl bg-ink items-center justify-center"><Ionicons name="school" size={12} color="#F97316" /></View>}
                        <View className="ml-3">
                          <Text className="text-brand-600 font-semibold text-label">Mentor</Text>
                          <Text className="font-display text-label text-white uppercase">{m.name}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Strategic Partners (Sponsors) */}
              {hackathon.sponsors?.length > 0 && (
                <View className="bg-card rounded-sheet p-card-pad mb-6 border border-line shadow-hair">
                  <Text className="text-ink font-semibold text-base mb-6">Strategic Partners</Text>
                  <View className="flex-row flex-wrap gap-6">
                    {hackathon.sponsors.map((s: any, idx: number) => (
                      <View key={idx} className="items-center">
                        <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center p-3">
                          {s.logo ? <Image source={{ uri: s.logo }} className="w-full h-full" resizeMode="contain" /> : <Ionicons name="business" size={24} color="#C4BEB6" />}
                        </View>
                        <Text className="text-label font-semibold text-ink-3 mt-2">{s.level}</Text>
                        <Text className="text-label font-semibold text-ink text-center mt-0.5">{s.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Announcements (Contact Links) */}
              <View className="bg-paper-2 rounded-sheet p-card-pad border border-line">
                <Text className="text-ink font-semibold text-base mb-6">Announcements</Text>
                <View className="gap-3">
                  {hackathon.contactEmail && (
                    <TouchableOpacity className="flex-row items-center bg-card p-4 rounded-card shadow-hair">
                      <Ionicons name="mail" size={18} color="#F97316" />
                      <Text className="text-ink-2 font-semibold text-label ml-4">{hackathon.contactEmail}</Text>
                    </TouchableOpacity>
                  )}
                  {hackathon.discordLink && (
                    <TouchableOpacity className="flex-row items-center bg-card p-4 rounded-card shadow-hair">
                      <Ionicons name="logo-discord" size={18} color="#5865F2" />
                      <Text className="text-ink-2 font-semibold text-label ml-4">Discord</Text>
                    </TouchableOpacity>
                  )}
                  {hackathon.websiteLink && (
                    <TouchableOpacity className="flex-row items-center bg-card p-4 rounded-card shadow-hair">
                      <Ionicons name="globe" size={18} color="#047857" />
                      <Text className="text-ink-2 font-semibold text-label ml-4">External Portal</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Tab 1: Timeline */}
          {activeTab === 1 && (
            <View className="bg-card rounded-sheet p-card-pad border border-line shadow-hair">
              <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}><Text className="font-display text-label text-ink uppercase">Timeline</Text><View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} /></View>
              {hackathon.timeline && hackathon.timeline.length > 0 ? (
                hackathon.timeline.map((event: any, i: number) => (
                  <View key={i} className="flex-row gap-6 mb-8 overflow-visible">
                    <View className="items-center">
                      <View className="w-10 h-10 rounded-card bg-ink items-center justify-center z-10 border-4 border-white shadow-hair">
                        <Text className="text-white font-semibold text-xs">{(i + 1).toString().padStart(2, '0')}</Text>
                      </View>
                      {i < hackathon.timeline.length - 1 && <View className="w-[2px] bg-paper-2 flex-1 -mt-2 mb-2" />}
                    </View>
                    <View className="flex-1 pt-1 pb-4">
                      <Text className="text-ink-3 font-semibold text-label">
                        {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      <Text className="text-ink font-semibold text-base mt-1">{event.label}</Text>
                      {event.description && <Text className="text-ink-3 text-xs leading-5 mt-2">{event.description}</Text>}
                    </View>
                  </View>
                ))
              ) : (
                <View className="items-center py-12">
                  <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-4">
                    <Ionicons name="calendar-outline" size={32} color="#C4BEB6" />
                  </View>
                  <Text className="text-ink-3 font-semibold text-xs">Standard schedule in execution</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 2: Tracks */}
          {activeTab === 2 && (
            <View>
              <Text className="text-ink font-display text-xl mb-6 mx-2">Strategic Tracks</Text>
              {hackathon.tracks && hackathon.tracks.length > 0 ? (
                hackathon.tracks.map((track: any, i: number) => (
                  <View
                    key={i}
                    className="rounded-sheet p-card-pad mb-4 border border-line shadow-hair"
                   style={{ backgroundColor: '#fff' }}>
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="bg-ink px-2.5 py-1 rounded-full"><Text className="font-display text-label text-white uppercase">Track {i + 1}</Text></View>
                      <View className="flex-row items-center bg-success/10 px-4 py-2 rounded-xl border border-success/15">
                        <Ionicons name="trophy" size={14} color="#047857" />
                        <Text className="text-success font-semibold text-label ml-2">{track.prizes || 'Standard Bounty'}</Text>
                      </View>
                    </View>
                    <Text className="text-ink font-display text-2xl mb-3">{track.title}</Text>
                    <Text className="text-ink-3 text-sm leading-6">{track.description}</Text>
                  </View>
                ))
              ) : (
                <View className="items-center py-20 bg-card rounded-sheet border border-line">
                  <Ionicons name="layers-outline" size={48} color="#C4BEB6" />
                  <Text className="text-ink-3 font-semibold text-xs mt-4">Open Innovation Track</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 3: Mentors */}
          {activeTab === 3 && (
            <View className="bg-card rounded-sheet p-card-pad border border-line shadow-hair">
              <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}><Text className="font-display text-label text-ink uppercase">Mentors</Text><View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} /></View>
              {hackathon.mentors && hackathon.mentors.length > 0 ? (
                <View className="flex-row flex-wrap gap-6">
                  {hackathon.mentors.map((mentor: any, i: number) => (
                    <View key={i} className="items-center w-[28%]">
                      <View className="w-16 h-16 rounded-card overflow-hidden border-2 border-line shadow-hair mb-3">
                        {mentor.avatar ? <Image source={{ uri: mentor.avatar }} className="w-full h-full" /> : <View className="w-full h-full bg-paper-2 items-center justify-center"><Ionicons name="person" size={24} color="#8B857E" /></View>}
                      </View>
                      <Text className="text-ink font-semibold text-center text-label">{mentor.name}</Text>
                      <Text className="text-ink-3 text-label font-semibold text-center mt-1">{mentor.role || 'Expert'}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="items-center py-12">
                  <Text className="text-ink-3 font-semibold text-xs">Official mentors pending signal</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 4: FAQs */}
          {activeTab === 4 && (
            <View className="bg-card rounded-sheet p-card-pad border border-line shadow-hair">
              <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}><Text className="font-display text-label text-ink uppercase">FAQ</Text><View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} /></View>
              {hackathon.faqs && hackathon.faqs.length > 0 ? (
                hackathon.faqs.map((faq: any, i: number) => <FAQItem key={i} faq={faq} />)
              ) : (
                <View className="items-center py-12">
                  <Text className="text-ink-3 font-semibold text-xs">Knowledge base expanding...</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 5: Announcements */}
          {activeTab === 5 && (
            <View>
              {isOfficial() && (
                <View className="bg-card rounded-sheet p-card-pad mb-6 border border-line shadow-hair">
                  <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}><Text className="font-display text-label text-ink uppercase">Post announcement</Text><View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} /></View>

                  {/* Type Selector */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                    {ANN_TYPES.map(t => (
                      <TouchableOpacity
                        key={t.value}
                        onPress={() => setAnnForm({ ...annForm, type: t.value })}
                        className={`flex-row items-center px-5 py-3 rounded-card border mr-3 ${annForm.type === t.value ? 'bg-ink border-ink' : 'bg-paper-2 border-line'}`}
                      >
                        <Ionicons name={t.icon as any} size={14} color={annForm.type === t.value ? 'white' : t.color} />
                        <Text className={`font-semibold text-label ml-2 ${annForm.type === t.value ? 'text-white' : 'text-ink-3'}`}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TextInput
                    value={annForm.title}
                    onChangeText={t => setAnnForm({ ...annForm, title: t })}
                    placeholder="Headline"
                    placeholderTextColor="#8B857E"
                    className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-xs border border-line"
                  />
                  <TextInput
                    value={annForm.body}
                    onChangeText={t => setAnnForm({ ...annForm, body: t })}
                    placeholder="Write the announcement…"
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#8B857E"
                    className="bg-paper-2 rounded-sheet px-6 py-4 mb-6 text-ink font-semibold text-xs border border-line h-24"
                  />

                  <View className="flex-row items-center justify-between mb-8 px-2">
                    <View className="flex-row items-center">
                      <Ionicons name="pin" size={16} color={annForm.isPinned ? '#F97316' : '#8B857E'} />
                      <Text className="text-ink-3 font-semibold text-label ml-2">Pin to Priority</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setAnnForm({ ...annForm, isPinned: !annForm.isPinned })}
                      className={`w-14 h-8 rounded-full border-2 items-center justify-center ${annForm.isPinned ? 'bg-brand-500 border-brand-400' : 'bg-paper-2 border-line'}`}
                    >
                      <View className={`w-4 h-4 rounded-full bg-card shadow-hair ${annForm.isPinned ? 'translate-x-3' : '-translate-x-3'}`} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={postAnnouncement} disabled={postingAnn} className="rounded-card overflow-hidden shadow-hair">
                    <View className="py-5 items-center justify-center flex-row" style={{ backgroundColor: '#F97316' }}>
                      {postingAnn ? <ActivityIndicator size="small" color="#12100E" /> : (
                        <>
                          <Text className="text-ink font-semibold text-xs mr-3">Send Broadcast</Text>
                          <Ionicons name="send" size={16} color="#12100E" />
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* Announcement Feed */}
              <View className="bg-card rounded-sheet p-card-pad border border-line shadow-hair min-h-[300px]">
                <View className="flex-row items-center justify-between mb-8">
                  <Text className="font-display text-label text-ink uppercase">Live now</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('HackathonChannel', { hackathonId, hackathonTitle: hackathon.title })}>
                    <Text className="text-brand-600 font-semibold text-label">Full History →</Text>
                  </TouchableOpacity>
                </View>

                {annLoading ? <ActivityIndicator size="large" color="#F97316" className="py-12" /> : announcements.length > 0 ? (
                  announcements.slice(0, 10).map((ann, i) => {
                    const type = ANN_TYPES.find(t => t.value === ann.type) || ANN_TYPES[0];
                    return (
                      <View key={i} className={`mb-6 p-6 rounded-card border ${ann.isPinned ? 'bg-paper-2 border-line' : 'bg-paper-2/50 border-line'}`}>
                        <View className="flex-row items-center justify-between mb-3">
                          <View className={`px-3 py-1 rounded-xl border flex-row items-center`} style={{ backgroundColor: type.bg, borderColor: type.color + '20' }}>
                            <Ionicons name={type.icon as any} size={10} color={type.color} />
                            <Text className="text-label font-semibold ml-1.5" style={{ color: type.color }}>{type.label}</Text>
                          </View>
                          {ann.isPinned && <Ionicons name="pin" size={14} color="#F97316" />}
                        </View>
                        <Text className="text-ink font-semibold text-sm mb-1 leading-5">{ann.Title}</Text>
                        <Text className="text-ink-3 text-xs leading-5 mb-4">{ann.body}</Text>
                        <View className="flex-row items-center">
                          {ann.author?.avatar ? <Image source={{ uri: ann.author.avatar }} className="w-5 h-5 rounded-full" /> : <View className="w-5 h-5 rounded-full bg-paper-2 items-center justify-center"><Ionicons name="person" size={10} color="#8B857E" /></View>}
                          <Text className="text-ink-3 text-label font-semibold ml-2">{ann.author?.name} • {new Date(ann.createdAt).toLocaleDateString()}</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View className="items-center py-20">
                    <Ionicons name="cloud-offline-outline" size={48} color="#C4BEB6" />
                    <Text className="text-ink-3 font-semibold text-xs mt-4">No signals received</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Tab 6: Teams */}
          {activeTab === 6 && (
            <View>
              <View className="flex-row gap-4 mb-6">
                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id, mode: 'create' })}
                  className="flex-1 rounded-card overflow-hidden shadow-hair"
                >
                  <View className="py-6 items-center" style={{ backgroundColor: '#F97316' }}>
                    <Ionicons name="add-circle" size={24} color="#12100E" />
                    <Text className="text-ink font-semibold text-xs mt-2">Initialise Team</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id, mode: 'browse' })}
                  className="flex-1 bg-card border border-line py-6 items-center shadow-hair rounded-md"
                >
                  <Ionicons name="search" size={24} color="#F97316" />
                  <Text className="text-brand-600 font-semibold text-xs mt-2">Search</Text>
                </TouchableOpacity>
              </View>
              <View className="bg-ink rounded-sheet p-card-pad border border-ink shadow-hair">
                <View className="flex-row items-center mb-4">
                  <Ionicons name="flash" size={20} color="#F97316" />
                  <Text className="text-white font-semibold text-base ml-2">Fync Engine v.2.0</Text>
                </View>
                <Text className="text-ink-4 text-xs leading-6">
                  Our proprietary Jaccard coefficient scoring analyzes your skill vectors to find the most compatible agents for your protocol. Build your squad now.
                </Text>
              </View>
            </View>
          )}

          {/* Tab 7: Prizes */}
          {activeTab === 7 && (
            <View>
              <Text className="text-ink font-display text-xl mb-6 mx-2">Prizes</Text>

              {/* Assigned Winners */}
              {hackathon.winners && hackathon.winners.length > 0 && (
                <View className="bg-success/10 border border-success/15 rounded-sheet p-6 mb-6">
                  <Text className="text-success font-semibold text-label mb-4 flex-row items-center">
                    Winners Announced
                  </Text>
                  {hackathon.winners
                    .slice()
                    .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0))
                    .map((w: any, i: number) => (
                      <View key={i} className="flex-row items-center py-3 border-b border-success/15 last:border-b-0">
                        <View className="w-12 h-12 rounded-card bg-card items-center justify-center mr-4">
                          <Text className="text-xl font-display">{`#${w.rank}`}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-ink font-semibold text-sm">
                            {w.submission?.ProjectName || `Rank ${w.rank}`}
                          </Text>
                          <Text className="text-ink-3 text-label font-semibold mt-0.5">
                            {w.team?.name || 'Team'} {w.title ? `· ${w.title}` : ''} {w.amount ? `· ${w.amount}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              )}

              {hackathon.prizes && hackathon.prizes.length > 0 ? (
                hackathon.prizes.map((prize: any, i: number) => {
                  const medalColors = [['#EDE8E0', '#B45309'], ['#EDE8E0', '#8B857E'], ['#EDE8E0', '#B45309']];
                  const [bg, tint] = medalColors[i] ?? ['#F5F2EC', '#8B857E'];
                  return (
                    <View key={i} className="bg-card rounded-sheet p-6 mb-4 border border-line flex-row items-center shadow-hair">
                      <View className="w-20 h-20 rounded-card items-center justify-center mr-6 border border-line" style={{ backgroundColor: bg }}>
                        <Text className="font-display text-3xl" style={{ color: tint }}>{i + 1}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-ink-3 font-semibold text-label">{prize.title}</Text>
                        <Text className="text-ink font-display text-2xl mt-1" style={{ color: tint }}>{prize.amount}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View className="items-center py-20 bg-card rounded-sheet border border-line">
                  <Ionicons name="trophy-outline" size={48} color="#C4BEB6" />
                  <Text className="text-ink-3 font-semibold text-xs mt-4">Prizes in allocation phase</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Professional Floating CTA Footer */}
      <View className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4 bg-card/95 border-t border-line backdrop-blur-xl">
        {!isParticipant ? (
          <TouchableOpacity onPress={isRegOpen ? handleJoin : undefined} disabled={joining || !isRegOpen} activeOpacity={0.9}>
            <View
              style={{ backgroundColor: isRegOpen ? '#F97316' : '#C4BEB6' }}
              className="rounded-md border-2 border-ink"
            >
              <View className="py-5 flex-row items-center justify-center">
                {joining ? (
                  <ActivityIndicator size="small" color="#12100E" />
                ) : (
                  <>
                    <Ionicons name={isRegOpen ? "planet" : "lock-closed"} size={20} color="#12100E" />
                    <Text className="text-ink font-display uppercase text-base ml-3">
                      {isRegOpen ? 'Join Ecosystem Registry' : regStatusLabel.toUpperCase()}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id })}
              className="flex-[1.5] rounded-card bg-ink py-5 items-center justify-center shadow-hair flex-row"
              style={{ borderRadius: 20 }}
            >
              <Ionicons name="people" size={18} color="white" />
              <Text className="text-white font-semibold text-label ml-2">My SQUAD</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonSubmission', { hackathonId: hackathon._id })}
              className="flex-[2] rounded-card bg-brand-500 py-5 items-center justify-center shadow-hair flex-row"
              style={{ borderRadius: 20 }}
            >
              <Ionicons name="cloud-upload" size={18} color="#12100E" />
              <Text className="text-ink font-semibold text-label ml-2">DEPLOY PROJECT</Text>
            </TouchableOpacity>

            {isOfficial() && (
              <>
                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonCreate', { hackathonId: hackathon._id })}
                  className="w-16 rounded-card bg-ink items-center justify-center shadow-hair border border-ink"
                  style={{ borderRadius: 20 }}
                >
                  <Ionicons name="create-outline" size={24} color="#F97316" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const nextStatus = hackathon.status === 'draft' ? 'upcoming' : 'draft';
                    Alert.alert(
                      hackathon.status === 'draft' ? 'Resume Protocol' : 'Pause Protocol',
                      `Change status to ${nextStatus.toUpperCase()}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Execute', onPress: async () => {
                            try {
                              await axios.patch(`/hackathons/${hackathon._id}/status`, { status: nextStatus });
                              Toast.show({ type: 'success', text1: 'Signal Updated' });
                              loadHackathon();
                            } catch {
                              Toast.show({ type: 'error', text1: 'Status change failed' });
                            }
                          }
                        }
                      ]
                    );
                  }}
                  className={`w-14 rounded-card items-center justify-center shadow-hair ${hackathon.status === 'draft' ? 'bg-success' : 'bg-paper-2'}`}
                  style={{ borderRadius: 20 }}
                >
                  <Ionicons name={hackathon.status === 'draft' ? "play" : "pause"} size={20} color={hackathon.status === 'draft' ? "white" : "#57534E"} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonJudgePanel', { hackathonId: hackathon._id, judgingCriteria: hackathon.judgingcriteria })}
                  className="w-16 rounded-card bg-warning items-center justify-center shadow-hair"
                  style={{ borderRadius: 20 }}
                >
                  <Ionicons name="shield-checkmark" size={24} color="#B45309" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default HackathonDetail;
