import React, { useEffect, useState, useCallback, memo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Hackathon {
  _id: string;
  title: string;
  bannerImage?: string;
  logo?: string;
  status: 'draft' | 'upcoming' | 'active' | 'judging' | 'completed';
  hackathonstarts: string;
  hackathonends: string;
  prizepool?: string;
  tags?: string[];
  MaxTeamSize?: number;
  participants?: string[];
  organiser?: { name: string; avatar?: string };
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'Live', bg: '#ecfdf5', text: '#10b981', dot: '#10b981' },
  upcoming: { label: 'Upcoming', bg: '#eff6ff', text: '#3b82f6', dot: '#3b82f6' },
  judging: { label: 'Judging', bg: '#fffbeb', text: '#f59e0b', dot: '#f59e0b' },
  completed: { label: 'Ended', bg: '#f8fafc', text: '#64748b', dot: '#94a3b8' },
  draft: { label: 'Draft', bg: '#fdf2f8', text: '#ec4899', dot: '#ec4899' },
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const FILTERS = [
  { label: 'All', value: '' },
  { label: 'LIVE', value: 'active' },
  { label: 'SOON', value: 'upcoming' },
  { label: 'JUDGE', value: 'judging' },
  { label: 'DONE', value: 'completed' },
];

// ─── Hackathon Card ───────────────────────────────────────────────────────────
const HackathonCard = memo(({ item, onPress }: { item: Hackathon; onPress: (id: string) => void }) => {
  const status = STATUS_META[item.status] ?? STATUS_META.upcoming;
  const start = item.hackathonstarts ? new Date(item.hackathonstarts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
  const end = item.hackathonends ? new Date(item.hackathonends).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
                <View className="mb-8">
                  <Text className="text-zinc-900 text-4xl font-black tracking-tighter uppercase leading-tight">
                      Hackathon <Text className="text-orange-500">Hub</Text>
                  </Text>
                  <View className="flex-row items-center mt-1">
                      <View className="w-2 h-2 bg-emerald-500 rounded-full mr-2 shadow-sm shadow-emerald-500/50" />
                      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Global Ecosystem Explorer</Text>
                  </View>
                </View>
  return (
    <Pressable
      onPress={() => onPress(item._id)}
      style={({ pressed }) => [
        {
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      className="mb-10 mx-6"
    >
      <View className="bg-white rounded-[48px] overflow-hidden border border-slate-100 shadow-2xl shadow-black/5">
        {/* Banner with Cyber Overlay */}
        <View className="relative h-64">
          {item.bannerImage ? (
            <Image source={{ uri: item.bannerImage }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full bg-zinc-950 items-center justify-center">
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
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-900">
              {status.label}
            </Text>
          </View>

          {/* Cinematic Prize Pool Overlay */}
          {item.prizepool && (
            <View className="absolute bottom-6 right-8">
              <View className="bg-zinc-950/95 px-6 py-4 rounded-[28px] border border-orange-500/30 shadow-2xl shadow-orange-500/20 backdrop-blur-2xl">
                <View className="flex-row items-center mb-0.5">
                    <View className="w-1 h-1 bg-orange-500 rounded-full mr-2" />
                    <Text className="text-[9px] text-orange-500 font-black uppercase tracking-[3px]">Protocol Fund</Text>
                </View>
                <Text className="text-white text-lg font-black uppercase tracking-tighter">{item.prizepool}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View className="p-10">
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-row items-center flex-1">
              <View className="w-14 h-14 rounded-[22px] bg-slate-50 border border-slate-100 items-center justify-center p-2.5 mr-5 shadow-inner">
                {item.logo ? (
                  <Image source={{ uri: item.logo }} className="w-full h-full rounded-lg" resizeMode="contain" />
                ) : (
                  <MaterialCommunityIcons name="cube-scan" size={24} color="#f97316" />
                )}
              </View>
              <View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-0.5">Registry Host</Text>
                <Text className="text-zinc-900 text-sm font-black uppercase tracking-tight">
                  {item.organiser?.name || "Fync Governance"}
                </Text>
              </View>
            </View>

            <View className="bg-orange-50/50 px-5 py-2.5 rounded-2xl border border-orange-100">
              <Text className="text-orange-600 text-[10px] font-black uppercase tracking-tighter ">{start} – {end}</Text>
            </View>
          </View>

          <Text className="text-zinc-900 text-3xl font-black tracking-[-1.5px] leading-9 mb-8 uppercase" numberOfLines={2}>
            {item.title}
          </Text>

          {/* Technical Specs Meta */}
          <View className="flex-row items-center gap-8 mb-10">
            <View className="flex-row items-center">
              <View className="bg-zinc-50 w-8 h-8 rounded-full items-center justify-center mr-3">
                <Feather name="code" size={14} color="#f97316" />
              </View>
              <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Innovation</Text>
            </View>
            <View className="flex-row items-center">
              <View className="bg-zinc-50 w-8 h-8 rounded-full items-center justify-center mr-3">
                <Feather name="zap" size={14} color="#f97316" />
              </View>
              <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Fast Track</Text>
            </View>
          </View>

          {/* Footer Interactive Row */}
          <View className="flex-row items-center justify-between pt-8 border-t border-slate-100">
            <View className="flex-row items-center gap-3">
              {item.tags?.slice(0, 2).map((tag, i) => (
                <View key={i} className="bg-zinc-50 px-5 py-3 rounded-2xl border border-slate-100">
                  <Text className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">#{tag}</Text>
                </View>
              ))}
            </View>

            <View className="bg-orange-500 w-16 h-16 rounded-[24px] items-center justify-center shadow-2xl shadow-orange-500/40">
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
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  useEffect(() => {
    fetchHackathons(1, activeFilter, true);
  }, [activeFilter]);

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
    fetchHackathons(1, activeFilter, true);
  }, [activeFilter]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchHackathons(page + 1, activeFilter);
    }
  }, [hasMore, loading, page, activeFilter]);

  const filtered = hackathons.filter(h =>
    h.title?.toLowerCase().includes(search.toLowerCase()) ||
    h.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1" edges={['top']}>
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <HackathonCard item={item} onPress={(id) => navigation.navigate('HackathonDetail', { hackathonId: id })} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <View>
              {/* Decorative Gradient Background (Moved inside to scroll) */}
              <View className="absolute top-0 w-full h-96 opacity-10">
                <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
              </View>

              {/* Header Section */}
              <View className="px-8 pt-8 pb-4">
                  <View className="flex-row items-center justify-between mb-2">
                  <View>
                    <Text className="text-zinc-900 text-4xl font-black tracking-tighter uppercase leading-tight">
                        Hackathon <Text className="text-orange-500">Hub</Text>
                    </Text>
                    <View className="flex-row items-center">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Global Ecosystem Explorer</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('HackathonCreate')}
                    className="flex-row items-center bg-zinc-900 px-6 py-4 rounded-[24px] shadow-2xl shadow-black/20"
                  >
                    <MaterialCommunityIcons name="rocket-launch" size={18} color="#f97316" />
                    <Text className="text-white text-[11px] font-black uppercase tracking-[2px] ml-3">Host Hackathon</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 🔍 Dynamic Search Bar */}
              <View className="px-8 mb-4">
                <View className="flex-row items-center bg-white rounded-[28px] px-6 py-2 border border-slate-100 shadow-sm">
                  <Feather name="search" size={20} color="#f97316" />
                  <TextInput
                    placeholder="Search ecosystem, tech, protocols..."
                    placeholderTextColor="#94a3b8"
                    value={search}
                    onChangeText={setSearch}
                    className="flex-1 ml-4 text-zinc-900 text-xs font-black uppercase tracking-widest"
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Cinematic Filter Chips */}
              <View className="mb-6">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 4, gap: 10 }}
                >
                  {FILTERS.map(f => (
                    <TouchableOpacity
                      key={f.value}
                      onPress={() => { setActiveFilter(f.value); setPage(1); setHasMore(true); }}
                      className={`px-8 py-4 rounded-[22px] border ${activeFilter === f.value ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-slate-100'}`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-[2px] ${activeFilter === f.value ? 'text-white' : 'text-slate-400'}`}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
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
                <View className="w-24 h-24 rounded-[32px] bg-white items-center justify-center mb-6 shadow-sm border border-slate-50">
                  <MaterialCommunityIcons name="rocket-outline" size={44} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-900 font-black text-xl tracking-tighter text-center uppercase mb-1">Ecosystem Void</Text>
                <Text className="text-slate-400 text-center font-black text-[10px] uppercase tracking-widest">
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

