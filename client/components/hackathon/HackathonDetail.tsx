import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Animated,
  Alert,
  FlatList,
  RefreshControl,
  TextInput,
  Switch,
} from 'react-native';
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
  active:    { label: 'Live Now 🔥',  colors: ['#10b981', '#059669'] },
  upcoming:  { label: 'Upcoming',     colors: ['#6366f1', '#8b5cf6'] },
  judging:   { label: 'In Judging',   colors: ['#f59e0b', '#d97706'] },
  completed: { label: 'Completed',    colors: ['#64748b', '#475569'] },
  draft:     { label: 'Draft',        colors: ['#ec4899', '#be185d'] },
};

// ─── Announcement type config ──────────────────────────────────────────────────
const ANN_TYPES: { value: string; label: string; icon: string; color: string; bg: string }[] = [
  { value: 'general',         label: 'General',        icon: 'megaphone',       color: '#ec4899', bg: '#fdf2f8' },
  { value: 'important',       label: 'Important',      icon: 'alert-circle',    color: '#f43f5e', bg: '#fff1f2' },
  { value: 'schedule_change', label: 'Schedule',       icon: 'calendar',        color: '#f59e0b', bg: '#fffbeb' },
  { value: 'result',          label: 'Result',         icon: 'trophy',          color: '#10b981', bg: '#ecfdf5' },
];

const TABS = ['Overview', 'Announcements', 'Teams', 'Prizes'];

// ─── Announcement Card ─────────────────────────────────────────────────────
const AnnCard = ({ ann, onReact }: { ann: Announcement; onReact: (annId: string, emoji: string) => void }) => {
  const typeMeta = ANN_TYPES.find(t => t.value === ann.type) ?? ANN_TYPES[0];
  return (
    <View
      className={`bg-white rounded-3xl p-5 mb-4 border ${ann.isPinned ? 'border-pink-200' : 'border-slate-50'}`}
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 }}
    >
      {/* Type + Pin row */}
      <View className="flex-row items-center mb-3 gap-2">
        <View className="flex-row items-center px-3 py-1.5 rounded-xl" style={{ backgroundColor: typeMeta.bg }}>
          <Ionicons name={typeMeta.icon as any} size={12} color={typeMeta.color} />
          <Text className="text-[10px] font-black uppercase tracking-widest ml-1.5" style={{ color: typeMeta.color }}>
            {typeMeta.label}
          </Text>
        </View>
        {ann.isPinned && (
          <View className="flex-row items-center bg-zinc-900 px-3 py-1.5 rounded-xl">
            <Ionicons name="pin" size={12} color="#ec4899" />
            <Text className="text-white text-[10px] font-black uppercase tracking-widest ml-1.5">Pinned</Text>
          </View>
        )}
      </View>

      <Text className="text-zinc-900 text-base font-black italic mb-2 tracking-tight uppercase">{ann.Title}</Text>
      <Text className="text-slate-500 text-xs leading-5 mb-4">{ann.body}</Text>

      {/* Footer */}
      <View className="flex-row items-center justify-between border-t border-slate-50 pt-4">
        <View className="flex-row items-center">
          {ann.author?.avatar ? (
            <Image source={{ uri: ann.author.avatar }} className="w-6 h-6 rounded-full mr-2" />
          ) : (
            <View className="w-6 h-6 rounded-full bg-slate-100 items-center justify-center mr-2">
              <Ionicons name="person" size={12} color="#94a3b8" />
            </View>
          )}
          <View>
             <Text className="text-[10px] text-zinc-900 font-black italic uppercase leading-tight">{ann.author?.name}</Text>
             <Text className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
               {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
             </Text>
          </View>
        </View>

        {/* Quick reactions */}
        <View className="flex-row gap-1.5">
          {['👍', '🔥', '❤️'].map(emoji => (
            <TouchableOpacity
              key={emoji}
              onPress={() => onReact(ann._id, emoji)}
              className="bg-slate-50 rounded-xl px-2.5 py-1.5 border border-slate-100"
            >
              <Text className="text-xs">{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const HackathonDetail = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId } = route.params;
  const { user } = useAuth();

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
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

    return () => {
      socket.off('announcement:new', onNewAnnouncement);
      socket.emit('leave_hack_room', { hackathonId });
    };
  }, [hackathonId]);

  useEffect(() => {
    if (activeTab === 1) loadAnnouncements(1, true);
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
    if (page === 1) setAnnLoading(true);
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


  const isOfficial = () => {
    if (!hackathon || !user) return false;
    const isOrg = hackathon.organiser?._id === user.id;
    const isJdg = hackathon.judges?.some((j: any) => (j._id || j) === user.id || j === user.id);
    return isOrg || isJdg;
  };

  const handlePostAnnouncement = async () => {
    if (!annForm.title.trim() || !annForm.body.trim()) {
      Alert.alert('Missing Fields', 'Please enter a title and message');
      return;
    }
    setPostingAnn(true);
    try {
      const res = await axios.post(`/announcements/${hackathonId}`, {
        title: annForm.title.trim(),
        body: annForm.body.trim(),
        isPinned: annForm.isPinned,
        type: annForm.type,
      });
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Announcement posted! 📢' });
        setAnnForm({ title: '', body: '', isPinned: false, type: 'general' });
        const newAnn = {
          ...res.data.announcement,
          Title: res.data.announcement.Title || res.data.announcement.title,
        };
        setAnnouncements(prev => {
          const updated = [newAnn, ...prev];
          return updated.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to post',
        text2: err.response?.data?.message || 'Something went wrong'
      });
    } finally {
      setPostingAnn(false);
    }
  };

  const handleReact = async (annId: string, emoji: string) => {
    setAnnouncements(prev =>
      prev.map(a =>
        a._id === annId
          ? { ...a, reactions: [...(a.reactions ?? []), { user: user?.id, emoji }] }
          : a
      )
    );
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

  const isParticipant = hackathon?.participants?.includes(user?._id);

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#ec4899" />
      </View>
    );
  }

  if (!hackathon) return null;

  const statusMeta = STATUS_META[hackathon.status] ?? STATUS_META.upcoming;
  const start = new Date(hackathon.hackathonstarts).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const end   = new Date(hackathon.hackathonends).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      {/* Floating Header (appears on scroll) */}
      <Animated.View
        className="absolute top-0 left-0 right-0 z-50 bg-white border-b border-slate-50"
        style={{ opacity: headerOpacity }}
        pointerEvents="none"
      >
        <SafeAreaView>
          <View className="flex-row items-center px-6 py-3">
            <Text className="text-zinc-900 font-black italic text-lg uppercase tracking-tight flex-1" numberOfLines={1}>{hackathon.title}</Text>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Back button */}
      <SafeAreaView className="absolute top-0 left-0 right-0 z-50" pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-6 pt-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-12 h-12 rounded-[20px] bg-black/40 items-center justify-center backdrop-blur-md"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-row gap-3">
            {isParticipant && (
                <TouchableOpacity
                onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id })}
                className="bg-white/90 rounded-2xl px-5 py-2.5 shadow-sm"
                >
                <Text className="text-zinc-900 font-black italic text-[10px] uppercase tracking-widest">My Protocol</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                onPress={() => navigation.navigate('HackathonLeaderboard', { hackathonId: hackathon._id, hackathonTitle: hackathon.title })}
                className="bg-zinc-900/90 rounded-2xl px-5 py-2.5 shadow-sm border border-zinc-800"
            >
                <Text className="text-white font-black italic text-[10px] uppercase tracking-widest">🏆 Status</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHackathon(); }} tintColor="#ec4899" />}
      >
        {/* Banner */}
        <View className="h-64 relative">
          {hackathon.bannerImage ? (
            <Image source={{ uri: hackathon.bannerImage }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full bg-zinc-950 items-center justify-center">
                <LinearGradient colors={['#ec4899', '#f43f5e']} className="absolute inset-0 opacity-20" />
                <Ionicons name="rocket" size={64} color="white" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            className="absolute inset-0"
          />
          {/* Status */}
          <View className="absolute bottom-10 right-6">
            <LinearGradient colors={statusMeta.colors as any} className="px-5 py-2 rounded-2xl self-start border border-white/20 shadow-lg">
              <Text className="text-white font-black italic text-[11px] uppercase tracking-widest">{statusMeta.label}</Text>
            </LinearGradient>
          </View>
          {/* Logo Overlay */}
          <View className="absolute top-44 left-8 bg-white p-1 rounded-[24px] shadow-2xl border border-white/50 z-10">
            {hackathon.logo ? (
              <Image source={{ uri: hackathon.logo }} className="w-20 h-20 rounded-[20px]" resizeMode="contain" />
            ) : (
              <View className="w-20 h-20 rounded-[20px] bg-slate-50 items-center justify-center">
                <Ionicons name="flash" size={32} color="#ec4899" />
              </View>
            )}
          </View>
        </View>

        {/* Main Info Card */}
        <View className="bg-white -mt-10 mx-6 rounded-[40px] p-8 pt-16 mb-6 shadow-2xl shadow-black/10 border border-gray-50">

          <Text className="text-zinc-900 text-4xl font-black italic tracking-tighter uppercase leading-[40px] mb-6">
            {hackathon.title}
          </Text>

          {/* Stats Grid */}
          <View className="flex-row flex-wrap gap-4 mb-8">
            {[
              { icon: 'calendar', label: 'Launch', val: start },
              { icon: 'calendar-clear', label: 'EOD', val: end },
              { icon: 'people', label: 'Signals', val: String(hackathon.participants?.length ?? 0) },
              { icon: 'person', label: 'Group Size', val: `Up to ${hackathon.MaxTeamSize ?? 4}` },
            ].map((s, i) => (
              <View key={i} className="flex-1 min-w-[45%] bg-slate-50 rounded-[24px] p-5 border border-gray-100">
                <Ionicons name={s.icon as any} size={16} color="#ec4899" />
                <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">{s.label}</Text>
                <Text className="text-zinc-900 text-sm font-black italic uppercase tracking-tight mt-1">{s.val}</Text>
              </View>
            ))}
          </View>

          {/* Prize Pool */}
          {hackathon.prizepool && (
            <LinearGradient colors={['#000', '#111']} className="rounded-[28px] px-6 py-5 flex-row items-center mb-8 border border-zinc-800">
              <View className="w-14 h-14 bg-amber-400 rounded-2xl items-center justify-center shadow-lg shadow-amber-400/20">
                <Ionicons name="trophy" size={28} color="#000" />
              </View>
              <View className="ml-5">
                <Text className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Ecosystem Prize Pool</Text>
                <Text className="text-white text-3xl font-black italic uppercase tracking-tighter mt-1">{hackathon.prizepool}</Text>
              </View>
            </LinearGradient>
          )}

          {/* Tags */}
          {hackathon.tags && hackathon.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-2.5 mb-8">
              {hackathon.tags.map((tag, i) => (
                <View key={i} className="bg-slate-50 border border-gray-100 px-4 py-2 rounded-2xl">
                  <Text className="text-[10px] text-slate-500 font-black uppercase tracking-tight">#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Organiser */}
          {hackathon.organiser && (
            <View className="flex-row items-center border-t border-slate-50 pt-6">
              {hackathon.organiser.avatar ? (
                <Image source={{ uri: hackathon.organiser.avatar }} className="w-10 h-10 rounded-2xl" />
              ) : (
                <View className="w-10 h-10 rounded-2xl bg-zinc-900 items-center justify-center">
                  <Ionicons name="flash" size={18} color="white" />
                </View>
              )}
              <View className="ml-4">
                <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Control Unit</Text>
                <Text className="text-base text-zinc-900 font-black italic uppercase tracking-tight">{hackathon.organiser.name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View className="bg-white mx-6 rounded-[28px] border border-gray-100 mb-6 p-2 shadow-sm">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TABS.map((tab, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setActiveTab(i)}
                className={`px-8 py-3.5 rounded-[22px] ${activeTab === i ? 'bg-zinc-900 border border-zinc-800' : 'bg-transparent'}`}
              >
                <Text className={`font-black italic text-[11px] uppercase tracking-widest ${activeTab === i ? 'text-white' : 'text-slate-400'}`}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        <View className="mx-6 mb-40">

          {/* Overview Tab */}
          {activeTab === 0 && (
            <View>
              {/* Judging Criteria */}
              {hackathon.judgingcriteria && hackathon.judgingcriteria.length > 0 && (
                <View className="bg-white rounded-[32px] p-6 mb-6 border border-gray-50 shadow-sm">
                  <Text className="text-zinc-900 font-black italic text-xl uppercase tracking-tighter mb-4">⚖️ Evaluation Protocol</Text>
                  {hackathon.judgingcriteria.map((c, i) => (
                    <View key={i} className="mb-4 last:mb-0 bg-slate-50 p-4 rounded-2xl border border-gray-100">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-zinc-900 font-black italic uppercase text-sm tracking-tight">{c.name}</Text>
                        <View className="bg-zinc-900 px-3 py-1 rounded-xl">
                          <Text className="text-white font-black text-[10px]">{c.weightage}%</Text>
                        </View>
                      </View>
                      {c.description && <Text className="text-slate-500 text-xs leading-4">{c.description}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Eligibility */}
              {hackathon.eligibility && (
                <View className="bg-white rounded-2xl p-4 mb-4 border border-slate-100">
                  <Text className="text-zinc-900 font-black italic text-base mb-3">🎓 Eligibility</Text>
                  {hackathon.eligibility.colleges?.length > 0 && (
                    <View className="mb-2">
                      <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Colleges</Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {hackathon.eligibility.colleges.map((c, i) => (
                          <View key={i} className="bg-slate-100 px-2.5 py-1 rounded-lg">
                            <Text className="text-slate-600 text-[11px] font-semibold">{c}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {hackathon.eligibility.Year?.length > 0 && (
                    <View className="mb-2">
                      <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Year</Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {hackathon.eligibility.Year.map((y, i) => (
                          <View key={i} className="bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                            <Text className="text-indigo-600 text-[11px] font-black">{y}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Sponsors */}
              {hackathon.sponsors && hackathon.sponsors.length > 0 && (
                <View className="bg-white rounded-2xl p-4 mb-4 border border-slate-100">
                  <Text className="text-zinc-900 font-black italic text-base mb-3">🤝 Sponsors</Text>
                  <View className="flex-row flex-wrap gap-3">
                    {hackathon.sponsors.map((s, i) => (
                      <View key={i} className="bg-slate-50 rounded-xl px-4 py-2 border border-slate-100 items-center">
                        {s.logo ? (
                          <Image source={{ uri: s.logo }} className="w-12 h-6" resizeMode="contain" />
                        ) : (
                          <Text className="text-slate-600 font-black text-xs">{s.name}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Judges */}
              {hackathon.judges && hackathon.judges.length > 0 && (
                <View className="bg-white rounded-2xl p-4 mb-4 border border-slate-100">
                  <Text className="text-zinc-900 font-black italic text-base mb-3">👨‍⚖️ Judges</Text>
                  {hackathon.judges.map((j: any, i: number) => (
                    <View key={i} className="flex-row items-center mb-2.5 last:mb-0">
                      {j.avatar ? (
                        <Image source={{ uri: j.avatar }} className="w-9 h-9 rounded-full" />
                      ) : (
                        <View className="w-9 h-9 rounded-full bg-amber-100 items-center justify-center">
                          <Ionicons name="person" size={16} color="#d97706" />
                        </View>
                      )}
                      <View className="ml-3">
                        <Text className="text-zinc-800 font-black text-sm">{j.name}</Text>
                        {j.email && <Text className="text-slate-400 text-xs">{j.email}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Announcements Tab */}
          {activeTab === 1 && (
            <View>
              {isOfficial() && (
                <View className="bg-white rounded-3xl p-5 border border-indigo-100 mb-5"
                  style={{ shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}
                >
                  <View className="flex-row items-center mb-4">
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} className="w-9 h-9 rounded-xl items-center justify-center mr-3">
                      <Ionicons name="megaphone" size={16} color="white" />
                    </LinearGradient>
                    <Text className="text-zinc-900 font-black italic uppercase tracking-tight text-base">Post Announcement</Text>
                  </View>

                  {/* Type picker */}
                  <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                    {ANN_TYPES.map(t => (
                      <TouchableOpacity
                        key={t.value}
                        onPress={() => setAnnForm({ ...annForm, type: t.value })}
                        className="flex-row items-center px-3 py-2 rounded-xl border"
                        style={{
                          backgroundColor: annForm.type === t.value ? t.bg : '#f8fafc',
                          borderColor: annForm.type === t.value ? t.color : '#e2e8f0',
                        }}
                      >
                        <Ionicons name={t.icon as any} size={12} color={annForm.type === t.value ? t.color : '#94a3b8'} />
                        <Text
                          className="text-[11px] font-black ml-1.5"
                          style={{ color: annForm.type === t.value ? t.color : '#94a3b8' }}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TextInput
                    placeholder="Headline (e.g. Schedule Update)"
                    placeholderTextColor="#94a3b8"
                    value={annForm.title}
                    onChangeText={(text) => setAnnForm({ ...annForm, title: text })}
                    className="bg-slate-50 rounded-xl px-4 py-3 mb-3 text-zinc-900 font-bold text-sm border border-slate-100"
                  />
                  <TextInput
                    placeholder="What's the update?"
                    placeholderTextColor="#94a3b8"
                    value={annForm.body}
                    onChangeText={(text) => setAnnForm({ ...annForm, body: text })}
                    multiline
                    numberOfLines={3}
                    className="bg-slate-50 rounded-xl px-4 py-3 mb-4 text-zinc-900 font-semibold text-xs border border-slate-100 min-h-[80px]"
                    textAlignVertical="top"
                  />

                  {/* Pin toggle */}
                  <View className="flex-row items-center justify-between mb-4 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                    <View className="flex-row items-center">
                      <Ionicons name="pin" size={14} color={annForm.isPinned ? '#f59e0b' : '#94a3b8'} />
                      <Text className="text-[11px] text-slate-600 font-black uppercase tracking-widest ml-2">Pin to Top</Text>
                    </View>
                    <Switch
                      value={annForm.isPinned}
                      onValueChange={(v) => setAnnForm({ ...annForm, isPinned: v })}
                      trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
                      thumbColor={annForm.isPinned ? '#6366f1' : '#f4f4f5'}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handlePostAnnouncement}
                    disabled={postingAnn}
                    activeOpacity={0.88}
                    className="overflow-hidden rounded-2xl"
                  >
                    <LinearGradient
                      colors={['#6366f1', '#ec4899']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      className="py-3.5 items-center"
                    >
                      {postingAnn ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <View className="flex-row items-center">
                          <Ionicons name="send" size={14} color="white" />
                          <Text className="text-white font-black uppercase tracking-widest text-xs ml-2">Blast Message 📢</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {annLoading ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color="#6366f1" />
                </View>
              ) : announcements.length === 0 ? (
                <View className="items-center py-12">
                  <LinearGradient colors={['#ede9fe', '#fce7f3']} className="w-16 h-16 rounded-3xl items-center justify-center mb-4">
                    <Ionicons name="megaphone-outline" size={30} color="#6366f1" />
                  </LinearGradient>
                  <Text className="text-zinc-700 font-black italic text-base uppercase">No Announcements</Text>
                  <Text className="text-slate-400 text-xs mt-1 font-semibold">Check back soon</Text>
                </View>
              ) : (
                <View>
                  {announcements.map(ann => (
                    <AnnCard key={ann._id} ann={ann} onReact={handleReact} />
                  ))}
                  {annHasMore && (
                    <TouchableOpacity
                      onPress={() => loadAnnouncements(annPage + 1)}
                      className="py-3 items-center"
                    >
                      <Text className="text-indigo-500 font-black text-xs uppercase tracking-widest">Load more ↓</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Teams Tab */}
          {activeTab === 2 && (
            <View>
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id, mode: 'create' })}
                  className="flex-1 rounded-2xl overflow-hidden"
                >
                  <LinearGradient colors={['#6366f1', '#8b5cf6']} className="py-4 items-center">
                    <Ionicons name="people" size={20} color="white" />
                    <Text className="text-white font-black text-xs uppercase tracking-wide mt-1">Create Team</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id, mode: 'browse' })}
                  className="flex-1 rounded-2xl bg-white border border-indigo-200 py-4 items-center"
                >
                  <Ionicons name="search" size={20} color="#6366f1" />
                  <Text className="text-indigo-600 font-black text-xs uppercase tracking-wide mt-1">Find Team</Text>
                </TouchableOpacity>
              </View>
              <View className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                <Text className="text-indigo-700 font-black text-sm mb-1">🤝 Team Matching</Text>
                <Text className="text-indigo-500 text-xs leading-5">
                  Fync uses Jaccard skill matching to suggest the best-fit teams for you. Create a team or browse open ones!
                </Text>
              </View>
            </View>
          )}

          {/* Prizes Tab */}
          {activeTab === 3 && (
            <View>
              {hackathon.prizes && hackathon.prizes.length > 0 ? (
                hackathon.prizes.map((prize, i) => {
                  const medalColors = [['#fef3c7', '#d97706'], ['#f1f5f9', '#64748b'], ['#fef3c7', '#d97706']];
                  const [bg, text] = medalColors[i] ?? ['#f1f5f9', '#64748b'];
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <View key={i} className="bg-white rounded-2xl p-4 mb-3 border border-slate-100 flex-row items-center">
                      <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: bg }}>
                        <Text className="text-2xl">{medals[i] ?? `#${prize.rank}`}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-800 font-black italic text-base">{prize.title}</Text>
                        <Text className="font-black text-lg" style={{ color: text }}>{prize.amount}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View className="items-center py-12">
                  <Text className="text-3xl mb-3">🏆</Text>
                  <Text className="text-zinc-700 font-black italic text-base">Prize details coming soon</Text>
                </View>
              )}
            </View>
          )}

        </View>
      </Animated.ScrollView>

      {/* Sticky CTA */}
      {!isParticipant ? (
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-white border-t border-slate-100">
          <TouchableOpacity onPress={handleJoin} disabled={joining} activeOpacity={0.88}>
            <LinearGradient colors={['#6366f1', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="rounded-2xl">
              <View className="py-4 flex-row items-center justify-center">
                {joining ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="rocket" size={18} color="white" />
                    <Text className="text-white font-black italic text-sm uppercase tracking-widest ml-2">Join Hackathon</Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-white border-t border-slate-100">
        <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id })}
              className="flex-1 rounded-2xl bg-indigo-600 py-4 items-center"
            >
              <Text className="text-white font-black text-sm uppercase tracking-wide">My Team</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonSubmission', { hackathonId: hackathon._id })}
              className="flex-1 rounded-2xl border border-indigo-200 py-4 items-center"
            >
              <Text className="text-indigo-600 font-black text-sm uppercase tracking-wide">Submit</Text>
            </TouchableOpacity>
            {isOfficial() && (
              <TouchableOpacity
                onPress={() => navigation.navigate('HackathonJudgePanel', { hackathonId: hackathon._id, judgingCriteria: hackathon.judgingcriteria })}
                className="w-14 rounded-2xl bg-amber-400 py-4 items-center"
              >
                <Text className="text-amber-900 font-black text-xs">⚖️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default HackathonDetail;
