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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

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
  active:    { label: 'Live',     bg: '#ecfdf5', text: '#10b981', dot: '#10b981' },
  upcoming:  { label: 'Upcoming', bg: '#eff6ff', text: '#3b82f6', dot: '#3b82f6' },
  judging:   { label: 'Judging',  bg: '#fffbeb', text: '#f59e0b', dot: '#f59e0b' },
  completed: { label: 'Ended',    bg: '#f8fafc', text: '#64748b', dot: '#94a3b8' },
  draft:     { label: 'Draft',    bg: '#fdf2f8', text: '#ec4899', dot: '#ec4899' },
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const FILTERS = [
  { label: 'All',       value: '' },
  { label: 'LIVE',  value: 'active' },
  { label: 'SOON',  value: 'upcoming' },
  { label: 'JUDGE', value: 'judging' },
  { label: 'DONE',  value: 'completed' },
];

// ─── Hackathon Card ───────────────────────────────────────────────────────────
const HackathonCard = memo(({ item, onPress }: { item: Hackathon; onPress: (id: string) => void }) => {
  const status = STATUS_META[item.status] ?? STATUS_META.upcoming;
  const start = item.hackathonstarts ? new Date(item.hackathonstarts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
  const end   = item.hackathonends   ? new Date(item.hackathonends).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onPress(item._id)}
      className="bg-zinc-50/50 rounded-[40px] mb-8 mx-6 overflow-hidden border border-gray-100"
    >
      {/* Banner */}
      <View className="relative">
        {item.bannerImage ? (
          <Image source={{ uri: item.bannerImage }} className="w-full h-56" resizeMode="cover" />
        ) : (
          <View className="w-full h-56 bg-zinc-900 items-center justify-center">
             <LinearGradient colors={['#ec4899', '#f43f5e']} className="absolute inset-0 opacity-20" />
             <Ionicons name="rocket" size={48} color="white/20" />
          </View>
        )}

        {/* Status badge */}
        <View className="absolute top-6 left-6 flex-row items-center px-4 py-2 rounded-2xl bg-white/95 shadow-sm">
          <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: status.dot }} />
          <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-900">
            {status.label}
          </Text>
        </View>

        {/* Prize Pool Overlay */}
        {item.prizepool && (
          <View className="absolute top-6 right-6 px-4 py-3 rounded-2xl bg-zinc-900 shadow-xl shadow-black/30">
             <Text className="text-[10px] text-pink-500 font-black uppercase tracking-widest text-center">Protocol Fund</Text>
             <Text className="text-white text-sm font-black italic uppercase tracking-tighter">{item.prizepool}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="p-8">
        <View className="flex-row items-center justify-between mb-6">
           <View className="flex-row items-center flex-1">
              <View className="w-12 h-12 rounded-[18px] bg-white border border-gray-100 items-center justify-center p-2 mr-4">
                 {item.logo ? (
                   <Image source={{ uri: item.logo }} className="w-full h-full rounded-lg" resizeMode="contain" />
                 ) : (
                   <Ionicons name="shield-checkmark" size={20} color="#ec4899" />
                 )}
              </View>
              <View>
                 <Text className="text-gray-400 text-[9px] font-black uppercase tracking-[1px] mb-0.5">Authorised By</Text>
                 <Text className="text-zinc-900 text-xs font-black uppercase tracking-tight">
                   {item.organiser?.name || "Fync Governance"}
                 </Text>
              </View>
           </View>

           <View className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm shadow-black/[0.02]">
              <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-tighter italic">{start} – {end}</Text>
           </View>
        </View>

        <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter leading-8 mb-4 uppercase" numberOfLines={2}>
          {item.title}
        </Text>

        {/* Professional Meta Info */}
        <View className="flex-row items-center gap-6 mb-8">
           {(item as any).tracks?.length > 0 && (
              <View className="flex-row items-center">
                 <Ionicons name="layers" size={12} color="#ec4899" />
                 <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-widest ml-2">{(item as any).tracks.length} Tracks</Text>
              </View>
           )}
           {(item as any).sponsors?.length > 0 && (
              <View className="flex-row items-center">
                 <Ionicons name="medal" size={12} color="#8b5cf6" />
                 <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-widest ml-2">{(item as any).sponsors.length} Sponsors</Text>
              </View>
           )}
           {(item as any).mentors?.length > 0 && (
              <View className="flex-row items-center">
                 <Ionicons name="school" size={12} color="#10b981" />
                 <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-widest ml-2">{(item as any).mentors.length} Mentors</Text>
              </View>
           )}
        </View>
        
        {/* Footer Meta */}
        <View className="flex-row items-center justify-between pt-6 border-t border-gray-50">
           <View className="flex-row items-center gap-2 flex-1">
              {item.tags?.slice(0, 2).map((tag, i) => (
                <View key={i} className="bg-white px-4 py-2 rounded-xl border border-gray-100">
                  <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest">#{tag}</Text>
                </View>
              ))}
              {item.tags && item.tags.length > 2 && (
                <View className="w-10 h-10 rounded-xl bg-slate-50 items-center justify-center border border-gray-100">
                    <Text className="text-slate-400 text-[10px] font-black">+{item.tags.length - 2}</Text>
                </View>
              )}
           </View>

           <TouchableOpacity
              onPress={() => onPress(item._id)}
              className="bg-black w-14 h-14 rounded-[22px] items-center justify-center shadow-lg shadow-black/20"
           >
              <Ionicons name="arrow-forward" size={24} color="white" />
           </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
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
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1">

        {/* Header Section */}
        <View className="px-6 pt-10 pb-6">
            <View className="flex-row items-center justify-between mb-8">
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    className="w-12 h-12 bg-zinc-50 rounded-full items-center justify-center border border-zinc-100 shadow-sm"
                >
                    <Ionicons name="chevron-back" size={24} color="#18181b" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => navigation.navigate('HackathonCreate')}
                    className="flex-row items-center bg-zinc-900 px-6 py-3 rounded-2xl shadow-xl shadow-black/20"
                >
                    <View className="bg-pink-500 w-5 h-5 rounded-md items-center justify-center mr-2">
                      <Ionicons name="add" size={16} color="white" />
                    </View>
                    <Text className="text-white text-[10px] font-black uppercase tracking-[1.5px]">Host Protocol</Text>
                </TouchableOpacity>
            </View>
            
            <View className="mb-8">
                <View className="flex-row items-center mb-1">
                   <View className="w-8 h-[2px] bg-pink-500 mr-2" />
                   <Text className="text-pink-500 text-[10px] font-black uppercase tracking-[3px]">Ecosystem Explorer</Text>
                </View>
                <Text className="text-[52px] font-black text-zinc-900 tracking-[-3px] leading-[54px] uppercase italic">
                    Hackathon<Text className="text-zinc-300">/</Text><Text className="italic text-zinc-900">Hub</Text>
                </Text>
            </View>

            <View className="flex-row items-center gap-6">
                <View className="flex-1 bg-zinc-50 p-4 rounded-3xl border border-zinc-100">
                    <Text className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-1.5">Active Signal</Text>
                    <View className="flex-row items-center">
                       <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
                       <Text className="text-zinc-900 text-xs font-black uppercase tracking-tighter">Live registry</Text>
                    </View>
                </View>
                <View className="flex-1 bg-zinc-900 p-4 rounded-3xl border border-zinc-800 shadow-lg shadow-black/10">
                    <Text className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1.5">Integrations</Text>
                    <View className="flex-row items-center">
                       <Text className="text-white text-xs font-black uppercase tracking-tighter">{hackathons.length} Protocols</Text>
                       <Ionicons name="stats-chart" size={12} color="#ec4899" className="ml-2" />
                    </View>
                </View>
            </View>
        </View>

        {/* 🔍 Search Bar */}
        <View className="px-8 mt-4 mb-2">
            <View className="flex-row items-center bg-zinc-50/50 rounded-[28px] px-6 py-4 border border-gray-100">
                <Ionicons name="search" size={20} color="#ec4899" />
                <TextInput
                    placeholder="Search ecosystem, tech, protocols..."
                    placeholderTextColor="#94a3b8"
                    value={search}
                    onChangeText={setSearch}
                    className="flex-1 ml-3 text-zinc-900 text-[14px] font-black italic uppercase tracking-widest"
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>
        </View>

        {/* Filter chips */}
        <View className="mt-4 mb-4">
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 4, gap: 8 }}
            >
            {FILTERS.map(f => (
                <TouchableOpacity
                key={f.value}
                onPress={() => { setActiveFilter(f.value); setPage(1); setHasMore(true); }}
                className={`px-6 py-3 rounded-[18px] border ${activeFilter === f.value ? 'bg-black border-black' : 'bg-white border-gray-100'}`}
                >
                <Text className={`text-[9px] font-black uppercase tracking-[2px] ${activeFilter === f.value ? 'text-white' : 'text-gray-400'}`}>
                    {f.label}
                </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <HackathonCard item={item} onPress={(id) => navigation.navigate('HackathonDetail', { hackathonId: id })} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ec4899']} tintColor="#ec4899" />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() =>
            loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color="#ec4899" />
              </View>
            ) : <View className="h-10" />
          }
          ListEmptyComponent={() =>
            !loading ? (
              <View className="items-center mt-24 px-10">
                <View className="w-24 h-24 rounded-[32px] bg-slate-50 items-center justify-center mb-6">
                  <Ionicons name="rocket-outline" size={44} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-900 font-black italic text-xl tracking-tighter text-center uppercase mb-1">Ecosystem Void</Text>
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

