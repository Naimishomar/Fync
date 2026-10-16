import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Linking,
  TextInput,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

const HackathonList = () => {
  const navigation = useNavigation<any>();
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  // Starts true so the empty state doesn't flash before the first page lands.
  const [loading, setLoading] = useState(true);
  // onEndReached can fire twice before `loading` state re-renders; a ref stops the duplicate page.
  const inFlightRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);

  // 🔍 Search State
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchHackathons(1);
  }, []);

  const fetchHackathons = async (pageNum: number) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading && searchQuery === "") {
      fetchHackathons(page + 1);
    }
  };

  const filteredHackathons = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return hackathons;
    return hackathons.filter((item) => (
      item.title?.toLowerCase().includes(query) ||
      item.organisation?.name?.toLowerCase().includes(query) ||
      item.job_location?.toLowerCase().includes(query) ||
      item.region?.toLowerCase().includes(query) ||
      item.filters?.some((f: any) => f.name?.toLowerCase().includes(query))
    ));
  }, [hackathons, searchQuery]);

  const openLink = (slug?: string) => {
    if (slug) Linking.openURL(`https://unstop.com/${slug}`).catch(() => {});
  };

  const renderItem = useCallback(({ item }: { item: any }) => (
    <View className="bg-card rounded-card mb-5 mx-gutter p-6 shadow-hair border border-line">

      {/* Header Row */}
      <View className="flex-row gap-4 items-center">
        {/* Logo */}
        <View className="w-16 h-16 rounded-card border border-line overflow-hidden bg-paper-2 items-center justify-center p-2">
          <ExpoImage
            source={{ uri: item.logoUrl2 || item.organisation?.logoUrl }}
            style={{ width: 48, height: 48, borderRadius: 12 }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>

        {/* Title & Company */}
        <View className="flex-1">
          <Text className="text-ink text-lg font-display uppercase leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-ink-2 text-label font-display uppercase mt-1" numberOfLines={1}>
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
            color={C.ink3}
          />
          <Text className="text-label font-display uppercase text-ink-3 ml-1">
            {item.job_location || "Global"}
          </Text>
        </View>

        {/* Mode (Online/Offline/Region) */}
        {item.region && item.region.toLowerCase() !== (item.job_location || '').toLowerCase() && (
          <View className="flex-row items-center bg-recruiter/10 px-3 py-1.5 rounded-xl border border-recruiter/15">
            <Ionicons name="earth" size={14} color={C.recruiter} />
            <Text className="text-label font-display uppercase text-recruiter ml-1">
              {item.region}
            </Text>
          </View>
        )}

        {/* Region/Deadline */}
        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Ionicons name="calendar" size={14} color={C.ink3} />
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
  ), []);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color={C.brand[500]} />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      <View className="flex-1">
        <AppBar title="Hackathons" onBack={() => navigation.goBack()} />

        {/* 🔍 Search Bar */}
        <View className="px-gutter mt-2 mb-4">
          <View className="flex-row items-center bg-card px-6 py-2 border-2 border-ink shadow-hair rounded-md">
            <Ionicons name="search" size={20} color={C.brand[500]} />
            <TextInput
              placeholder="Search hackathons, companies..."
              placeholderTextColor={C.ink3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-3 text-ink text-base font-display"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={12} className="bg-paper-2 p-1 rounded-full">
                <Ionicons name="close" size={18} color={C.ink3} />
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
          initialNumToRender={6}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            !loading ? (
              <View className="items-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="search" size={40} color={C.ink4} />
                </View>
                <Text className="text-ink font-display text-xl text-center uppercase">Zero Hits</Text>
                <Text className="font-sans text-sm text-ink-3 text-center mt-2">
                  {searchQuery ? "We couldn't find matches for your search protocol." : "The hackathon vault is currently locked."}
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
};

export default HackathonList;
