import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  Linking, 
  SafeAreaView,
  RefreshControl,
  Dimensions
} from 'react-native';
import axios from 'axios'; // Direct import for external API
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

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

export default function WorkshopList() {
  const navigation = useNavigation<any>();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- FETCH DATA ---
  const fetchWorkshops = async (pageNum: number, shouldRefresh = false) => {
    try {
      if (!hasMore && !shouldRefresh) return;
      
      const res = await axios.get(
        `https://unstop.com/api/public/opportunity/search-result?opportunity=workshops&page=${pageNum}&per_page=15&oppstatus=open&quickApply=true`
      );

      // Unstop API usually returns data in res.data.data.data for paginated results
      const newWorkshops = res.data.data.data || [];
      
      if (newWorkshops.length === 0) {
        setHasMore(false);
      }

      if (shouldRefresh || pageNum === 1) {
        setWorkshops(newWorkshops);
      } else {
        setWorkshops(prev => [...prev, ...newWorkshops]);
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
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchWorkshops(nextPage);
    }
  };

  const openLink = (seoUrl: string) => {
    const fullUrl = `https://unstop.com/${seoUrl}`;
    Linking.openURL(fullUrl).catch(err => console.error("Couldn't load page", err));
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }: { item: Workshop }) => {
    // Fallback for images
    const imageUrl = item.banner_mobile?.url || item.logoUrl2 || 'https://via.placeholder.com/300x150?text=No+Image';
    const orgName = item.organisation?.name || "Unstop";

    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => openLink(item.seo_url)}
        className="bg-gray-900 mb-4 rounded-xl overflow-hidden border border-gray-800"
      >
        {/* Banner Image */}
        <Image 
            source={{ uri: imageUrl }} 
            className="w-full h-36"
            resizeMode="cover"
        />

        {/* Content */}
        <View className="p-4">
            <Text className="text-white text-lg font-bold leading-6 mb-1">{item.title}</Text>
            
            <View className="flex-row items-center mb-3">
                <Ionicons name="business-outline" size={14} color="#9ca3af" />
                <Text className="text-gray-400 text-sm ml-1 flex-1" numberOfLines={1}>{orgName}</Text>
            </View>

            <View className="flex-row justify-between items-center mt-2 border-t border-gray-800 pt-3">
                <View className="flex-row items-center bg-gray-800 px-2 py-1 rounded">
                    <Ionicons name="calendar-outline" size={14} color="#fbbf24" />
                    <Text className="text-gray-300 text-xs ml-1">
                        {item.start_date ? new Date(item.start_date).toLocaleDateString() : 'Coming Soon'}
                    </Text>
                </View>

                <TouchableOpacity 
                    onPress={() => openLink(item.seo_url)}
                    className="flex-row items-center bg-blue-600 px-4 py-2 rounded-full"
                >
                    <Text className="text-white font-bold text-xs mr-1">Apply</Text>
                    <Ionicons name="arrow-forward" size={12} color="white" />
                </TouchableOpacity>
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  // --- HEADER ---
  const renderHeader = () => (
    <View className="flex-row items-center px-4 py-4 border-b border-gray-900 bg-black">
      <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text className="text-xl font-bold text-white">Workshops</Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      {renderHeader()}
      
      {loading && page === 1 ? (
        <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={workshops}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator size="small" color="#fff" className="py-4" /> : null
          }
          ListEmptyComponent={
            <View className="items-center justify-center mt-20">
                <MaterialCommunityIcons name="calendar-remove" size={64} color="#374151" />
                <Text className="text-gray-500 mt-4 text-center">No open workshops found right now.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}