import React, { useEffect, useState } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      const response = await fetch(
        `https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=${pageNum}&per_page=15&oppstatus=open&quickApply=true`
      );

      const json = await response.json();
      const newData = json.data?.data || [];

      if (newData.length === 0) {
        setHasMore(false);
      } else {
        setHackathons((prev) => {
          const combined = [...prev, ...newData];
          const uniqueMap = new Map(combined.map(item => [item.id, item]));
          return Array.from(uniqueMap.values());
        });

        setPage(pageNum);
      }
    } catch (error) {
      console.error("Error fetching hackathons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading && searchQuery === "") {
      fetchHackathons(page + 1);
    }
  };

  const filteredHackathons = hackathons.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(query) ||
      item.organisation?.name?.toLowerCase().includes(query) ||
      item.job_location?.toLowerCase().includes(query) ||
      item.region?.toLowerCase().includes(query) ||
      item.filters?.some((f: any) => f.name?.toLowerCase().includes(query))
    );
  });

  const openLink = (slug: string) => {
    const url = `https://unstop.com/${slug}`;
    if (url) Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View className="bg-card rounded-card mb-5 mx-gutter p-6 shadow-hair border border-line">

      {/* Header Row */}
      <View className="flex-row gap-4 items-center">
        {/* Logo */}
        <View className="w-16 h-16 rounded-card border border-line overflow-hidden bg-paper-2 items-center justify-center p-2">
          <Image
            source={{ uri: item.logoUrl2 || item.organisation?.logoUrl || 'https://via.placeholder.com/100' }}
            className="w-12 h-12 rounded-xl"
            resizeMode="contain"
          />
        </View>

        {/* Title & Company */}
        <View className="flex-1">
          <Text className="text-ink text-lg font-display uppercase leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-ink-2 text-label font-display uppercase mt-1">
            {item.organisation?.name || "Global Organisation"}
          </Text>
        </View>
      </View>

      {/* Tags Row */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        {/* Location / Mode */}
        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Ionicons
            name={item.job_location?.toLowerCase().includes('online') ? "globe-outline" : "location-sharp"}
            size={14}
            color="#8B857E"
          />
          <Text className="text-label font-display uppercase text-ink-3 ml-1">
            {item.job_location || "Global"}
          </Text>
        </View>

        {/* Mode (Online/Offline/Region) */}
        {item.region && item.region.toLowerCase() !== (item.job_location || '').toLowerCase() && (
          <View className="flex-row items-center bg-recruiter/10 px-3 py-1.5 rounded-xl border border-recruiter/15">
            <Ionicons name="earth" size={14} color="#4F46E5" />
            <Text className="text-label font-display uppercase text-recruiter ml-1">
              {item.region}
            </Text>
          </View>
        )}

        {/* Region/Deadline */}
        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Ionicons name="calendar" size={14} color="#8B857E" />
          <Text className="text-label font-display uppercase text-ink-3 ml-1">
            {item.regnEndDate ? new Date(item.regnEndDate).toLocaleDateString() : "Open"}
          </Text>
        </View>

        {item.filters?.map((f: any, i: number) => {
          if (f.type === 'opportunity_type' || f.name?.toLowerCase().includes('online') || f.name?.toLowerCase().includes('offline')) {
            return (
              <View key={i} className="bg-fam-career/10 border border-fam-career/15 px-2.5 py-1 rounded-full">
                <Text className="text-label font-display uppercase text-fam-career">{f.name}</Text>
              </View>
            )
          }
          return null;
        })}
      </View>

      {/* Footer / CTA */}
      <View className="mt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-ink-2 font-display uppercase text-label">Opportunity Worth</Text>
          <Text className="text-ink text-lg font-display mt-0.5 uppercase">
            {item.payment_amount
              ? `₹${item.payment_amount}`
              : "Prizes/Certificates"
            }
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => openLink(item.public_url)}
          activeOpacity={0.9}
          className="bg-brand-500 px-gutter py-3.5 rounded-card shadow-hair border border-brand-300"
        >
          <Text className="text-ink font-display uppercase text-sm">Participate</Text>
        </TouchableOpacity>
      </View>

    </View>
  );

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color="#F97316" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">

        {/* Header Title */}
        <View className="px-gutter pt-8 pb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-brand-500 rounded-card items-center justify-center shadow-hair">
              <Ionicons name="rocket" size={24} color="#12100E" />
            </View>
            <View>
              <Text className="text-ink text-3xl font-display uppercase">Hackathons</Text>
              <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Build The Future Globally</Text>
            </View>
          </View>
        </View>

        {/* 🔍 Search Bar */}
        <View className="px-6 mt-2 mb-4">
          <View className="flex-row items-center bg-card px-6 py-2 border-2 border-ink shadow-hair rounded-md">
            <Ionicons name="search" size={20} color="#F97316" />
            <TextInput
              placeholder="Search hackathons, companies..."
              placeholderTextColor="#8B857E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-3 text-ink text-base font-display"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} className="bg-paper-2 p-1 rounded-full">
                <Ionicons name="close" size={18} color="#8B857E" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        <FlatList
          data={filteredHackathons}
          keyExtractor={(item, index) => item.id?.toString() || `fallback-${index}`}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View className="items-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="search" size={40} color="#C4BEB6" />
                </View>
                <Text className="text-ink font-display text-xl text-center uppercase">Zero Hits</Text>
                <Text className="font-sans text-sm text-ink-3 text-center mt-2">
                  {searchQuery ? "We couldn't find matches for your search protocol." : "The hackathon vault is currently locked."}
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
