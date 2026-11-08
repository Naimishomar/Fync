import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { View, FlatList, ActivityIndicator, Linking, RefreshControl, StatusBar } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { C } from '../../constants/colors';
import { AppBar, Empty, SearchField } from '../ui/kit';
import { ListingCard, FooterStat } from './OpportunityCard';

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

const dateOr = (d: string | undefined, fallback: string) => (d ? new Date(d).toLocaleDateString() : fallback);

const WorkshopCard = memo(({ item, onPress }: { item: Workshop; onPress: (url: string) => void }) => (
  <ListingCard
    title={item.title}
    subtitle={item.organisation?.name || 'Global organisation'}
    logo={item.organisation?.logoUrl || item.logoUrl2}
    logoKey={String(item.id)}
    banner={item.banner_mobile?.url}
    tags={[
      { icon: 'calendar-outline', label: dateOr(item.start_date, 'Active session') },
      { icon: 'location-outline', label: item.filters?.location || 'Remote' },
      { label: 'Workshop' },
    ]}
    footer={<FooterStat label="Registration ends" value={dateOr(item.regn_deadline, 'Open')} />}
    action={{ title: 'Open', variant: 'solid', onPress: () => onPress(item.seo_url) }}
  />
));

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

      const newWorkshops = res.data?.data?.data || [];

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
  const filteredWorkshops = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return workshops;
    return workshops.filter((item) => (
      item.title?.toLowerCase().includes(query) ||
      item.organisation?.name?.toLowerCase().includes(query)
    ));
  }, [workshops, searchQuery]);

  const renderItem = useCallback(({ item }: { item: Workshop }) => (
    <WorkshopCard item={item} onPress={openLink} />
  ), [openLink]);

  const renderFooter = () => {
    if (!loading && !loadingMore) return <View className="h-12" />;
    return (
      <View className="py-10 items-center">
        <ActivityIndicator size="small" color={C.brand[500]} />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title="Workshops" onBack={() => navigation.goBack()} />

        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search workshops or skills"
          containerStyle={{ marginHorizontal: 20, marginBottom: 12 }}
        />

        {/* List */}
        <FlatList keyboardShouldPersistTaps="handled"
          data={filteredWorkshops}
          renderItem={renderItem}
          keyExtractor={(item, index) => (item.id != null ? String(item.id) : `fallback-${index}`)}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !loading ? (
              <Empty
                icon="construct-outline"
                title="No workshops found"
                hint={searchQuery ? 'No workshops match your search.' : 'No open workshops right now.'}
              />
            ) : null
          }
        />
      </View>
    </View>
  );
}
