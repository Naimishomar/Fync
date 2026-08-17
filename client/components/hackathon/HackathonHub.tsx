import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth.context';

// ─── Responsive helpers ─────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 360;
const isMediumScreen = SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 414;
const responsive = (small: number, medium: number, large: number) =>
  isSmallScreen ? small : isMediumScreen ? medium : large;
const hp = (percent: number) => SCREEN_HEIGHT * (percent / 100);
const wp = (percent: number) => SCREEN_WIDTH * (percent / 100);

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
const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string; icon: string }> = {
  active: { label: 'Live', bg: '#ecfdf5', text: '#10b981', dot: '#10b981', icon: 'flash' },
  upcoming: { label: 'Upcoming', bg: '#eff6ff', text: '#3b82f6', dot: '#3b82f6', icon: 'calendar' },
  judging: { label: 'Judging', bg: '#fffbeb', text: '#f59e0b', dot: '#f59e0b', icon: 'trophy' },
  completed: { label: 'Completed', bg: '#f8fafc', text: '#64748b', dot: '#94a3b8', icon: 'checkmark-circle' },
  draft: { label: 'Draft', bg: '#fdf2f8', text: '#ec4899', dot: '#ec4899', icon: 'create' },
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const FILTERS = [
  { label: 'All', value: '' },
  { label: 'LIVE', value: 'active' },
  { label: 'SOON', value: 'upcoming' },
  { label: 'JUDGE', value: 'judging' },
  { label: 'DONE', value: 'completed' },
];

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Starting Soon', value: 'starting-soon' },
  { label: 'Prize: High to Low', value: 'prize-high' },
  { label: 'Prize: Low to High', value: 'prize-low' },
  { label: 'Most Participants', value: 'participants' },
];

const TABS = [
  { label: 'Discover', value: 'discover', icon: 'compass' },
  { label: 'My Hackathons', value: 'mine', icon: 'person' },
];

// ─── Hackathon Card ───────────────────────────────────────────────────────────
const HackathonCard = memo(({ item, onPress }: { item: Hackathon; onPress: (id: string) => void }) => {
  const status = STATUS_META[item.status] ?? STATUS_META.upcoming;
  const start = item.hackathonstarts ? new Date(item.hackathonstarts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
  const end = item.hackathonends ? new Date(item.hackathonends).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
  
  const cardMargin = responsive(4, 6, 8);
  const bannerHeight = hp(responsive(28, 32, 35));
  const borderRadius = responsive(36, 40, 48);
  const contentPadding = responsive(8, 10, 12);
  const titleSize = responsive(20, 24, 28);
  
  return (
    <Pressable
      onPress={() => onPress(item._id)}
      style={({ pressed }) => [
        {
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        { marginHorizontal: cardMargin },
      ]}
      className="mb-10"
    >
      <View className="bg-white overflow-hidden border border-slate-100 shadow-2xl shadow-black/5" style={{ borderRadius }}>
        {/* Banner with Cyber Overlay */}
        <View className="relative" style={{ height: bannerHeight }}>
          {item.bannerImage ? (
            <Image source={{ uri: item.bannerImage }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full bg-slate-950 items-center justify-center">
              <LinearGradient colors={['#f97316', '#000']} className="absolute inset-0 opacity-40" />
              <MaterialCommunityIcons name="xml" size={48} color="rgba(255,255,255,0.05)" />
            </View>
          )}
          
          {/* Top Gradient for Status Badge readability */}
          <LinearGradient 
            colors={['rgba(0,0,0,0.4)', 'transparent']} 
            className="absolute top-0 left-0 right-0 h-24"
          />

          {/* Status Badge - Floating Style */}
          <View className="absolute top-6 left-8 flex-row items-center px-5 py-2.5 rounded-full bg-white/90 backdrop-blur-md shadow-xl border border-white/20">
            <View className="w-2 h-2 rounded-full mr-2.5" style={{ backgroundColor: status.dot }} />
            <Text className="text-2xs font-black uppercase tracking-wide text-slate-900">
              {status.label}
            </Text>
          </View>

          {/* Cinematic Prize Pool Overlay */}
          {item.prizepool && (
            <View className="absolute bottom-6 right-8">
              <View className="bg-slate-950/95 px-6 py-4 rounded-3xl border border-orange-500/30 shadow-2xl shadow-orange-500/20 backdrop-blur-2xl">
                <View className="flex-row items-center mb-0.5">
                    <View className="w-1 h-1 bg-orange-500 rounded-full mr-2" />
                    <Text className="text-2xs text-orange-500 font-black uppercase tracking-wide">Protocol Fund</Text>
                </View>
                <Text className="text-white text-lg font-black uppercase tracking-tighter">{item.prizepool}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View className="p-10" style={{ padding: contentPadding }}>
          <View className="flex-row items-center justify-between mb-8 flex-wrap">
            <View className="flex-row items-center flex-1 flex-shrink">
              <View className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 items-center justify-center p-2.5 mr-5 shadow-inner flex-shrink-0">
                {item.logo ? (
                  <Image source={{ uri: item.logo }} className="w-full h-full rounded-lg" resizeMode="contain" />
                ) : (
                  <MaterialCommunityIcons name="cube-scan" size={24} color="#f97316" />
                )}
              </View>
              <View style={{ minWidth: 0 }}>
                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-0.5">Registry Host</Text>
                <Text className="text-slate-900 text-sm font-black uppercase tracking-tight" numberOfLines={1}>
                  {item.organiser?.name || "Fync Governance"}
                </Text>
              </View>
            </View>

            <View className="bg-orange-50/50 px-5 py-2.5 rounded-2xl border border-orange-100 flex-shrink-0 mt-2" style={{ marginTop: isSmallScreen ? 8 : 0 }}>
              <Text className="text-orange-600 text-2xs font-black uppercase tracking-tighter">{start} – {end}</Text>
            </View>
          </View>

          <Text className="text-slate-900 font-black tracking-[-1.5px] leading-tight mb-8" numberOfLines={2} style={{ fontSize: titleSize, textTransform: 'uppercase' }}>
            {item.title}
          </Text>

          {/* Technical Specs Meta */}
          <View className="flex-row items-center gap-8 mb-10 flex-wrap">
            <View className="flex-row items-center flex-shrink">
              <View className="bg-slate-50 w-8 h-8 rounded-full items-center justify-center mr-3 flex-shrink-0">
                <Feather name="code" size={14} color="#f97316" />
              </View>
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Innovation</Text>
            </View>
            <View className="flex-row items-center flex-shrink">
              <View className="bg-slate-50 w-8 h-8 rounded-full items-center justify-center mr-3 flex-shrink-0">
                <Feather name="zap" size={14} color="#f97316" />
              </View>
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Fast Track</Text>
            </View>
          </View>

          {/* Footer Interactive Row */}
          <View className="flex-row items-center justify-between pt-8 border-t border-slate-100 flex-wrap">
            <View className="flex-row items-center gap-3 flex-wrap flex-1">
              {item.tags?.slice(0, 2).map((tag, i) => (
                <View key={i} className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 flex-shrink">
                  <Text className="text-2xs text-slate-500 font-black uppercase tracking-wide">#{tag}</Text>
                </View>
              ))}
            </View>

            <View className="bg-orange-500 w-16 h-16 rounded-2xl items-center justify-center shadow-2xl shadow-orange-500/40 flex-shrink-0">
              <Feather name="arrow-right" size={28} color="white" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const HackathonHub = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [view, setView] = useState<'discover' | 'mine'>('discover');

  useEffect(() => {
    setHackathons([]);
    setPage(1);
    setHasMore(true);
    if (view === 'mine') {
      fetchMyHackathons(true);
    } else {
      fetchHackathons(1, activeFilter, true);
    }
  }, [view, activeFilter]);

  const fetchMyHackathons = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await axios.get('/hackathons/my');
      const data = res.data.hackathons ?? [];
      setHackathons(data);
      setHasMore(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to load your hackathons' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHackathons = async (pageNum: number, status?: string, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const payload: any = { page: pageNum, limit: 10 };
      if (status) payload.status = status;

      const res = await axios.post('/hackathons/list', payload);
      const data: Hackathon[] = res.data.hackathons ?? [];

      if (data.length === 0) {
        setHasMore(false);
      } else {
        setHackathons(prev => reset ? data : [...prev, ...data]);
        setPage(pageNum);
        setHasMore(data.length === 10);
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to load hackathons' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    if (view === 'mine') fetchMyHackathons(true);
    else fetchHackathons(1, activeFilter, true);
  }, [view, activeFilter]);

  const handleLoadMore = useCallback(() => {
    if (view === 'mine') return;
    if (hasMore && !loading) {
      fetchHackathons(page + 1, activeFilter);
    }
  }, [hasMore, loading, page, activeFilter, view]);

  const filtered = hackathons.filter(h =>
    h.title?.toLowerCase().includes(search.toLowerCase()) ||
    h.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const isOrganiserOf = (h: any) => h.myRole === 'organiser' || h.organiser?._id === user?._id;

  return (
    <View className="flex-1 bg-[#F8FAFC] px-3">
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="transparent" 
        translucent={true} 
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <View>
              <HackathonCard item={item} onPress={(id) => navigation.navigate('HackathonDetail', { hackathonId: id })} />
              {isOrganiserOf(item) && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('HackathonDashboard', { hackathonId: item._id, hackathonTitle: item.title })}
                  className="flex-row items-center justify-center bg-slate-900 mb-8 py-4 rounded-2xl"
                  style={{ marginHorizontal: responsive(4, 6, 8) }}
                >
                  <MaterialCommunityIcons name="view-dashboard-outline" size={18} color="#f97316" />
                  <Text className="text-white text-2xs font-black uppercase tracking-wide ml-2">
                    {view === 'mine' ? `Open Console · ${item.myRole}` : 'Open Organizer Console'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => {
            const headerHeight = hp(responsive(35, 40, 45));
            const headerPadding = responsive(6, 8, 10);
            const titleSize = responsive(28, 32, 40);
            const buttonPadding = responsive(4, 5, 6);
            const buttonRadius = responsive(18, 20, 24);
            
            return (
              <View>
                {/* Decorative Gradient Background (Moved inside to scroll) */}
                <View className="absolute top-0 w-full opacity-10" style={{ height: headerHeight }}>
                  <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
                </View>

                {/* Header Section */}
                <View style={{ paddingHorizontal: headerPadding, paddingTop: responsive(6, 8, 10), paddingBottom: 4 }}>
                    <View className="flex-row items-center justify-between mb-2 flex-wrap">
                    <View>
                      <Text className="text-slate-900 font-black tracking-tighter uppercase leading-tight" style={{ fontSize: titleSize }}>
                          Hackathon <Text className="text-orange-500">Hub</Text>
                      </Text>
                      <View className="flex-row items-center">
                          <Text className="text-slate-500 font-black uppercase tracking-[3px]" style={{ fontSize: responsive(8, 9, 10) }}>Global Ecosystem Explorer</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('HackathonCreate')}
                      className="flex-row items-center bg-slate-900 shadow-2xl shadow-black/20"
                      style={{ paddingHorizontal: responsive(5, 6, 8), paddingVertical: buttonPadding, borderRadius: buttonRadius }}
                    >
                      <MaterialCommunityIcons name="rocket-launch" size={18} color="#f97316" />
                      <Text className="text-white font-black uppercase tracking-[2px] ml-3" style={{ fontSize: responsive(9, 10, 11) }}>Host Hackathon</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 🔍 Dynamic Search Bar */}
                <View style={{ paddingHorizontal: headerPadding, marginBottom: 4 }}>
                  <View className="flex-row items-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Feather name="search" size={20} color="#f97316" />
                    <TextInput
                      placeholder="Search ecosystem, tech, protocols..."
                      placeholderTextColor="#94a3b8"
                      value={search}
                      onChangeText={setSearch}
                      className="flex-1 ml-4 text-slate-900 font-black uppercase tracking-widest"
                      style={{ fontSize: responsive(10, 11, 12), paddingVertical: responsive(2, 3, 4) }}
                    />
                    {search.length > 0 && (
                      <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Discover / Mine Switcher */}
                <View className="flex-row mb-4 bg-white rounded-2xl border border-slate-100 p-1.5" style={{ marginHorizontal: headerPadding }}>
                  {TABS.map(t => (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setView(t.value as 'discover' | 'mine')}
                      className={`flex-1 flex-row items-center justify-center py-3.5 rounded-xl ${view === t.value ? 'bg-slate-900' : ''}`}
                    >
                      <Ionicons name={t.icon as any} size={16} color={view === t.value ? '#f97316' : '#94a3b8'} />
                      <Text className={`ml-2 font-black uppercase tracking-widest ${view === t.value ? 'text-white' : 'text-slate-500'}`} style={{ fontSize: responsive(8, 9, 10) }}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Cinematic Filter Chips */}
                <View className="mb-6">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: headerPadding, paddingBottom: 4, gap: 8 }}
                  >
                    {FILTERS.map(f => (
                      <TouchableOpacity
                        key={f.value}
                        onPress={() => { setActiveFilter(f.value); setPage(1); setHasMore(true); }}
                        className={`px-8 py-4 rounded-2xl border ${view === 'mine' ? 'opacity-30' : activeFilter === f.value ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-100'}`}
                        disabled={view === 'mine'}
                      >
                        <Text className={`font-black uppercase tracking-[2px] ${view === 'mine' ? 'text-slate-300' : activeFilter === f.value ? 'text-white' : 'text-slate-500'}`} style={{ fontSize: responsive(8, 9, 10) }}>
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            );
          }}
          ListFooterComponent={() =>
            loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color="#f97316" />
              </View>
            ) : <View className="h-10" />
          }
          ListEmptyComponent={() =>
            !loading ? (
              <View className="items-center mt-24 px-10">
                <View className="w-24 h-24 rounded-4xl bg-white items-center justify-center mb-6 shadow-sm border border-slate-50">
                  <MaterialCommunityIcons name="rocket-outline" size={44} color="#CBD5E1" />
                </View>
                <Text className="text-slate-900 font-black text-xl tracking-tighter text-center uppercase mb-1">Ecosystem Void</Text>
                <Text className="text-slate-500 text-center font-black text-2xs uppercase tracking-wide">
                  {search ? 'Zero protocols matched your signal.' : 'The registry is currently offline.'}
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
};

export default HackathonHub;

