import React, { useEffect, useState, useCallback, memo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  Pressable, 
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

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
    <View className="bg-white rounded-2xl mb-5 overflow-hidden border border-gray-200 shadow-sm">
      <Image 
        source={{ uri: fixUrl(item.thumbnail_url) }} 
        className="w-full h-56 bg-gray-100"
        resizeMode="stretch"
      />
      
      <View className="p-4">
        <Text className="text-lg font-bold text-gray-800 mb-2" numberOfLines={2}>
            {item.title}
        </Text>
        
        <View className="flex-row mb-3 gap-2">
          <View className="bg-gray-100 px-2 py-1 rounded-md">
            <Text className="text-xs text-gray-600 font-semibold">
              {item.submission_period_dates || "Open"}
            </Text>
          </View>
          
          <View className={`px-2 py-1 rounded-md ${item.is_online ? "bg-green-50" : "bg-blue-50"}`}>
            <Text className={`text-xs font-semibold ${item.is_online ? "text-green-700" : "text-blue-700"}`}>
              {item.is_online ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        <View className="flex-col mb-4 gap-2">
          <View className="flex-row">
            <Ionicons name="trophy-outline" size={16} color="#F59E0B" />
            <Text className="ml-2 text-gray-600 font-medium text-sm">
                {stripHtml(item.prize_amount)}
            </Text>
          </View>
          <View className="flex-row">
            <Ionicons name="people-outline" size={16} color="#F59E0B" />
            <Text className="ml-2 text-gray-600 font-medium text-sm">
                {item.registrations_count || "See details"} { item.registrations_count ? "Registered" : ""}
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-4">
          {item.themes?.slice(0, 3).map((theme: any, index: number) => (
            <Text key={index} className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded overflow-hidden">
                #{theme.name}
            </Text>
          ))}
        </View>

        <Pressable 
          activeOpacity={0.8}
          onPress={() => onPress(item.url)}
          className="bg-indigo-600 py-3 rounded-xl flex-row justify-center items-center"
        >
          <Text className="text-white font-bold text-base mr-2">Apply Now</Text>
          <Ionicons name="arrow-forward" size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
});

const HackathonList = () => {
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchHackathons(1);
  }, []);

  const fetchHackathons = async (pageNum: number) => {
    if (loading) return;
    setLoading(true);
    try {
      console.log(`Fetching page ${pageNum}...`);
      const response = await fetch(`https://devpost.com/api/hackathons?page=${pageNum}`);
      const data = await response.json();
      const newHackathons = data.hackathons || [];

      if (newHackathons.length === 0) {
        setHasMore(false);
      } else {
        // Use Set to prevent duplicates if API sends them
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

  // --- 2. USECALLBACK FOR HANDLERS ---
  // Ensures the function reference doesn't change on re-renders
  const handleLinkPress = useCallback((url: string) => {
    if (url) Linking.openURL(url);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchHackathons(page + 1);
    }
  }, [hasMore, loading, page]);

  // --- 3. MEMOIZED RENDER ITEM ---
  const renderItem = useCallback(({ item }: { item: any }) => (
    <HackathonCard item={item} onPress={handleLinkPress} />
  ), [handleLinkPress]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return <View className="py-5 items-center"><ActivityIndicator size="large" color="#4F46E5" /></View>;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Text className="text-2xl font-bold text-gray-900 p-5 bg-white">
        🚀 Discover Hackathons
      </Text>
      
      <FlatList
        data={hackathons}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        
        // --- 4. PERFORMANCE PROPS ---
        initialNumToRender={5}       // Reduce initial load
        maxToRenderPerBatch={5}      // Render fewer items per scroll batch
        windowSize={5}               // Keep fewer items in memory (default is 21)
        removeClippedSubviews={true} // Unmount components that are off-screen (Android fix)
        updateCellsBatchingPeriod={50} // Wait 50ms between batches
        
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        contentContainerClassName="p-4 pb-10"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

export default HackathonList;