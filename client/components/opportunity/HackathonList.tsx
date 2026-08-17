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
    <View className="bg-white rounded-2xl mb-5 mx-6 p-6 shadow-sm shadow-black/5 border border-slate-300">

      {/* Header Row */}
      <View className="flex-row gap-4 items-center">
        {/* Logo */}
        <View className="w-16 h-16 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 items-center justify-center p-2">
          <Image
            source={{ uri: item.logoUrl2 || item.organisation?.logoUrl || 'https://via.placeholder.com/100' }}
            className="w-12 h-12 rounded-xl"
            resizeMode="contain"
          />
        </View>

        {/* Title & Company */}
        <View className="flex-1">
          <Text className="text-slate-900 text-lg font-black  tracking-tighter uppercase leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-slate-600 text-2xs font-black uppercase tracking-wide mt-1">
            {item.organisation?.name || "Global Organisation"}
          </Text>
        </View>
      </View>

      {/* Tags Row */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        {/* Location / Mode */}
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
          <Ionicons
            name={item.job_location?.toLowerCase().includes('online') ? "globe-outline" : "location-sharp"}
            size={14}
            color="#64748b"
          />
          <Text className="text-2xs font-black uppercase tracking-tight text-slate-500 ml-1">
            {item.job_location || "Global"}
          </Text>
        </View>

        {/* Mode (Online/Offline/Region) */}
        {item.region && item.region.toLowerCase() !== (item.job_location || '').toLowerCase() && (
          <View className="flex-row items-center bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
            <Ionicons name="earth" size={14} color="#6366f1" />
            <Text className="text-2xs font-black uppercase tracking-tight text-indigo-500 ml-1">
              {item.region}
            </Text>
          </View>
        )}

        {/* Region/Deadline */}
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
          <Ionicons name="calendar" size={14} color="#64748b" />
          <Text className="text-2xs font-black uppercase tracking-tight text-slate-500 ml-1">
            {item.regnEndDate ? new Date(item.regnEndDate).toLocaleDateString() : "Open"}
          </Text>
        </View>

        {item.filters?.map((f: any, i: number) => {
          if (f.type === 'opportunity_type' || f.name?.toLowerCase().includes('online') || f.name?.toLowerCase().includes('offline')) {
            return (
              <View key={i} className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                <Text className="text-2xs font-black uppercase tracking-tight text-blue-500">{f.name}</Text>
              </View>
            )
          }
          return null;
        })}
      </View>

      {/* Footer / CTA */}
      <View className="mt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-slate-600 font-black uppercase text-2xs tracking-wide">Opportunity Worth</Text>
          <Text className="text-slate-900 text-lg font-black mt-0.5 tracking-tighter uppercase">
            {item.payment_amount
              ? `₹${item.payment_amount}`
              : "Prizes/Certificates"
            }
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => openLink(item.public_url)}
          activeOpacity={0.9}
          className="bg-pink-500 px-8 py-3.5 rounded-2xl shadow-lg shadow-black/20 border border-pink-300"
        >
          <Text className="text-white font-black  uppercase tracking-wide text-xs">Participate</Text>
        </TouchableOpacity>
      </View>

    </View>
  );

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color="#f97316" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">

        {/* Header Title */}
        <View className="px-8 pt-8 pb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-pink-500 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/20">
              <Ionicons name="rocket" size={24} color="white" />
            </View>
            <View>
              <Text className="text-slate-900 text-3xl font-black  tracking-tighter uppercase">Hackathons</Text>
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Build The Future Globally</Text>
            </View>
          </View>
        </View>

        {/* 🔍 Search Bar */}
        <View className="px-6 mt-2 mb-4">
          <View className="flex-row items-center bg-white rounded-3xl px-6 py-2 border border-slate-300 shadow-sm shadow-black/5">
            <Ionicons name="search" size={20} color="#ec4899" />
            <TextInput
              placeholder="Search hackathons, companies..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-3 text-slate-900 text-base font-black "
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
          keyExtractor={(item, index) => item.id?.toString() || `fallback-${index}`}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View className="items-center mt-20 px-10">
                <View className="w-20 h-20 bg-slate-50 rounded-4xl items-center justify-center mb-6">
                  <Ionicons name="search" size={40} color="#CBD5E1" />
                </View>
                <Text className="text-slate-900 font-black  text-xl tracking-tight text-center uppercase">Zero Hits</Text>
                <Text className="text-slate-500 text-center font-bold text-xs mt-2 uppercase tracking-wide">
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
