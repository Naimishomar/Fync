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

// --- 1. MEMOIZED WORKSHOP CARD ---
const WorkshopCard = memo(({ item, onPress }: { item: Workshop; onPress: (url: string) => void }) => {
  const imageUrl = item.banner_mobile?.url || item.logoUrl2 || 'https://via.placeholder.com/300x150?text=No+Image';
  const orgName = item.organisation?.name || "Global Organisation";

  return (
    <View className="bg-white rounded-2xl mb-8 mx-6 overflow-hidden shadow-sm shadow-black/5 border border-gray-300">
      <View className="relative py-4">
        <Image 
          source={{ uri: imageUrl }} 
          className="w-full h-48 bg-white"
          resizeMode="contain"
        />
        <View className="absolute top-4 left-4">
            <View className="bg-white/90 px-3 py-1.5 rounded-xl backdrop-blur-md border border-gray-300 flex-row items-center shadow-sm">
                <Ionicons name="calendar-clear" size={14} color="#ec4899" />
                <Text className="text-[10px] text-zinc-900 font-black italic ml-2 uppercase tracking-tight">
                    {item.start_date ? new Date(item.start_date).toLocaleDateString() : 'Active Session'}
                </Text>
            </View>
        </View>
      </View>

      <View className="p-5">
        <Text className="text-xl font-black italic text-zinc-900 mb-2 leading-6 tracking-tighter" numberOfLines={2}>
            {item.title}
        </Text>
        
        <View className="flex-row items-center mb-4">
            <View className="w-6 h-6 p-1 bg-gray-200 rounded-full items-center justify-center border border-gray-100 mr-2">
                <Ionicons name="business" size={12} color="#64748b" />
            </View>
            <Text className="text-gray-600 text-[10px] font-black uppercase tracking-widest">
                {orgName}
            </Text>
        </View>

        {/* Footer */}
        <View className="flex-row justify-between items-center">
            <View>
                <Text className="text-slate-400 font-black uppercase text-[8px] tracking-[2px]">Registration Ends</Text>
                <Text className="text-zinc-900 text-sm font-black italic mt-0.5 tracking-tight uppercase">
                    {item.regn_deadline ? new Date(item.regn_deadline).toLocaleDateString() : "Open Registry"}
                </Text>
            </View>

            <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => onPress(item.seo_url)}
                className="bg-pink-500 px-6 py-4 rounded-xl shadow-lg shadow-black/20"
            >
                <Text className="text-white font-black italic uppercase tracking-widest text-[10px]">Access Portal</Text>
            </TouchableOpacity>
        </View>
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

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">
        
        {/* Header */}
        <View className="px-8 pt-8 pb-4">
            <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 bg-pink-500 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/20">
                    <Ionicons name="construct" size={24} color="white" />
                </View>
                <View>
                    <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter uppercase">Workshops</Text>
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Master Industry-Leading Skills</Text>
                </View>
            </View>
        </View>

        {/* 🔍 Search Bar */}
        <View className="px-6 mt-4 mb-4">
            <View className="flex-row items-center bg-white rounded-3xl px-6 py-4 border border-slate-100 shadow-sm shadow-black/5">
                <Ionicons name="search" size={20} color="#ec4899" />
                <TextInput 
                    placeholder="Search masterclasses, labs..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 ml-3 text-zinc-900 text-base font-black italic"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")} className="bg-slate-50 p-1 rounded-full">
                        <Ionicons name="close" size={18} color="#94a3b8" />
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
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
            }
            ListFooterComponent={
                loadingMore ? <ActivityIndicator size="small" color="#ec4899" className="py-10" /> : <View className="h-10" />
            }
            ListEmptyComponent={
                !loading ? (
                    <View className="items-center mt-20 px-10">
                        <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6">
                            <Ionicons name="calendar" size={40} color="#CBD5E1" />
                        </View>
                        <Text className="text-zinc-900 font-black italic text-xl tracking-tight text-center uppercase">Zero Labs</Text>
                        <Text className="text-slate-400 text-center font-bold text-xs mt-2 uppercase tracking-wide">
                            {searchQuery ? "No skill modules matched your search protocol." : "The global workshop registry is clear."}
                        </Text>
                    </View>
                ) : (
                    <View className="flex-1 justify-center items-center mt-20">
                        <ActivityIndicator size="large" color="#ec4899" />
                    </View>
                )
            }
        />
      </SafeAreaView>
    </View>
  );
}