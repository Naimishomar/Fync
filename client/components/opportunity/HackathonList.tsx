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
  TouchableOpacity
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
    <View className="bg-[#1e1e1e]/80 rounded-3xl mb-6 mx-5 overflow-hidden border border-white/10 shadow-lg">
      <Image 
        source={{ uri: fixUrl(item.thumbnail_url) }} 
        className="w-full h-48 bg-white/5 rounded-xl"
        resizeMode="cover"
      />
      
      {/* Overlay Gradient on Image */}
      <LinearGradient
         colors={['transparent', 'rgba(30,30,30,1)']}
         className="absolute w-full h-48 bottom-0"
      />
      
      <View className="p-5 -mt-12">
        <View className="flex-row justify-between items-start mb-2">
            <View className="bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                <Text className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">
                    {item.submission_period_dates || "Open"}
                </Text>
            </View>
            <View className={`px-3 py-1 rounded-full border ${item.is_online ? "bg-green-500/20 border-green-500/30" : "bg-blue-500/20 border-blue-500/30"}`}>
                <Text className={`text-[10px] font-bold uppercase ${item.is_online ? "text-green-400" : "text-blue-400"}`}>
                    {item.is_online ? "Online" : "Offline"}
                </Text>
            </View>
        </View>

        <Text className="text-xl font-bold text-white mb-3 shadow-sm" numberOfLines={2}>
            {item.title}
        </Text>
        
        {/* Stats Row */}
        <View className="flex-col mb-3 gap-1">
          <View className="flex-row items-center">
            <Ionicons name="trophy" size={14} color="#FBBF24" />
            <Text className="ml-1.5 text-gray-300 font-medium text-xs">
                {stripHtml(item.prize_amount)}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="people" size={14} color="#60A5FA" />
            <Text className="ml-1.5 text-gray-300 font-medium text-xs">
                {item.registrations_count || "Join"} Registered
            </Text>
          </View>
        </View>

        {/* Themes Tags */}
        <View className="flex-row flex-wrap gap-2 mb-5">
          {item.themes?.slice(0, 3).map((theme: any, index: number) => (
            <View key={index} className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                <Text className="text-[10px] text-gray-400 font-medium">#{theme.name}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => onPress(item.url)}
        >
          <LinearGradient
              colors={['#6366f1', '#a855f7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="py-3 rounded-xl flex-row justify-center items-center shadow-lg shadow-indigo-500/30"
          >
            <Text className="text-white font-bold text-sm mr-2">View Details</Text>
            <Ionicons name="arrow-forward" size={16} color="white" />
          </LinearGradient>
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

  // --- 🔍 FILTER LOGIC ---
  const filteredHackathons = hackathons.filter((item) => {
      const query = searchQuery.toLowerCase();
      // Match Title OR Themes
      const matchesTitle = item.title?.toLowerCase().includes(query);
      const matchesTheme = item.themes?.some((t: any) => t.name.toLowerCase().includes(query));
      
      return matchesTitle || matchesTheme;
  });

  const renderItem = useCallback(({ item }: { item: any }) => (
    <HackathonCard item={item} onPress={handleLinkPress} />
  ), [handleLinkPress]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return <View className="py-5 items-center"><ActivityIndicator size="small" color="#ec4899" /></View>;
  };

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
            <Text className="text-white text-3xl font-black shadow-lg">Hackathons 🚀</Text>
            <Text className="text-gray-300 text-sm mt-1 font-medium">
                Build, compete, and win prizes globally.
            </Text>
        </View>

        {/* 🔍 Search Bar */}
        <View className="mx-5 mt-4 mb-2">
            <View className="flex-row items-center bg-[#1a1a1a]/90 rounded-2xl px-4 border border-white/10 shadow-md">
                <Ionicons name="search" size={20} color="#9ca3af" />
                <TextInput 
                    placeholder="Search (e.g. AI, Web3, HackMIT)..."
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
            data={filteredHackathons}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            
            // Performance Props
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
                    <View className="items-center mt-20">
                        <Ionicons name="code-slash-outline" size={60} color="#333" />
                        <Text className="text-gray-500 mt-4 text-center px-10">
                            {searchQuery ? "No hackathons found matching your search." : "No hackathons available right now."}
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