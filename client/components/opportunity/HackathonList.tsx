import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, ActivityIndicator, Linking, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C } from '../../constants/colors';
import { AppBar, Empty, SearchField } from '../ui/kit';
import { ListingCard, FooterStat, type ListingTag } from './OpportunityCard';

const openLink = (slug?: string) => {
  if (slug) Linking.openURL(`https://unstop.com/${slug}`).catch(() => {});
};

const HackathonCard = memo(({ item, onOpen }: { item: any; onOpen: (slug?: string) => void }) => {
  const loc = item.job_location || 'Global';
  const tags: ListingTag[] = [
    { icon: /online/i.test(loc) ? 'globe-outline' : 'location-outline', label: loc },
    ...(item.region && item.region.toLowerCase() !== loc.toLowerCase() ? [{ icon: 'earth-outline' as const, label: item.region }] : []),
    { icon: 'calendar-outline', label: item.regnEndDate ? new Date(item.regnEndDate).toLocaleDateString() : 'Open' },
    ...(item.filters || [])
      .filter((f: any) => f.name && (f.type === 'opportunity_type' || /online|offline/i.test(f.name)))
      .map((f: any) => ({ label: f.name })),
  ];
  return (
    <ListingCard
      title={item.title}
      subtitle={item.organisation?.name || 'Global organisation'}
      logo={item.logoUrl2 || item.organisation?.logoUrl}
      logoKey={String(item.id)}
      tags={tags}
      footer={<FooterStat label="Prizes" value={item.payment_amount ? `₹${item.payment_amount}` : 'Prizes / certificates'} />}
      action={{ title: 'Participate', onPress: () => onOpen(item.public_url) }}
    />
  );
});

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

  const renderItem = useCallback(({ item }: { item: any }) => (
    <HackathonCard item={item} onOpen={openLink} />
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
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title="Hackathons" onBack={() => navigation.goBack()} />

        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search hackathons or companies"
          containerStyle={{ marginHorizontal: 20, marginTop: 8, marginBottom: 12 }}
        />

        {/* List */}
        <FlatList keyboardShouldPersistTaps="handled"
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
              <Empty
                icon="search-outline"
                title="No hackathons found"
                hint={searchQuery ? 'No hackathons match your search.' : 'No open hackathons right now.'}
              />
            ) : null
          }
        />
      </View>
    </View>
  );
};

export default HackathonList;
