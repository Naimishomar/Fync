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
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

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
    <View className="bg-card rounded-xl mb-6 mx-gutter p-6 border border-line shadow-hair">

      <View className="flex-row gap-4 items-center">
        {/* Organisation Logo */}
        <View className="w-16 h-16 rounded-card border border-line overflow-hidden bg-paper-2 items-center justify-center p-2">
          <Image
            source={{ uri: imageUrl }}
            className="w-12 h-12 rounded-xl"
            resizeMode="contain"
          />
        </View>

        {/* Title & Organisation */}
        <View className="flex-1">
          <Text className="text-ink text-base font-display uppercase leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-ink-3 text-label font-display uppercase mt-1">
            {orgName}
          </Text>
        </View>
      </View>

      {/* Optional Banner */}
      {bannerUrl && (
        <View className="mt-5 w-full h-32 rounded-card overflow-hidden border border-line">
          <Image source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />
        </View>
      )}

      {/* Tags Row */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        {/* Start Date */}
        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Ionicons name="calendar" size={14} color="#8B857E" />
          <Text className="text-label font-display uppercase text-ink-3 ml-2">
            {item.start_date ? new Date(item.start_date).toLocaleDateString() : 'Active Session'}
          </Text>
        </View>

        {/* Location */}
        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Ionicons name="location-sharp" size={14} color="#8B857E" />
          <Text className="text-label font-display uppercase text-ink-3 ml-2">
            {item.filters?.location || "Remote Hub"}
          </Text>
        </View>

        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Text className="text-label text-accent-text font-display uppercase">
            Workshop
          </Text>
        </View>
      </View>

      {/* Footer / CTA */}
      <View className="mt-6 flex-row items-center justify-between border-t border-line pt-5">
        <View>
          <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
            <Text className="text-ink-3 font-display uppercase text-label">Registration Ends</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          </View>
          <Text className="text-ink text-sm font-display mt-0.5 uppercase">
            {item.regn_deadline ? new Date(item.regn_deadline).toLocaleDateString() : "Open Registry"}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPress(item.seo_url)}
          className="bg-ink px-gutter py-3.5 rounded-xl shadow-hair"
        >
          <Text className="text-white font-display uppercase text-label">Access Portal</Text>
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
        <ActivityIndicator size="small" color="#F97316" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}

      <SafeAreaView className="flex-1" edges={['top']}>

        {/* Arena Header */}
        <View className="px-gutter pt-2">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  className="w-11 h-11 items-center justify-center rounded-xl"
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  style={{ marginLeft: -11 }}
                >
                  <Ionicons name="arrow-back" size={24} color="#12100E" />
                </TouchableOpacity>
                <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Workshop</Text>
                <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Hub</Text>
              </View>
              <Text className="text-ink-3 text-label font-display uppercase">Industry Masterclass Archive</Text>
            </View>
          </View>
        </View>

        {/* 🔍 Arena Search Dock */}
        <View className="px-gutter mb-3">
          <View className="flex-row items-center bg-card px-5 h-14 border-2 border-ink shadow-hair rounded-md">
            <Ionicons name="search" size={20} color="#F97316" />
            <TextInput
              placeholder="Search labs, workshops, skills..."
              placeholderTextColor="#8B857E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-3 text-ink text-sm font-display uppercase"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} className="bg-paper-2 p-1.5 rounded-xl">
                <Ionicons name="close" size={16} color="#8B857E" />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !loading ? (
              <View className="items-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="construct" size={40} color="#C4BEB6" />
                </View>
                <Text className="text-ink font-display text-xl text-center uppercase">Zero Signals</Text>
                <Text className="font-sans text-sm text-ink-3 text-center mt-2">
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
