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
  active:    { label: 'Live',     bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  upcoming:  { label: 'Upcoming', bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  judging:   { label: 'Judging',  bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  completed: { label: 'Ended',    bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
  draft:     { label: 'Draft',    bg: '#fce7f3', text: '#9d174d', dot: '#ec4899' },
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const FILTERS = [
  { label: 'All',       value: '' },
  { label: '🔥 Live',  value: 'active' },
  { label: '🔜 Soon',  value: 'upcoming' },
  { label: '⚖️ Judge', value: 'judging' },
  { label: '✅ Done',  value: 'completed' },
];

// ─── Hackathon Card ───────────────────────────────────────────────────────────
const HackathonCard = memo(({ item, onPress }: { item: Hackathon; onPress: (id: string) => void }) => {
  const status = STATUS_META[item.status] ?? STATUS_META.upcoming;
  const start = item.hackathonstarts ? new Date(item.hackathonstarts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
  const end   = item.hackathonends   ? new Date(item.hackathonends).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(item._id)}
      className="bg-white rounded-3xl mb-5 mx-5 overflow-hidden border border-slate-100"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 }}
    >
      {/* Banner */}
      <View className="relative">
        {item.bannerImage ? (
          <Image source={{ uri: item.bannerImage }} className="w-full h-44" resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['#6366f1', '#ec4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="w-full h-44 items-center justify-center"
          >
            <Ionicons name="rocket" size={48} color="rgba(255,255,255,0.4)" />
          </LinearGradient>
        )}

        {/* Logo Overlay */}
        <View className="absolute -bottom-6 left-4 bg-white p-1 rounded-2xl shadow-sm border border-slate-50">
          {item.logo ? (
            <Image source={{ uri: item.logo }} className="w-12 h-12 rounded-[14px]" />
          ) : (
            <View className="w-12 h-12 rounded-[14px] bg-indigo-50 items-center justify-center">
              <Ionicons name="rocket" size={20} color="#6366f1" />
            </View>
          )}
        </View>
        {/* Status badge */}
        <View
          className="absolute top-3 left-3 flex-row items-center px-3 py-1.5 rounded-full"
          style={{ backgroundColor: status.bg }}
        >
          <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: status.dot }} />
          <Text className="text-xs font-black uppercase tracking-widest" style={{ color: status.text }}>
            {status.label}
          </Text>
        </View>
        {/* Prize badge */}
        {item.prizepool && (
          <View className="absolute top-3 right-3 bg-amber-400 px-3 py-1.5 rounded-full flex-row items-center">
            <Ionicons name="trophy" size={11} color="#78350f" />
            <Text className="text-[10px] font-black ml-1 text-amber-900">{item.prizepool}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="p-4 pt-8">
        <Text className="text-zinc-900 text-lg font-black italic tracking-tight leading-6 mb-2" numberOfLines={2}>
          {item.title}
        </Text>

        {/* Meta row */}
        <View className="flex-row items-center gap-4 mb-3">
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
            <Text className="text-slate-500 text-[11px] font-semibold ml-1">{start} → {end}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={13} color="#94a3b8" />
            <Text className="text-slate-500 text-[11px] font-semibold ml-1">
              {item.participants?.length ?? 0} joined
            </Text>
          </View>
          {item.MaxTeamSize && (
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={13} color="#94a3b8" />
              <Text className="text-slate-500 text-[11px] font-semibold ml-1">≤{item.MaxTeamSize}/team</Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mb-4">
            {item.tags.slice(0, 4).map((tag, i) => (
              <View key={i} className="bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                <Text className="text-[10px] text-indigo-500 font-black uppercase tracking-tight">#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA */}
        <LinearGradient
          colors={['#6366f1', '#ec4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="rounded-2xl"
        >
          <View className="py-3.5 flex-row items-center justify-center">
            <Text className="text-white font-black uppercase tracking-widest text-xs mr-2">View Hackathon</Text>
            <Ionicons name="arrow-forward" size={14} color="white" />
          </View>
        </LinearGradient>
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

      // Backend gethackathons reads from req.body, so we POST
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
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <LinearGradient colors={['#6366f1', '#ec4899']} className="w-12 h-12 rounded-2xl items-center justify-center">
              <Ionicons name="rocket" size={22} color="white" />
            </LinearGradient>
            <View>
              <Text className="text-zinc-900 text-2xl font-black italic tracking-tight uppercase">Hackathons</Text>
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Fync Ecosystem</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('HackathonCreate')}
            className="w-10 h-10 bg-indigo-100 rounded-2xl items-center justify-center"
          >
            <Ionicons name="add" size={22} color="#6366f1" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="px-5 mb-3">
          <View className="flex-row items-center bg-white rounded-2xl px-4 py-2.5 border border-slate-200">
            <Ionicons name="search" size={18} color="#6366f1" />
            <TextInput
              placeholder="Search hackathons, tags..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              className="flex-1 ml-2.5 text-zinc-900 text-sm font-semibold"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 8 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.value}
              onPress={() => { setActiveFilter(f.value); setPage(1); setHasMore(true); }}
              className={`px-4 py-2 rounded-2xl border ${activeFilter === f.value ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}
            >
              <Text className={`text-xs font-black ${activeFilter === f.value ? 'text-white' : 'text-slate-600'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <HackathonCard item={item} onPress={(id) => navigation.navigate('HackathonDetail', { hackathonId: id })} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} tintColor="#6366f1" />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() =>
            loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color="#6366f1" />
              </View>
            ) : <View className="h-10" />
          }
          ListEmptyComponent={() =>
            !loading ? (
              <View className="items-center mt-24 px-10">
                <LinearGradient colors={['#ede9fe', '#fce7f3']} className="w-24 h-24 rounded-[32px] items-center justify-center mb-5">
                  <Ionicons name="rocket-outline" size={44} color="#6366f1" />
                </LinearGradient>
                <Text className="text-zinc-900 font-black italic text-xl tracking-tight text-center uppercase mb-2">No Hackathons</Text>
                <Text className="text-slate-400 text-center font-semibold text-xs uppercase tracking-widest">
                  {search ? 'No results matched your search.' : 'No hackathons found. Check back soon!'}
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
