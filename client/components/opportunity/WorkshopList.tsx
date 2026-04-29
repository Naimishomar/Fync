import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
  TextInput,
  Dimensions,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

interface Workshop {
  id: number;
  title: string;
  logoUrl2?: string;
  banner_mobile?: { url: string };
  organisation?: { name: string; logoUrl?: string };
  regn_deadline?: string;
  start_date?: string;
  seo_url: string;
  filters?: {
    location?: string;
  };
}

// --- 1. MEMOIZED WORKSHOP CARD (Arena Theme) ---
const WorkshopCard = memo(({ item, onPress }: { item: Workshop; onPress: (url: string) => void }) => {
  const imageUrl = item.organisation?.logoUrl || item.logoUrl2 || 'https://via.placeholder.com/100';
  const bannerUrl = item.banner_mobile?.url;
  const orgName = item.organisation?.name || "Global Organisation";

  return (
    <View className="bg-white rounded-xl mb-6 mx-6 p-6 border border-slate-100 shadow-sm shadow-black/5">

      <View className="flex-row gap-4 items-center">
        {/* Organisation Logo */}
        <View className="w-16 h-16 rounded-2xl border border-slate-100 overflow-hidden bg-slate-50 items-center justify-center p-2 shadow-inner">
          <Image
            source={{ uri: imageUrl }}
            className="w-12 h-12 rounded-xl"
            resizeMode="contain"
          />
        </View>

        {/* Title & Organisation */}
        <View className="flex-1">
          <Text className="text-zinc-900 text-[16px] font-black  tracking-tighter uppercase leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
            {orgName}
          </Text>
        </View>
      </View>

      {/* Optional Banner */}
      {bannerUrl && (
        <View className="mt-5 w-full h-32 rounded-[20px] overflow-hidden border border-slate-100">
          <Image source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />
        </View>
      )}

      {/* Tags Row */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        {/* Start Date */}
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
          <Ionicons name="calendar" size={14} color="#94a3b8" />
          <Text className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
            {item.start_date ? new Date(item.start_date).toLocaleDateString() : 'Active Session'}
          </Text>
        </View>

        {/* Location */}
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
          <Ionicons name="location-sharp" size={14} color="#94a3b8" />
          <Text className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
            {item.filters?.location || "Remote Hub"}
          </Text>
        </View>

        <View className="flex-row items-center bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
          <Text className="text-[9px] text-orange-500 font-black uppercase tracking-widest">
            Workshop
          </Text>
        </View>
      </View>

      {/* Footer / CTA */}
      <View className="mt-6 flex-row items-center justify-between border-t border-slate-50 pt-5">
        <View>
          <Text className="text-slate-400 font-black uppercase text-[8px] tracking-widest mb-1">Registration Ends</Text>
          <Text className="text-zinc-900 text-sm font-black  mt-0.5 tracking-tighter uppercase">
            {item.regn_deadline ? new Date(item.regn_deadline).toLocaleDateString() : "Open Registry"}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPress(item.seo_url)}
          className="bg-zinc-900 px-8 py-3.5 rounded-xl shadow-sm shadow-black/10"
        >
          <Text className="text-white font-black  uppercase tracking-widest text-[11px]">Access Portal</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
});

export default function WorkshopList() {
  const navigation = useNavigation<any>();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🔍 Search State
  const [searchQuery, setSearchQuery] = useState("");

  // --- FETCH DATA ---
  const fetchWorkshops = async (pageNum: number, shouldRefresh = false) => {
    try {
      if (!hasMore && !shouldRefresh) return;

      const res = await axios.get(
        `https://unstop.com/api/public/opportunity/search-result?opportunity=workshops&page=${pageNum}&per_page=15&oppstatus=open&quickApply=true`
      );

      const newWorkshops = res.data.data.data || [];

      if (newWorkshops.length === 0) {
        setHasMore(false);
      }

      if (shouldRefresh || pageNum === 1) {
        setWorkshops(newWorkshops);
      } else {
        setWorkshops(prev => {
          const combined = [...prev, ...newWorkshops];
          const uniqueMap = new Map(combined.map(item => [item.id, item]));
          return Array.from(uniqueMap.values());
        });
      }
    } catch (error) {
      console.error("Error fetching workshops:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkshops(1);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchWorkshops(1, true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading && searchQuery === "") {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchWorkshops(nextPage);
    }
  };

  const openLink = useCallback((seoUrl: string) => {
    const fullUrl = `https://unstop.com/${seoUrl}`;
    Linking.openURL(fullUrl).catch(err => console.error("Couldn't load page", err));
  }, []);

  // --- 🔍 FILTER LOGIC ---
  const filteredWorkshops = workshops.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(query) ||
      item.organisation?.name?.toLowerCase().includes(query)
    );
  });

  const renderItem = useCallback(({ item }: { item: Workshop }) => (
    <WorkshopCard item={item} onPress={openLink} />
  ), [openLink]);

  const renderFooter = () => {
    if (!loading && !loadingMore) return <View className="h-12" />;
    return (
      <View className="py-10 items-center">
        <ActivityIndicator size="small" color="#f97316" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#f97316', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>

        {/* Arena Header */}
        <View className="px-8 pt-2">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                  Workshop <Text className="text-orange-500">Hub</Text>
                </Text>
              </View>
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1px]">Industry Masterclass Archive</Text>
            </View>
          </View>
        </View>

        {/* 🔍 Arena Search Dock */}
        <View className="px-8 mb-3">
          <View className="flex-row items-center bg-white rounded-2xl px-5 h-14 border border-slate-100 shadow-xl shadow-black/5">
            <Ionicons name="search" size={20} color="#f97316" />
            <TextInput
              placeholder="Search labs, workshops, skills..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-3 text-zinc-900 text-sm font-black  uppercase tracking-tighter"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} className="bg-slate-50 p-1.5 rounded-xl">
                <Ionicons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        <FlatList
          data={filteredWorkshops}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !loading ? (
              <View className="items-center mt-20 px-10">
                <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6">
                  <Ionicons name="construct" size={40} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-900 font-black text-xl tracking-tight text-center uppercase">Zero Signals</Text>
                <Text className="text-slate-400 text-center font-bold text-xs mt-2 uppercase tracking-wide">
                  {searchQuery ? "No skill modules matched your search protocol." : "The global workshop registry is currently clear."}
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}