import React, { useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, Linking, StatusBar } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Avatar, Button, Card, Empty, IconTile, SearchField, Sheet, Tabs } from '../ui/kit';
import { OpportunityCard } from './OpportunityCard';

import FyncRefreshControl from '../ui/FyncRefreshControl';
type Kind = 'job' | 'internship';
const COPY: Record<Kind, { title: string; noun: string; nouns: string }> = {
  job: { title: 'Jobs', noun: 'job', nouns: 'jobs' },
  internship: { title: 'Internships', noun: 'internship', nouns: 'internships' },
};
const TABS = ['All', 'Shortlisted'];

const CheckRow = ({ icon, label, ok }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; ok: boolean }) => (
  <View className="flex-row items-center" style={{ gap: 12 }}>
    <IconTile icon={icon} size={36} />
    <Text className="flex-1 font-semibold text-base text-ink">{label}</Text>
    <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={22} color={ok ? C.success : C.danger} accessibilityLabel={ok ? 'Ready' : 'Missing'} />
  </View>
);

/** Jobs and internships listing: one screen, two types (JobList / InternshipList wrap it). */
export default function OpportunityList({ type }: { type: Kind }) {
  const copy = COPY[type];
  const route = useRoute<any>();
  const recruiterId = route.params?.recruiterId;
  const [activeTab, setActiveTab] = useState<'all' | 'shortlisted'>('all');
  const [items, setItems] = useState<any[]>([]);
  const [shortlistedItems, setShortlistedItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  // Starts true so the empty state doesn't flash before the first fetch lands.
  const [loading, setLoading] = useState(true);
  // Search-as-you-type and tab switches fire overlapping requests; only the
  // latest may write state. The old `if (loading) return` guard dropped the
  // newest query (or the shortlist tab) whenever an earlier one was in flight.
  const reqIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await (activeTab === 'all' ? fetchItems(1) : fetchShortlisted());
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'all') {
        fetchItems(1);
      } else {
        fetchShortlisted();
      }
    }, [searchQuery, activeTab])
  );

  const fetchItems = async (pageNum: number, term = searchQuery) => {
    if (pageNum > 1 && inFlightRef.current) return;
    const id = ++reqIdRef.current;
    inFlightRef.current = true;
    setLoading(true);

    try {
      const recruiterParam = recruiterId ? `&recruiterId=${recruiterId}` : '';
      const response = await axios.get(`/opportunity/list?type=${type}&page=${pageNum}&limit=15&search=${encodeURIComponent(term)}${recruiterParam}`);
      if (id !== reqIdRef.current) return;

      if (response.data.success) {
        const newData = response.data.data || [];

        if (newData.length === 0 && pageNum === 1) {
          setItems([]);
          setHasMore(false);
        } else if (newData.length === 0) {
          setHasMore(false);
        } else {
          setItems((prev) => {
            if (pageNum === 1) return newData;
            const combined = [...prev, ...newData];
            const uniqueMap = new Map(combined.map((item) => [item._id, item]));
            return Array.from(uniqueMap.values());
          });
          setHasMore(response.data.hasMore);
          setPage(pageNum);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${copy.nouns}:`, error);
    } finally {
      if (id === reqIdRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  };

  const fetchShortlisted = async () => {
    const id = ++reqIdRef.current;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const response = await axios.get(`/opportunity/student/shortlisted?type=${type}`);
      if (id !== reqIdRef.current) return;
      if (response.data.success) {
        setShortlistedItems(response.data.data || []);
      }
    } catch (error) {
      console.error(`Error fetching shortlisted ${copy.nouns}:`, error);
    } finally {
      if (id === reqIdRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  };

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'all' && hasMore && !loading) {
      fetchItems(page + 1, searchQuery);
    }
  }, [hasMore, loading, page, activeTab, searchQuery]);

  const onSearchSubmit = () => {
    if (activeTab === 'all') {
      fetchItems(1, searchQuery);
    }
  };

  const handleApply = useCallback((item: any) => {
    if (user?.user_access === 'recruiter') {
      Alert.alert('Recruiter View', 'Recruiters cannot apply for posts.');
      return;
    }

    if (item.applicationLink) {
      let url = item.applicationLink;
      if (!url.startsWith('http')) url = 'https://' + url;
      Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
      return;
    }

    setSelectedItem(item);
    setApplyModalVisible(true);
  }, [user]);

  const confirmApplication = async () => {
    if (!selectedItem || applying) return;

    setApplying(true);
    try {
      const res = await axios.post(`/opportunity/apply/${selectedItem._id}`, {});
      if (res.data.success) {
        setApplyModalVisible(false);
        Alert.alert('Success', 'Your application has been submitted!');
        setItems((prev) => prev.map((opt) =>
          opt._id === selectedItem._id ? { ...opt, hasApplied: true } : opt
        ));
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Application failed';
      Alert.alert('Notice', msg);
    } finally {
      setApplying(false);
    }
  };

  const isRecruiter = user?.user_access === 'recruiter';
  const resumeBlocked = !user?.resumeUrl && !!selectedItem?.requireResume;

  const renderItem = useCallback(({ item }: { item: any }) => (
    <OpportunityCard item={item} onApply={handleApply} hideApply={isRecruiter} />
  ), [handleApply, isRecruiter]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
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
        <AppBar title={copy.title} onBack={() => navigation.goBack()} />


        <View className="px-gutter border-b border-line mb-3">
          <Tabs
            items={TABS}
            value={activeTab === 'all' ? 'All' : 'Shortlisted'}
            onChange={(t) => setActiveTab(t === 'All' ? 'all' : 'shortlisted')}
          />
        </View>

        {activeTab === 'all' ? (
          <SearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={onSearchSubmit}
            onClear={() => fetchItems(1, '')}
            placeholder="Search roles, skills or companies"
            containerStyle={{ marginHorizontal: 20, marginBottom: 12 }}
          />
        ) : null}

        {!isRecruiter ? (
          <Card padded style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon="flash-outline" />
            <View className="flex-1">
              <Text className="text-ink font-semibold text-sm">Keep your profile complete</Text>
              <Text className="text-ink-3 text-xs leading-4 mt-0.5">
                Recruiters see complete Fync profiles first.
              </Text>
            </View>
          </Card>
        ) : null}

        <FlatList
          keyboardShouldPersistTaps="handled"
          data={activeTab === 'all' ? items : shortlistedItems}
          keyExtractor={(item, index) => item._id || `fallback-${index}`}
          renderItem={renderItem}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews
          updateCellsBatchingPeriod={50}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} colors={[C.brand[500]]} />}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <Empty
                icon={activeTab === 'all' ? 'briefcase-outline' : 'star-outline'}
                title={activeTab === 'all' ? `No ${copy.nouns} found` : 'No shortlists yet'}
                hint={activeTab === 'all'
                  ? (searchQuery ? `No ${copy.nouns} match your search.` : `No ${copy.nouns} posted right now.`)
                  : `No shortlisted ${copy.nouns} yet. A complete profile helps recruiters find you.`}
                action={activeTab === 'all' ? undefined : <Button variant="primary" title={`Browse ${copy.nouns}`} onPress={() => setActiveTab('all')} />}
              />
            ) : null
          }
        />

        <Sheet
          visible={applyModalVisible}
          onClose={() => setApplyModalVisible(false)}
          title="Review application"
          subtitle="Check your details before sending"
          footer={
            <View className="flex-row" style={{ gap: 12 }}>
              <Button title="Cancel" onPress={() => setApplyModalVisible(false)} style={{ flex: 1 }} />
              <Button
                title="Confirm application"
                variant="primary"
                onPress={confirmApplication}
                loading={applying}
                disabled={resumeBlocked}
                style={{ flex: 1 }}
              />
            </View>
          }
        >
          <View className="flex-row items-center mb-4 pb-4 border-b border-line" style={{ gap: 12 }}>
            <Avatar uri={user?.avatar} initials={user?.name} size={56} />
            <View className="flex-1" style={{ minWidth: 0 }}>
              <Text className="text-ink font-semibold text-lg" numberOfLines={1}>{user?.name}</Text>
              <Text className="text-ink-3 text-sm" numberOfLines={1}>{user?.username} · {user?.college || 'No college'}</Text>
            </View>
          </View>

          <View style={{ gap: 16 }}>
            <CheckRow icon="document-text-outline" label="Resume" ok={!!user?.resumeUrl} />
            <CheckRow icon="shield-checkmark-outline" label="Fync profile" ok />
          </View>

          {resumeBlocked ? (
            <View className="mt-4 p-4 bg-paper-2 rounded-2xl flex-row items-center" style={{ gap: 12 }}>
              <Ionicons name="alert-circle-outline" size={20} color={C.accentText} />
              <Text className="text-ink-2 text-sm flex-1">This role needs a resume. Add one to your profile to apply.</Text>
              <Button title="Add resume" small variant="primary"
                onPress={() => { setApplyModalVisible(false); navigation.navigate('FyncProfileBuilder'); }} />
            </View>
          ) : null}
        </Sheet>
      </View>
    </View>
  );
}
