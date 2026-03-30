import React, { useEffect, useState, useCallback, memo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  Pressable, 
  Linking,
  TextInput,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

const HackathonCard = memo(({ item, onPress }: { item: any; onPress: (url: string) => void }) => {
  const fixUrl = (url: string) => {
    if (!url) return 'https://via.placeholder.com/300x150';
    if (url.startsWith('//')) return `https:${url}`;
    return url;
  };

  const stripHtml = (html: string) => {
    if (!html) return "See details";
    let cleanText = html.replace(/<[^>]*>?/gm, '');
    return cleanText.trim();
  };

  return (
    <View className="bg-white rounded-2xl mb-8 mx-6 overflow-hidden shadow-sm shadow-black/5 border border-gray-300">
      <View className="relative">
        <Image 
          source={{ uri: fixUrl(item.thumbnail_url) }} 
          className="w-full h-56 bg-slate-50"
          resizeMode="cover"
        />
        <View className="absolute mt-5 ml-5">
            <View className={`px-4 py-1.5 rounded-full border shadow-sm ${item.is_online ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"}`}>
                <Text className={`text-[10px] font-black uppercase tracking-widest ${item.is_online ? "text-emerald-500" : "text-blue-500"}`}>
                    {item.is_online ? "Online" : "On-Site"}
                </Text>
            </View>
        </View>
      </View>
      
      <View className="p-4">
        <View className="bg-slate-50 self-start px-3 py-1 rounded-lg border border-slate-100 mb-3">
            <Text className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                {item.submission_period_dates || "Open Entry"}
            </Text>
        </View>

        <Text className="text-2xl font-black italic text-zinc-900 mb-4 tracking-tighter leading-7" numberOfLines={2}>
            {item.title}
        </Text>
        
        {/* Stats Row */}
        <View className="flex-row items-center gap-6 mb-6">
          <View className="flex-row items-center">
            <View className="w-8 h-8 bg-amber-50 rounded-full items-center justify-center border border-amber-100">
                <Ionicons name="trophy" size={14} color="#d97706" />
            </View>
            <Text className="ml-2 text-zinc-600 font-black italic text-xs tracking-tight uppercase">
                {stripHtml(item.prize_amount)}
            </Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center border border-blue-100">
                <Ionicons name="people" size={14} color="#2563eb" />
            </View>
            <Text className="ml-2 text-zinc-600 font-black italic text-xs tracking-tight uppercase">
                {item.registrations_count || "0"} Devs
            </Text>
          </View>
        </View>

        {/* Themes Tags */}
        <View className="flex-row flex-wrap gap-2 mb-8">
          {item.themes?.slice(0, 3).map((theme: any, index: number) => (
            <View key={index} className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                <Text className="text-[10px] text-slate-500 font-black uppercase tracking-tight">#{theme.name}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={() => onPress(item.url)}
          className="bg-pink-500 rounded-2xl overflow-hidden shadow-xl shadow-black/20"
        >
          <View className="py-5 flex-row justify-center items-center">
            <Text className="text-white font-black italic uppercase tracking-[2px] text-sm mr-2">Access Portal</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const HackathonList = () => {
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // 🔍 Search State
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchHackathons(1);
  }, []);

  const fetchHackathons = async (pageNum: number) => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(`https://devpost.com/api/hackathons?page=${pageNum}`);
      const data = await response.json();
      const newHackathons = data.hackathons || [];

      if (newHackathons.length === 0) {
        setHasMore(false);
      } else {
        setHackathons((prev) => {
            const existingIds = new Set(prev.map(i => i.id));
            const unique = newHackathons.filter((i: any) => !existingIds.has(i.id));
            return [...prev, ...unique];
        });
        setPage(pageNum);
      }
    } catch (error) {
      console.error("Error fetching hackathons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPress = useCallback((url: string) => {
    if (url) Linking.openURL(url);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading && searchQuery === "") {
      fetchHackathons(page + 1);
    }
  }, [hasMore, loading, page, searchQuery]);

  const filteredHackathons = hackathons.filter((item) => {
      const query = searchQuery.toLowerCase();
      const matchesTitle = item.title?.toLowerCase().includes(query);
      const matchesTheme = item.themes?.some((t: any) => t.name.toLowerCase().includes(query));
      
      return matchesTitle || matchesTheme;
  });

  const renderItem = useCallback(({ item }: { item: any }) => (
    <HackathonCard item={item} onPress={handleLinkPress} />
  ), [handleLinkPress]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return <View className="py-10 items-center"><ActivityIndicator size="small" color="#ec4899" /></View>;
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      
      <SafeAreaView className="flex-1">
        
        {/* Header */}
        <View className="px-8 pt-8 pb-4">
            <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 bg-pink-500 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/20">
                    <Ionicons name="rocket" size={24} color="white" />
                </View>
                <View>
                    <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter uppercase">Hackathons</Text>
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Build The Future Globally</Text>
                </View>
            </View>
        </View>

        {/* 🔍 Search Bar */}
        <View className="px-6 mt-2 mb-4">
            <View className="flex-row items-center bg-white rounded-3xl px-6 py-2 border border-gray-300 shadow-sm shadow-black/5">
                <Ionicons name="search" size={20} color="#ec4899" />
                <TextInput 
                    placeholder="Search by tech stack, name..."
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
            data={filteredHackathons}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
                !loading ? (
                    <View className="items-center mt-20 px-10">
                        <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6">
                            <Ionicons name="code-slash" size={40} color="#CBD5E1" />
                        </View>
                        <Text className="text-zinc-900 font-black italic text-xl tracking-tight text-center uppercase">Dev Void</Text>
                        <Text className="text-slate-400 text-center font-bold text-xs mt-2 uppercase tracking-widest">
                            {searchQuery ? "No hackathons matched your search protocol." : "The global registry is currently updating."}
                        </Text>
                    </View>
                ) : null
            }
        />
      </SafeAreaView>
    </View>
  );
};

export default HackathonList;