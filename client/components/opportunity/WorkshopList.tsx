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
  Dimensions
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
  // Fallback for images
  const imageUrl = item.banner_mobile?.url || item.logoUrl2 || 'https://via.placeholder.com/300x150?text=No+Image';
  const orgName = item.organisation?.name || "Unstop";

  return (
    <View className="bg-[#1e1e1e]/80 rounded-3xl mb-6 mx-5 overflow-hidden border border-white/10 shadow-lg">
      
      {/* Banner Image */}
      <Image 
        source={{ uri: imageUrl }} 
        className="w-full h-40 bg-white/5"
        resizeMode="cover"
      />
      
      {/* Overlay Gradient on Image */}
      <LinearGradient
         colors={['transparent', 'rgba(30,30,30,1)']}
         className="absolute w-full h-40 bottom-0"
      />

      <View className="p-5 -mt-10">
        
        {/* Date Tag */}
        <View className="self-start bg-black/60 px-3 py-1 mb-2 rounded-full backdrop-blur-md border border-white/10 flex-row items-center">
            <Ionicons name="calendar" size={12} color="#fbbf24" />
            <Text className="text-[10px] text-gray-200 font-bold ml-1.5 uppercase tracking-wider">
                {item.start_date ? new Date(item.start_date).toLocaleDateString() : 'Coming Soon'}
            </Text>
        </View>

        <Text className="text-lg font-bold text-white mb-1 shadow-sm" numberOfLines={2}>
            {item.title}
        </Text>
        
        <View className="flex-row items-center mb-4">
            <Ionicons name="business" size={14} color="#9ca3af" />
            <Text className="text-gray-400 text-xs ml-1.5 font-medium">
                {orgName}
            </Text>
        </View>

        {/* Footer */}
        <View className="flex-row justify-between items-center mt-2">
            <View>
                <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Deadline</Text>
                <Text className="text-xs text-gray-300 font-medium">
                    {item.regn_deadline ? new Date(item.regn_deadline).toLocaleDateString() : "Open"}
                </Text>
            </View>

            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => onPress(item.seo_url)}
            >
                <LinearGradient
                    colors={['#6366f1', '#a855f7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="px-5 py-2 rounded-full flex-row justify-center items-center shadow-lg shadow-indigo-500/20"
                >
                    <Text className="text-white font-bold text-xs mr-1.5">Apply Now</Text>
                    <Ionicons name="arrow-forward" size={14} color="white" />
                </LinearGradient>
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
    <View className="flex-1 bg-black">
      {/* 🌸 BACKGROUND 🌸 */}
      <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-50" />
      <LinearGradient 
        colors={['rgba(236, 72, 153, 0.40)', 'rgba(0,0,0,0.85)', '#000000']} 
        className="absolute w-full h-full" 
      />

      <SafeAreaView className="flex-1 px-2">
        
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
            <Text className="text-white text-3xl font-black shadow-lg">Workshops 🛠️</Text>
            <Text className="text-gray-300 text-sm mt-1 font-medium">
                Learn new skills from industry experts.
            </Text>
        </View>

        {/* 🔍 Search Bar */}
        <View className="mx-5 mt-4 mb-2">
            <View className="flex-row items-center bg-[#1a1a1a]/90 rounded-2xl px-4 border border-white/10 shadow-md">
                <Ionicons name="search" size={20} color="#9ca3af" />
                <TextInput 
                    placeholder="Search workshops..."
                    placeholderTextColor="#6b7280"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 ml-3 text-white text-base font-medium"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <Ionicons name="close-circle" size={20} color="#6b7280" />
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
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
            }
            
            ListFooterComponent={
                loadingMore ? <ActivityIndicator size="small" color="#ec4899" className="py-4" /> : <View className="h-10" />
            }
            
            ListEmptyComponent={
                !loading ? (
                    <View className="items-center justify-center mt-20">
                        <MaterialCommunityIcons name="calendar-remove" size={60} color="#333" />
                        <Text className="text-gray-500 mt-4 text-center px-10">
                            {searchQuery ? "No workshops found matching your search." : "No workshops available right now."}
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