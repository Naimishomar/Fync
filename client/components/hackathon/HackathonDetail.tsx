import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';
import socket from '../../utils/socket';

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
  active: { label: 'Live Now 🔥', colors: ['#10b981', '#059669'] },
  upcoming: { label: 'Upcoming', colors: ['#6366f1', '#8b5cf6'] },
  judging: { label: 'In Judging', colors: ['#f59e0b', '#d97706'] },
  completed: { label: 'Completed', colors: ['#64748b', '#475569'] },
  draft: { label: 'Draft', colors: ['#ec4899', '#be185d'] },
};

// ─── Announcement type config ──────────────────────────────────────────────────
const ANN_TYPES: { value: string; label: string; icon: string; color: string; bg: string }[] = [
  { value: 'general', label: 'General', icon: 'megaphone', color: '#ec4899', bg: '#fdf2f8' },
  { value: 'important', label: 'Important', icon: 'alert-circle', color: '#f43f5e', bg: '#fff1f2' },
  { value: 'schedule_change', label: 'Schedule', icon: 'calendar', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'result', label: 'Result', icon: 'trophy', color: '#10b981', bg: '#ecfdf5' },
];

const TABS = ['Overview', 'Timeline', 'Tracks', 'Mentors', 'FAQs', 'Announcements', 'Teams', 'Prizes'];

// ─── Collapsible FAQ Item ──────────────────────────────────────────────────
const FAQItem = ({ faq }: { faq: { question: string; answer: string } }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      className="bg-slate-50 rounded-2xl p-5 mb-3 border border-slate-100"
    >
      <View className="flex-row justify-between items-center">
        <Text className="text-slate-900 font-black  uppercase text-xs tracking-tight flex-1">{faq.question}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#ec4899" />
      </View>
      {expanded && <Text className="text-slate-500 text-xs leading-5 mt-3">{faq.answer}</Text>}
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
        text1: `📢 ${ann.Title}`,
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
      Toast.show({ type: 'success', text1: 'Broadcast Live! 📣' });
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
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!hackathon) return null;

  const statusMeta = STATUS_META[hackathon.status] ?? STATUS_META.upcoming;
  const start = new Date(hackathon.hackathonstarts).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const end = new Date(hackathon.hackathonends).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      {/* Floating Header */}
      <Animated.View
        className="absolute top-0 left-0 right-0 z-50 bg-white border-b border-slate-50 shadow-sm"
        style={{ opacity: headerOpacity }}
        pointerEvents="none"
      >
        <SafeAreaView>
          <View className="flex-row items-center px-6 py-3">
            <Text className="text-slate-900 font-black  text-lg uppercase tracking-tight flex-1" numberOfLines={1}>{hackathon.title}</Text>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Back button */}
      <SafeAreaView className="absolute top-0 left-0 right-0 z-50 pointer-events-none" pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-6 pt-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-12 h-12 rounded-2xl bg-black/40 items-center justify-center backdrop-blur-md border border-white/20"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-row gap-3">
            {isParticipant && (
              <TouchableOpacity
                onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id })}
                className="bg-white/90 rounded-2xl px-5 py-2.5 shadow-sm border border-white"
              >
                <Text className="text-slate-900 font-black  text-2xs uppercase tracking-wide">My Team</Text>
              </TouchableOpacity>
            )}
            {isOfficial() && (
              <TouchableOpacity
                onPress={() => navigation.navigate('HackathonDashboard', { hackathonId: hackathon._id, hackathonTitle: hackathon.title })}
                className="bg-amber-400/90 rounded-2xl px-5 py-2.5 shadow-sm border border-amber-300"
              >
                <Text className="text-amber-900 font-black  text-2xs uppercase tracking-wide">🛠️ Console</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonLeaderboard', { hackathonId: hackathon._id, hackathonTitle: hackathon.title })}
              className="bg-slate-900/90 rounded-2xl px-5 py-2.5 shadow-sm border border-slate-700"
            >
              <Text className="text-white font-black  text-2xs uppercase tracking-wide">🏆 Leaderboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHackathon(); }} tintColor="#f97316" />}
      >
        {/* Banner */}
        <View className="h-72 relative">
          {hackathon.bannerImage ? (
            <Image source={{ uri: hackathon.bannerImage }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full bg-slate-950 items-center justify-center">
              <LinearGradient colors={['#312e81', '#1e1b4b']} className="absolute inset-0" />
              <Ionicons name="rocket" size={64} color="white" className="opacity-10" />
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} className="absolute inset-0" />

          <View className="absolute bottom-16 px-8">
            <View className="flex-row items-center mb-3">
              <LinearGradient colors={statusMeta.colors as any} className="px-4 py-1.5 rounded-xl border border-white/20">
                <Text className="text-white font-black  text-2xs uppercase tracking-wide">{statusMeta.label}</Text>
              </LinearGradient>
            </View>
            <Text className="text-white text-4xl font-black  tracking-tighter uppercase leading-[40px] drop-shadow-xl">
              {hackathon.title}
            </Text>
          </View>
        </View>

        {/* Action Bar */}
        <View className="bg-white -mt-10 mx-6 rounded-4xl p-6 shadow-2xl shadow-black/10 border border-slate-50 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100 overflow-hidden">
              {hackathon.logo ? <Image source={{ uri: hackathon.logo }} className="w-full h-full" /> : <Ionicons name="flash" size={24} color="#ec4899" />}
            </View>
            <View className="ml-4">
              <Text className="text-2xs text-slate-500 font-black uppercase tracking-wide">Organiser</Text>
              <Text className="text-slate-900 text-sm font-black  uppercase">{hackathon.organiser?.name}</Text>
            </View>
          </View>
          <View className="bg-slate-900 px-5 py-3 rounded-2xl border border-slate-800">
            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide text-center">Prize Pool</Text>
            <Text className="text-white font-black  uppercase text-sm">{hackathon.prizepool || 'TBA'}</Text>
          </View>
        </View>

        {/* Professional Navigation Tabs */}
        <View className="mt-4 px-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 15 }}>
            {TABS.map((tab, i) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(i)}
                className={`px-6 py-3.5 rounded-2xl border ${activeTab === i ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              >
                <Text className={`font-black  text-2xs uppercase tracking-widest ${activeTab === i ? 'text-white' : 'text-slate-500'}`}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Dynamic Content Sections */}
        <View className="mx-6 mb-40">
          {/* Tab 0: Overview */}
          {activeTab === 0 && (
            <View>
              {/* Description */}
              <View className="bg-white rounded-4xl p-8 mb-6 border border-slate-50 shadow-sm">
                <Text className="text-slate-900 font-black  text-xl uppercase tracking-tighter mb-4">📖 Mission Protocol</Text>
                <Text className="text-slate-500 text-sm leading-6 mb-6">
                  {hackathon.description || "Welcome to the hackathon. Deep dive into the mission details and build something extraordinary."}
                </Text>

                {hackathon.rules && hackathon.rules.length > 0 && (
                  <View>
                    <Text className="text-slate-900 font-black  text-base uppercase tracking-widest mb-4">Commandments</Text>
                    {hackathon.rules.map((rule: string, i: number) => (
                      <View key={i} className="flex-row items-start mb-3">
                        <View className="w-5 h-5 bg-pink-500 rounded-lg items-center justify-center mr-3 mt-0.5"><Text className="text-white text-2xs font-black">{i + 1}</Text></View>
                        <Text className="text-slate-600 text-xs leading-5 flex-1">{rule}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Eligibility Grid */}
              <View className="flex-row flex-wrap gap-4 mb-6">
                <View className="flex-1 min-w-[45%] bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100">
                  <Ionicons name="school" size={20} color="#6366f1" />
                  <Text className="text-indigo-400 font-black uppercase text-2xs tracking-wide mt-4">College Protocols</Text>
                  <Text className="text-indigo-900 font-black  text-sm uppercase mt-1">
                    {hackathon.eligibility?.colleges?.length > 0 ? hackathon.eligibility.colleges.join(', ') : 'All Institutions'}
                  </Text>
                </View>
                <View className="flex-1 min-w-[45%] bg-amber-50/50 rounded-3xl p-6 border border-amber-100">
                  <Ionicons name="people" size={20} color="#f59e0b" />
                  <Text className="text-amber-400 font-black uppercase text-2xs tracking-wide mt-4">Registry Size</Text>
                  <Text className="text-amber-900 font-black  text-sm uppercase mt-1">Up to {hackathon.MaxTeamSize ?? 4} Agents</Text>
                </View>
              </View>

              {/* Official Seals (Judges & Mentors) */}
              {(hackathon.judges?.length > 0 || hackathon.mentors?.length > 0) && (
                <View className="bg-slate-900 rounded-5xl p-8 mb-6 border border-slate-800 shadow-xl">
                  <Text className="text-white font-black  text-base uppercase tracking-widest mb-6">Verified Officials</Text>
                  <View className="flex-row flex-wrap gap-4">
                    {hackathon.judges?.map((j: any, idx: number) => (
                      <View key={`j-${idx}`} className="flex-row items-center bg-slate-800 rounded-2xl p-2 pr-4 border border-slate-700">
                        {j.avatar ? <Image source={{ uri: j.avatar }} className="w-8 h-8 rounded-xl" /> : <View className="w-8 h-8 rounded-xl bg-slate-700 items-center justify-center"><Ionicons name="shield" size={12} color="#ec4899" /></View>}
                        <View className="ml-3">
                          <Text className="text-pink-500 font-black text-2xs uppercase">Judge</Text>
                          <Text className="text-white font-bold text-2xs">{j.name}</Text>
                        </View>
                      </View>
                    ))}
                    {hackathon.mentors?.map((m: any, idx: number) => (
                      <View key={`m-${idx}`} className="flex-row items-center bg-slate-800 rounded-2xl p-2 pr-4 border border-slate-700">
                        {m.avatar ? <Image source={{ uri: m.avatar }} className="w-8 h-8 rounded-xl" /> : <View className="w-8 h-8 rounded-xl bg-slate-700 items-center justify-center"><Ionicons name="school" size={12} color="#6366f1" /></View>}
                        <View className="ml-3">
                          <Text className="text-indigo-500 font-black text-2xs uppercase">Mentor</Text>
                          <Text className="text-white font-bold text-2xs">{m.name}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Strategic Partners (Sponsors) */}
              {hackathon.sponsors?.length > 0 && (
                <View className="bg-white rounded-5xl p-8 mb-6 border border-slate-50 shadow-sm">
                  <Text className="text-slate-900 font-black  text-base uppercase tracking-widest mb-6">Strategic Partners</Text>
                  <View className="flex-row flex-wrap gap-6">
                    {hackathon.sponsors.map((s: any, idx: number) => (
                      <View key={idx} className="items-center">
                        <View className="w-20 h-20 bg-slate-50 rounded-3xl items-center justify-center border border-slate-100 p-3 shadow-sm">
                          {s.logo ? <Image source={{ uri: s.logo }} className="w-full h-full" resizeMode="contain" /> : <Ionicons name="business" size={24} color="#CBD5E1" />}
                        </View>
                        <Text className="text-2xs font-black uppercase text-slate-500 mt-2 tracking-wide">{s.level}</Text>
                        <Text className="text-2xs font-bold text-slate-900 text-center mt-0.5">{s.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Official Signals (Contact Links) */}
              <View className="bg-slate-50 rounded-5xl p-8 border border-slate-100 shadow-inner">
                <Text className="text-slate-900 font-black  text-base uppercase tracking-widest mb-6">Official Signals</Text>
                <View className="gap-3">
                  {hackathon.contactEmail && (
                    <TouchableOpacity className="flex-row items-center bg-white p-4 rounded-2xl shadow-sm">
                      <Ionicons name="mail" size={18} color="#ec4899" />
                      <Text className="text-slate-600 font-black text-2xs uppercase tracking-wide ml-4">{hackathon.contactEmail}</Text>
                    </TouchableOpacity>
                  )}
                  {hackathon.discordLink && (
                    <TouchableOpacity className="flex-row items-center bg-white p-4 rounded-2xl shadow-sm">
                      <Ionicons name="logo-discord" size={18} color="#5865F2" />
                      <Text className="text-slate-600 font-black text-2xs uppercase tracking-wide ml-4">Discord Registry</Text>
                    </TouchableOpacity>
                  )}
                  {hackathon.websiteLink && (
                    <TouchableOpacity className="flex-row items-center bg-white p-4 rounded-2xl shadow-sm">
                      <Ionicons name="globe" size={18} color="#10b981" />
                      <Text className="text-slate-600 font-black text-2xs uppercase tracking-wide ml-4">External Portal</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Tab 1: Timeline */}
          {activeTab === 1 && (
            <View className="bg-white rounded-5xl p-8 border border-slate-50 shadow-sm">
              <Text className="text-slate-900 font-black  text-xl uppercase tracking-tighter mb-8">🕒 Operation Timeline</Text>
              {hackathon.timeline && hackathon.timeline.length > 0 ? (
                hackathon.timeline.map((event: any, i: number) => (
                  <View key={i} className="flex-row gap-6 mb-8 overflow-visible">
                    <View className="items-center">
                      <View className="w-10 h-10 rounded-2xl bg-slate-900 items-center justify-center z-10 border-4 border-white shadow-md">
                        <Text className="text-white font-black text-xs">{(i + 1).toString().padStart(2, '0')}</Text>
                      </View>
                      {i < hackathon.timeline.length - 1 && <View className="w-[2px] bg-slate-100 flex-1 -mt-2 mb-2" />}
                    </View>
                    <View className="flex-1 pt-1 pb-4">
                      <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">
                        {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      <Text className="text-slate-900 font-black  text-base uppercase tracking-tight mt-1">{event.label}</Text>
                      {event.description && <Text className="text-slate-500 text-xs leading-5 mt-2">{event.description}</Text>}
                    </View>
                  </View>
                ))
              ) : (
                <View className="items-center py-12">
                  <View className="w-16 h-16 bg-slate-50 rounded-3xl items-center justify-center mb-4">
                    <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
                  </View>
                  <Text className="text-slate-500 font-black uppercase text-xs">Standard schedule in execution</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 2: Tracks */}
          {activeTab === 2 && (
            <View>
              <Text className="text-slate-900 font-black  text-xl uppercase tracking-tighter mb-6 mx-2">📡 Strategic Tracks</Text>
              {hackathon.tracks && hackathon.tracks.length > 0 ? (
                hackathon.tracks.map((track: any, i: number) => (
                  <LinearGradient
                    key={i}
                    colors={['#fff', '#f8fafc']}
                    className="rounded-4xl p-8 mb-4 border border-slate-100 shadow-sm"
                  >
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="bg-slate-900 px-4 py-2 rounded-xl"><Text className="text-white font-black  uppercase text-2xs">Track {i + 1}</Text></View>
                      <View className="flex-row items-center bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                        <Ionicons name="trophy" size={14} color="#10b981" />
                        <Text className="text-emerald-600 font-black  uppercase text-2xs ml-2">{track.prizes || 'Standard Bounty'}</Text>
                      </View>
                    </View>
                    <Text className="text-slate-900 font-black  text-2xl uppercase tracking-tighter mb-3">{track.title}</Text>
                    <Text className="text-slate-500 text-sm leading-6">{track.description}</Text>
                  </LinearGradient>
                ))
              ) : (
                <View className="items-center py-20 bg-white rounded-5xl border border-slate-50">
                  <Ionicons name="layers-outline" size={48} color="#CBD5E1" />
                  <Text className="text-slate-500 font-black uppercase text-xs mt-4">Open Innovation Track</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 3: Mentors */}
          {activeTab === 3 && (
            <View className="bg-white rounded-5xl p-8 border border-slate-50 shadow-sm">
              <Text className="text-slate-900 font-black  text-xl uppercase tracking-tighter mb-8">💡 Mission Advisors</Text>
              {hackathon.mentors && hackathon.mentors.length > 0 ? (
                <View className="flex-row flex-wrap gap-6">
                  {hackathon.mentors.map((mentor: any, i: number) => (
                    <View key={i} className="items-center w-[28%]">
                      <View className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm mb-3">
                        {mentor.avatar ? <Image source={{ uri: mentor.avatar }} className="w-full h-full" /> : <View className="w-full h-full bg-slate-50 items-center justify-center"><Ionicons name="person" size={24} color="#94a3b8" /></View>}
                      </View>
                      <Text className="text-slate-900 font-black  text-center uppercase text-2xs tracking-tight">{mentor.name}</Text>
                      <Text className="text-slate-500 text-2xs font-black uppercase text-center mt-1">{mentor.role || 'Expert'}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="items-center py-12">
                  <Text className="text-slate-500 font-black uppercase text-xs">Official mentors pending signal</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 4: FAQs */}
          {activeTab === 4 && (
            <View className="bg-white rounded-5xl p-8 border border-slate-50 shadow-sm">
              <Text className="text-slate-900 font-black  text-xl uppercase tracking-tighter mb-8">💬 Protocol FAQ</Text>
              {hackathon.faqs && hackathon.faqs.length > 0 ? (
                hackathon.faqs.map((faq: any, i: number) => <FAQItem key={i} faq={faq} />)
              ) : (
                <View className="items-center py-12">
                  <Text className="text-slate-500 font-black uppercase text-xs">Knowledge base expanding...</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 5: Announcements */}
          {activeTab === 5 && (
            <View>
              {isOfficial() && (
                <View className="bg-white rounded-5xl p-8 mb-6 border border-pink-100 shadow-xl shadow-pink-500/5">
                  <Text className="text-slate-900 font-black  text-xl uppercase tracking-tighter mb-6">📢 Broadcast Signal</Text>

                  {/* Type Selector */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                    {ANN_TYPES.map(t => (
                      <TouchableOpacity
                        key={t.value}
                        onPress={() => setAnnForm({ ...annForm, type: t.value })}
                        className={`flex-row items-center px-5 py-3 rounded-2xl border mr-3 ${annForm.type === t.value ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      >
                        <Ionicons name={t.icon as any} size={14} color={annForm.type === t.value ? 'white' : t.color} />
                        <Text className={`font-black  uppercase text-2xs tracking-widest ml-2 ${annForm.type === t.value ? 'text-white' : 'text-slate-500'}`}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TextInput
                    value={annForm.title}
                    onChangeText={t => setAnnForm({ ...annForm, title: t })}
                    placeholder="HEADLINE PROTOCOL"
                    placeholderTextColor="#94a3b8"
                    className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-slate-900 font-black  uppercase text-xs border border-slate-100"
                  />
                  <TextInput
                    value={annForm.body}
                    onChangeText={t => setAnnForm({ ...annForm, body: t })}
                    placeholder="DETAILED INTEL..."
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#94a3b8"
                    className="bg-slate-50 rounded-4xl px-6 py-4 mb-6 text-slate-900 font-black  uppercase text-xs border border-slate-100 h-24"
                  />

                  <View className="flex-row items-center justify-between mb-8 px-2">
                    <View className="flex-row items-center">
                      <Ionicons name="pin" size={16} color={annForm.isPinned ? '#ec4899' : '#94a3b8'} />
                      <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide ml-2">Pin to Priority</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setAnnForm({ ...annForm, isPinned: !annForm.isPinned })}
                      className={`w-14 h-8 rounded-full border-2 items-center justify-center ${annForm.isPinned ? 'bg-pink-500 border-pink-400' : 'bg-slate-100 border-slate-200'}`}
                    >
                      <View className={`w-4 h-4 rounded-full bg-white shadow-sm ${annForm.isPinned ? 'translate-x-3' : '-translate-x-3'}`} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={postAnnouncement} disabled={postingAnn} className="rounded-3xl overflow-hidden shadow-lg shadow-pink-500/20">
                    <LinearGradient colors={['#ec4899', '#f43f5e']} className="py-5 items-center justify-center flex-row">
                      {postingAnn ? <ActivityIndicator size="small" color="white" /> : (
                        <>
                          <Text className="text-white font-black  uppercase text-xs tracking-wide mr-3">Send Broadcast</Text>
                          <Ionicons name="send" size={16} color="white" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Announcement Feed */}
              <View className="bg-white rounded-5xl p-8 border border-slate-50 shadow-sm min-h-[300px]">
                <View className="flex-row items-center justify-between mb-8">
                  <Text className="text-slate-900 font-black  text-xl uppercase tracking-tighter">📡 Live Protocol</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('HackathonChannel', { hackathonId, hackathonTitle: hackathon.title })}>
                    <Text className="text-pink-500 font-black uppercase text-2xs tracking-wide">Full History →</Text>
                  </TouchableOpacity>
                </View>

                {annLoading ? <ActivityIndicator size="large" color="#f97316" className="py-12" /> : announcements.length > 0 ? (
                  announcements.slice(0, 10).map((ann, i) => {
                    const type = ANN_TYPES.find(t => t.value === ann.type) || ANN_TYPES[0];
                    return (
                      <View key={i} className={`mb-6 p-6 rounded-3xl border ${ann.isPinned ? 'bg-indigo-50/20 border-indigo-100' : 'bg-slate-50/50 border-slate-100'}`}>
                        <View className="flex-row items-center justify-between mb-3">
                          <View className={`px-3 py-1 rounded-xl border flex-row items-center`} style={{ backgroundColor: type.bg, borderColor: type.color + '20' }}>
                            <Ionicons name={type.icon as any} size={10} color={type.color} />
                            <Text className="text-2xs font-black uppercase ml-1.5" style={{ color: type.color }}>{type.label}</Text>
                          </View>
                          {ann.isPinned && <Ionicons name="pin" size={14} color="#6366f1" />}
                        </View>
                        <Text className="text-slate-900 font-black  text-sm uppercase mb-1 leading-5">{ann.Title}</Text>
                        <Text className="text-slate-500 text-xs leading-5 mb-4">{ann.body}</Text>
                        <View className="flex-row items-center">
                          {ann.author?.avatar ? <Image source={{ uri: ann.author.avatar }} className="w-5 h-5 rounded-full" /> : <View className="w-5 h-5 rounded-full bg-slate-200 items-center justify-center"><Ionicons name="person" size={10} color="#94a3b8" /></View>}
                          <Text className="text-slate-500 text-2xs font-black uppercase ml-2">{ann.author?.name} • {new Date(ann.createdAt).toLocaleDateString()}</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View className="items-center py-20">
                    <Ionicons name="cloud-offline-outline" size={48} color="#CBD5E1" />
                    <Text className="text-slate-500 font-black uppercase text-xs mt-4">No signals received</Text>
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
                  className="flex-1 rounded-3xl overflow-hidden shadow-lg shadow-indigo-500/20"
                >
                  <LinearGradient colors={['#6366f1', '#4338ca']} className="py-6 items-center">
                    <Ionicons name="add-circle" size={24} color="white" />
                    <Text className="text-white font-black  text-xs uppercase tracking-wide mt-2">Initialise Team</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id, mode: 'browse' })}
                  className="flex-1 rounded-3xl bg-white border border-slate-100 py-6 items-center shadow-sm"
                >
                  <Ionicons name="search" size={24} color="#6366f1" />
                  <Text className="text-indigo-600 font-black  text-xs uppercase tracking-wide mt-2">Search Registry</Text>
                </TouchableOpacity>
              </View>
              <View className="bg-indigo-900 rounded-4xl p-8 border border-indigo-800 shadow-xl shadow-indigo-500/10">
                <View className="flex-row items-center mb-4">
                  <Ionicons name="flash" size={20} color="#818cf8" />
                  <Text className="text-white font-black  text-base uppercase ml-2">Fync Engine v.2.0</Text>
                </View>
                <Text className="text-indigo-200 text-xs leading-6">
                  Our proprietary Jaccard coefficient scoring analyzes your skill vectors to find the most compatible agents for your protocol. Build your squad now.
                </Text>
              </View>
            </View>
          )}

          {/* Tab 7: Prizes */}
          {activeTab === 7 && (
            <View>
              <Text className="text-slate-900 font-black  text-xl uppercase tracking-tighter mb-6 mx-2">🏆 Bounty Distribution</Text>

              {/* Assigned Winners */}
              {hackathon.winners && hackathon.winners.length > 0 && (
                <View className="bg-emerald-50/60 border border-emerald-100 rounded-4xl p-6 mb-6">
                  <Text className="text-emerald-700 font-black uppercase text-2xs tracking-wide mb-4 flex-row items-center">
                    ✅ Winners Announced
                  </Text>
                  {hackathon.winners
                    .slice()
                    .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0))
                    .map((w: any, i: number) => (
                      <View key={i} className="flex-row items-center py-3 border-b border-emerald-100 last:border-b-0">
                        <View className="w-12 h-12 rounded-2xl bg-white items-center justify-center mr-4">
                          <Text className="text-xl font-black">{['🥇','🥈','🥉'][(w.rank||1)-1] || `#${w.rank}`}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-900 font-black text-sm uppercase tracking-tight">
                            {w.submission?.ProjectName || `Rank ${w.rank}`}
                          </Text>
                          <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">
                            {w.team?.name || 'Team'} {w.title ? `· ${w.title}` : ''} {w.amount ? `· ${w.amount}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              )}

              {hackathon.prizes && hackathon.prizes.length > 0 ? (
                hackathon.prizes.map((prize: any, i: number) => {
                  const medalColors = [['#fef3c7', '#d97706'], ['#f1f5f9', '#64748b'], ['#fef3c7', '#92400e']];
                  const [bg, tint] = medalColors[i] ?? ['#f8fafc', '#64748b'];
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <View key={i} className="bg-white rounded-4xl p-6 mb-4 border border-slate-100 flex-row items-center shadow-sm">
                      <View className="w-20 h-20 rounded-3xl items-center justify-center mr-6 border border-slate-50" style={{ backgroundColor: bg }}>
                        <Text className="text-4xl">{medals[i] ?? `#${prize.rank}`}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">{prize.title}</Text>
                        <Text className="text-slate-900 font-black  text-2xl uppercase tracking-tighter mt-1" style={{ color: tint }}>{prize.amount}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View className="items-center py-20 bg-white rounded-5xl border border-slate-50">
                  <Ionicons name="trophy-outline" size={48} color="#CBD5E1" />
                  <Text className="text-slate-500 font-black uppercase text-xs mt-4">Prizes in allocation phase</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Professional Floating CTA Footer */}
      <View className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4 bg-white/95 border-t border-slate-50 backdrop-blur-xl">
        {!isParticipant ? (
          <TouchableOpacity onPress={isRegOpen ? handleJoin : undefined} disabled={joining || !isRegOpen} activeOpacity={0.9}>
            <LinearGradient
              colors={isRegOpen ? ['#ec4899', '#f43f5e'] : ['#cbd5e1', '#94a3b8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              className="rounded-2xl shadow-xl shadow-pink-500/20"
            >
              <View className="py-5 flex-row items-center justify-center">
                {joining ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name={isRegOpen ? "planet" : "lock-closed"} size={20} color="white" />
                    <Text className="text-white font-black  text-base uppercase tracking-widest ml-3">
                      {isRegOpen ? 'Join Ecosystem Registry' : regStatusLabel.toUpperCase()}
                    </Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id })}
              className="flex-[1.5] rounded-24px bg-slate-900 py-5 items-center justify-center shadow-lg shadow-black/10 flex-row"
              style={{ borderRadius: 24 }}
            >
              <Ionicons name="people" size={18} color="white" />
              <Text className="text-white font-black  text-2xs uppercase tracking-wide ml-2">My SQUAD</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonSubmission', { hackathonId: hackathon._id })}
              className="flex-[2] rounded-24px bg-pink-500 py-5 items-center justify-center shadow-lg shadow-pink-500/20 flex-row"
              style={{ borderRadius: 24 }}
            >
              <Ionicons name="cloud-upload" size={18} color="white" />
              <Text className="text-white font-black  text-2xs uppercase tracking-wide ml-2">DEPLOY PROJECT</Text>
            </TouchableOpacity>

            {isOfficial() && (
              <>
                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonCreate', { hackathonId: hackathon._id })}
                  className="w-16 rounded-24px bg-slate-900 items-center justify-center shadow-lg border border-slate-800"
                  style={{ borderRadius: 24 }}
                >
                  <Ionicons name="create-outline" size={24} color="#ec4899" />
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
                  className={`w-14 rounded-24px items-center justify-center shadow-lg ${hackathon.status === 'draft' ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  style={{ borderRadius: 24 }}
                >
                  <Ionicons name={hackathon.status === 'draft' ? "play" : "pause"} size={20} color={hackathon.status === 'draft' ? "white" : "#475569"} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonJudgePanel', { hackathonId: hackathon._id, judgingCriteria: hackathon.judgingcriteria })}
                  className="w-16 rounded-24px bg-amber-400 items-center justify-center shadow-lg shadow-amber-400/20"
                  style={{ borderRadius: 24 }}
                >
                  <Ionicons name="shield-checkmark" size={24} color="#78350f" />
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
