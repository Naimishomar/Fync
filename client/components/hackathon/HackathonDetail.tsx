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

// ─── Types ────────────────────────────────────────────────────────────────────
interface Announcement {
  _id: string;
  Title: string;   // model uses capital T
  body: string;
  type: string;
  isPinned: boolean;
  author: { name: string; avatar?: string; role: string };
  createdAt: string;
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

const TABS = ['Overview', 'Announcements', 'Teams', 'Prizes'];

// ─── Announcement Card ─────────────────────────────────────────────────────
const AnnCard = ({ ann }: { ann: Announcement }) => (
  <View className={`bg-white rounded-2xl p-4 mb-3 border ${ann.isPinned ? 'border-amber-300' : 'border-slate-100'}`}
    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
    {ann.isPinned && (
      <View className="flex-row items-center mb-2">
        <Ionicons name="pin" size={11} color="#d97706" />
        <Text className="text-amber-600 text-[10px] font-black uppercase tracking-widest ml-1">Pinned</Text>
      </View>
    )}
    <Text className="text-zinc-900 text-sm font-black italic mb-1">{ann.Title}</Text>
    <Text className="text-slate-500 text-xs leading-5 mb-3">{ann.body}</Text>
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center">
        {ann.author?.avatar ? (
          <Image source={{ uri: ann.author.avatar }} className="w-5 h-5 rounded-full mr-1.5" />
        ) : (
          <View className="w-5 h-5 rounded-full bg-indigo-100 items-center justify-center mr-1.5">
            <Ionicons name="person" size={10} color="#6366f1" />
          </View>
        )}
        <Text className="text-xs text-slate-400 font-semibold">{ann.author?.name}</Text>
      </View>
      <Text className="text-[10px] text-slate-300 font-semibold">
        {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </Text>
    </View>
  </View>
);

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

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 160], outputRange: [0, 1], extrapolate: 'clamp' });

  useEffect(() => {
    loadHackathon();
  }, [hackathonId]);

  useEffect(() => {
    if (activeTab === 1) loadAnnouncements();
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

  const loadAnnouncements = async () => {
    setAnnLoading(true);
    try {
      const res = await axios.get(`/announcements/${hackathonId}`);
      setAnnouncements(res.data.announcements ?? []);
    } catch {
      // Silent
    } finally {
      setAnnLoading(false);
    }
  };

  const [annForm, setAnnForm] = useState({ title: '', body: '', isPinned: false });
  const [postingAnn, setPostingAnn] = useState(false);

  const isOfficial = () => {
    if (!hackathon || !user) return false;
    const isOrg = hackathon.organiser?._id === user.id;
    const isJdg = hackathon.judges?.some((j: any) => (j._id || j) === user.id || j === user.id);
    return isOrg || isJdg;
  };

  const handlePostAnnouncement = async () => {
    if (!annForm.title || !annForm.body) {
      Alert.alert('Missing Fields', 'Please enter a title and message');
      return;
    }
    setPostingAnn(true);
    try {
      const res = await axios.post(`/announcements/${hackathonId}`, {
        title: annForm.title,
        body: annForm.body,
        isPinned: annForm.isPinned,
        type: 'general'
      });
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Announcement posted!' });
        setAnnForm({ title: '', body: '', isPinned: false });
        const newAnn = { ...res.data.announcement, Title: res.data.announcement.Title || res.data.announcement.title };
        setAnnouncements([newAnn, ...announcements]);
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
      <View className="flex-1 bg-[#F8FAFC] items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!hackathon) return null;

  const statusMeta = STATUS_META[hackathon.status] ?? STATUS_META.upcoming;
  const start = new Date(hackathon.hackathonstarts).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const end   = new Date(hackathon.hackathonends).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="light-content" />

      {/* Floating Header (appears on scroll) */}
      <Animated.View
        className="absolute top-0 left-0 right-0 z-50 bg-white border-b border-slate-100"
        style={{ opacity: headerOpacity }}
        pointerEvents="none"
      >
        <SafeAreaView>
          <View className="flex-row items-center px-4 py-2">
            <Text className="text-zinc-900 font-black italic text-base flex-1" numberOfLines={1}>{hackathon.title}</Text>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Back button */}
      <SafeAreaView className="absolute top-0 left-0 right-0 z-50" pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-4 pt-2">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-2xl bg-black/30 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          {isParticipant && (
            <TouchableOpacity
              onPress={() => navigation.navigate('HackathonTeamScreen', { hackathonId: hackathon._id })}
              className="bg-white/90 rounded-2xl px-4 py-2"
            >
              <Text className="text-indigo-600 font-black text-xs uppercase tracking-wide">My Team</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHackathon(); }} tintColor="#6366f1" />}
      >
        {/* Banner */}
        <View className="h-52 relative">
          {hackathon.bannerImage ? (
            <Image source={{ uri: hackathon.bannerImage }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <LinearGradient colors={statusMeta.colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="w-full h-full items-center justify-center">
              <Ionicons name="rocket" size={56} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            className="absolute inset-0"
          />
          {/* Status */}
          <View className="absolute bottom-4 right-4">
            <LinearGradient colors={statusMeta.colors as any} className="px-3 py-1.5 rounded-full self-start">
              <Text className="text-white font-black text-[11px] uppercase tracking-widest">{statusMeta.label}</Text>
            </LinearGradient>
          </View>
          {/* Logo Overlay */}
          <View className="absolute top-36 left-6 bg-white p-1 rounded-full shadow-lg border border-slate-50 z-10">
            {hackathon.logo ? (
              <Image source={{ uri: hackathon.logo }} className="w-16 h-16 rounded-full" />
            ) : (
              <View className="w-16 h-16 rounded-full bg-indigo-50 items-center justify-center">
                <Ionicons name="rocket" size={28} color="#6366f1" />
              </View>
            )}
          </View>
        </View>

        {/* Main Info Card */}
        <View className="bg-white -mt-6 mx-4 rounded-3xl p-5 pt-10 mb-4"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 }}>

          <Text className="text-zinc-900 text-2xl font-black italic tracking-tight leading-7 mb-3">{hackathon.title}</Text>

          {/* Stats Grid */}
          <View className="flex-row flex-wrap gap-3 mb-4">
            {[
              { icon: 'calendar', label: 'Starts', val: start },
              { icon: 'calendar-clear', label: 'Ends', val: end },
              { icon: 'people', label: 'Participants', val: String(hackathon.participants?.length ?? 0) },
              { icon: 'person', label: 'Team Size', val: `Up to ${hackathon.MaxTeamSize ?? 4}` },
            ].map((s, i) => (
              <View key={i} className="flex-1 min-w-[45%] bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <Ionicons name={s.icon as any} size={14} color="#6366f1" />
                <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{s.label}</Text>
                <Text className="text-zinc-800 text-xs font-black mt-0.5">{s.val}</Text>
              </View>
            ))}
          </View>

          {/* Prize Pool */}
          {hackathon.prizepool && (
            <LinearGradient colors={['#fef3c7', '#fde68a']} className="rounded-2xl px-4 py-3 flex-row items-center mb-4">
              <Ionicons name="trophy" size={22} color="#d97706" />
              <View className="ml-3">
                <Text className="text-amber-700 text-[10px] font-black uppercase tracking-widest">Prize Pool</Text>
                <Text className="text-amber-900 text-xl font-black italic">{hackathon.prizepool}</Text>
              </View>
            </LinearGradient>
          )}

          {/* Tags */}
          {hackathon.tags && hackathon.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {hackathon.tags.map((tag, i) => (
                <View key={i} className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
                  <Text className="text-[10px] text-indigo-600 font-black uppercase tracking-tight">#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Organiser */}
          {hackathon.organiser && (
            <View className="flex-row items-center border-t border-slate-100 pt-3">
              {hackathon.organiser.avatar ? (
                <Image source={{ uri: hackathon.organiser.avatar }} className="w-8 h-8 rounded-full" />
              ) : (
                <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center">
                  <Ionicons name="person" size={14} color="#6366f1" />
                </View>
              )}
              <View className="ml-2.5">
                <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Organiser</Text>
                <Text className="text-xs text-zinc-800 font-black">{hackathon.organiser.name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View className="bg-white mx-4 rounded-2xl border border-slate-100 mb-4 overflow-hidden"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8, gap: 4 }}>
            {TABS.map((tab, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setActiveTab(i)}
                className={`px-5 py-2 rounded-2xl ${activeTab === i ? 'bg-indigo-600' : 'bg-transparent'}`}
              >
                <Text className={`font-black text-xs uppercase tracking-wide ${activeTab === i ? 'text-white' : 'text-slate-500'}`}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        <View className="mx-4 mb-32">

          {/* Overview Tab */}
          {activeTab === 0 && (
            <View>
              {/* Judging Criteria */}
              {hackathon.judgingcriteria && hackathon.judgingcriteria.length > 0 && (
                <View className="bg-white rounded-2xl p-4 mb-4 border border-slate-100">
                  <Text className="text-zinc-900 font-black italic text-base mb-3">⚖️ Judging Criteria</Text>
                  {hackathon.judgingcriteria.map((c, i) => (
                    <View key={i} className="mb-3 last:mb-0">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-zinc-800 font-black text-sm">{c.name}</Text>
                        <View className="bg-indigo-100 px-2.5 py-1 rounded-lg">
                          <Text className="text-indigo-600 font-black text-[11px]">{c.weightage}%</Text>
                        </View>
                      </View>
                      {c.description && <Text className="text-slate-500 text-xs mt-1">{c.description}</Text>}
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
                <View className="bg-white mx-5 mt-4 rounded-3xl p-5 border border-indigo-100 shadow-sm mb-6">
                  <View className="flex-row items-center mb-4">
                    <View className="w-8 h-8 rounded-xl bg-indigo-100 items-center justify-center mr-3">
                      <Ionicons name="megaphone" size={16} color="#6366f1" />
                    </View>
                    <Text className="text-zinc-900 font-black italic uppercase tracking-tight">Post Announcement</Text>
                  </View>
                  
                  <TextInput
                    placeholder="Headline (e.g. Schedule Update)"
                    placeholderTextColor="#94a3b8"
                    value={annForm.title}
                    onChangeText={(t) => setAnnForm({...annForm, title: t})}
                    className="bg-slate-50 rounded-xl px-4 py-3 mb-3 text-zinc-900 font-bold text-sm border border-slate-100"
                  />
                  <TextInput
                    placeholder="What's happening?"
                    placeholderTextColor="#94a3b8"
                    value={annForm.body}
                    onChangeText={(t) => setAnnForm({...annForm, body: t})}
                    multiline
                    numberOfLines={3}
                    className="bg-slate-50 rounded-xl px-4 py-3 mb-4 text-zinc-900 font-semibold text-xs border border-slate-100 min-h-[80px]"
                    textAlignVertical="top"
                  />

                  <View className="flex-row items-center justify-between mb-4 px-1">
                    <View className="flex-row items-center">
                      <Ionicons name="pin" size={14} color={annForm.isPinned ? '#f59e0b' : '#94a3b8'} />
                      <Text className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-2">Pin to Top</Text>
                    </View>
                    <Switch
                      value={annForm.isPinned}
                      onValueChange={(v) => setAnnForm({...annForm, isPinned: v})}
                      trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
                      thumbColor={annForm.isPinned ? '#6366f1' : '#f4f4f5'}
                    />
                  </View>

                  <TouchableOpacity 
                    onPress={handlePostAnnouncement}
                    disabled={postingAnn}
                    className="overflow-hidden rounded-2xl"
                  >
                    <LinearGradient
                      colors={['#6366f1', '#ec4899']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      className="py-3 items-center"
                    >
                      {postingAnn ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text className="text-white font-black uppercase tracking-widest text-xs">Blast Message</Text>
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
                  <View className="w-16 h-16 bg-indigo-50 rounded-3xl items-center justify-center mb-4">
                    <Ionicons name="megaphone-outline" size={30} color="#6366f1" />
                  </View>
                  <Text className="text-zinc-700 font-black italic text-base uppercase">No Announcements</Text>
                  <Text className="text-slate-400 text-xs mt-1 font-semibold">Check back later</Text>
                </View>
              ) : (
                announcements.map(ann => <AnnCard key={ann._id} ann={ann} />)
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
          </View>
        </View>
      )}
    </View>
  );
};

export default HackathonDetail;
