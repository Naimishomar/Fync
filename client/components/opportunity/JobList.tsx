import React, { useEffect, useState, useCallback, memo } from 'react';
import {View, Text, FlatList, Image, ActivityIndicator, Pressable, Linking, TextInput, TouchableOpacity, StatusBar, Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

// --- 1. MEMOIZED JOB CARD (Dark Theme) ---
const JobCard = memo(({ item, onApply, hideApply }: { item: any; onApply: (item: any) => void; hideApply?: boolean }) => {
  return (
    <View className="bg-card rounded-card mb-6 mx-gutter p-6 border border-line shadow-hair">

      <View className="flex-row gap-4 items-center">
        {/* Company Logo */}
        <View className="w-16 h-16 rounded-card border border-line overflow-hidden bg-paper-2 items-center justify-center p-2">
          <Image
            source={{ uri: item.companyLogo || 'https://via.placeholder.com/100' }}
            className="w-12 h-12 rounded-xl"
            resizeMode="contain"
          />
        </View>

        {/* Title & Company */}
        <View className="flex-1">
          <Text className="text-ink text-base font-display uppercase leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-ink-3 text-label font-display uppercase mt-1">
            {item.company}
          </Text>
        </View>
      </View>

      {/* Tags Row */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        {/* Experience */}
        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Ionicons name="briefcase" size={14} color="#8B857E" />
          <Text className="text-label font-display uppercase text-ink-3 ml-2">
            {item.experience || "Fresher"}
          </Text>
        </View>

        {/* Location */}
        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Ionicons name="location-sharp" size={14} color="#8B857E" />
          <Text className="text-label font-display uppercase text-ink-3 ml-2">
            {item.location}
          </Text>
        </View>

        <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
          <Text className="text-label text-accent-text font-display uppercase">
            {item.opportunityType}
          </Text>
        </View>
      </View>

      {/* Description */}
      {item.description && (
        <View className="mt-5 bg-paper-2/50 p-4 rounded-card border border-dashed border-line">
          <View className="flex-row items-center mt-6 mb-2" style={{ gap: 12 }}>
            <Text className="text-ink-3 font-display uppercase text-label">Protocol Details</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          </View>
          <Text className="text-ink-2 text-xs leading-5 font-medium">
            {item.description}
          </Text>
        </View>
      )}

      {/* Footer / CTA */}
      <View className="mt-6 flex-row items-center justify-between border-t border-line pt-5">
        <View>
          <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
            <Text className="text-ink-3 font-display uppercase text-label">Capital Package</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          </View>
          <Text className="text-ink text-lg font-display uppercase">
            {item.isPaid ? (item.stipend.startsWith('₹') ? item.stipend : `₹${item.stipend}`) : "Voluntary"}
          </Text>
        </View>

        {!hideApply && (
          <TouchableOpacity
            onPress={() => !item.hasApplied && onApply(item)}
            activeOpacity={item.hasApplied ? 1 : 0.9}
            className={`${item.hasApplied ? 'bg-paper-2 border-line' : 'bg-ink'} px-gutter py-3.5 rounded-card shadow-hair`}
          >
            <Text className={`${item.hasApplied ? 'text-ink-3' : 'text-white'} font-display uppercase text-label`}>
              {item.hasApplied ? 'Registered' : 'Apply Now'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
});

const JobList = () => {
  const route = useRoute<any>();
  const recruiterId = route.params?.recruiterId;
  const [activeTab, setActiveTab] = useState<'all' | 'shortlisted'>('all');
  const [jobs, setJobs] = useState<any[]>([]);
  const [shortlistedItems, setShortlistedItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [applying, setApplying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'all') {
        fetchJobs(1);
      } else {
        fetchShortlisted();
      }
    }, [searchQuery, activeTab])
  );

  const fetchJobs = async (pageNum: number, term = searchQuery) => {
    if (loading) return;
    setLoading(true);

    try {
      const recruiterParam = recruiterId ? `&recruiterId=${recruiterId}` : "";
      const response = await axios.get(`/opportunity/list?type=job&page=${pageNum}&limit=15&search=${term}${recruiterParam}`);

      if (response.data.success) {
        const newData = response.data.data || [];

        if (newData.length === 0 && pageNum === 1) {
          setJobs([]);
          setHasMore(false);
        } else if (newData.length === 0) {
          setHasMore(false);
        } else {
          setJobs((prev) => {
            if (pageNum === 1) return newData;
            const combined = [...prev, ...newData];
            const uniqueMap = new Map(combined.map(item => [item._id, item]));
            return Array.from(uniqueMap.values());
          });
          setHasMore(response.data.hasMore);
          setPage(pageNum);
        }
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShortlisted = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await axios.get(`/opportunity/student/shortlisted?type=job`);
      if (response.data.success) {
        setShortlistedItems(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching shortlisted jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'all' && hasMore && !loading) {
      fetchJobs(page + 1);
    }
  }, [hasMore, loading, page, activeTab]);

  const onSearchSubmit = () => {
    if (activeTab === 'all') {
      fetchJobs(1, searchQuery);
    }
  };

  const handleApply = useCallback((item: any) => {
    if (user?.user_access === 'recruiter') {
      Alert.alert("Recruiter View", "Recruiters cannot apply for posts.");
      return;
    }

    if (item.applicationLink) {
      let url = item.applicationLink;
      if (!url.startsWith('http')) url = 'https://' + url;
      Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
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
        Alert.alert("Success", "Your application has been submitted!");
        setJobs(prev => prev.map(opt =>
          opt._id === selectedItem._id ? { ...opt, hasApplied: true } : opt
        ));
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "Application failed";
      Alert.alert("Notice", msg);
    } finally {
      setApplying(false);
    }
  };

  const isRecruiter = user?.user_access === 'recruiter';

  const renderItem = useCallback(({ item }: { item: any }) => (
    <JobCard item={item} onApply={handleApply} hideApply={isRecruiter} />
  ), [handleApply, isRecruiter]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
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
          <View className="flex-row items-center justify-between mb-6">
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
                <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Jobs</Text>
                <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Hub</Text>
              </View>
              <Text className="text-ink-3 text-label font-display uppercase">Professional Opportunity Archive</Text>
            </View>
          </View>
        </View>

        {/* Arena Tabs */}
        {/* Segmented tabs with the brand underline. The previous pill pair put
            white on the brand fill, which is 2.1:1 and fails AA outright. */}
        <View className="flex-row px-gutter border-b border-line mb-4" style={{ gap: 24 }}>
          {(['all', 'shortlisted'] as const).map((tab) => {
            const on = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                className="pt-2.5 pb-3"
              >
                <Text className={`font-display text-sm ${on ? 'text-ink' : 'text-ink-3'}`}>
                  {tab === 'all' ? 'Market Registry' : 'Shortlisted'}
                </Text>
                {on ? <View className="absolute left-0 right-0 -bottom-px h-[3px] rounded-sm bg-brand-500" /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 🔍 Arena Search Dock */}
        {activeTab === 'all' && (
          <View className="px-gutter mb-3">
            <View className="flex-row items-center bg-card px-5 h-14 border-2 border-ink shadow-hair rounded-md">
              <Ionicons name="search" size={20} color="#F97316" />
              <TextInput
                placeholder="Search roles, skills, or firms..."
                placeholderTextColor="#8B857E"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={onSearchSubmit}
                returnKeyType="search"
                className="flex-1 ml-3 text-ink text-sm font-display uppercase"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(""); fetchJobs(1, ""); }} className="bg-paper-2 p-1.5 rounded-xl">
                  <Ionicons name="close" size={16} color="#8B857E" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 📝 Technical Note */}
        {user?.user_access !== 'recruiter' && (
          <View className="mx-gutter p-5 bg-card rounded-card border border-line flex-row items-center shadow-hair">
            <View className="bg-brand-500/10 w-10 h-10 rounded-xl items-center justify-center border border-brand-500/20">
              <Ionicons name="flash" size={20} color="#F97316" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-ink font-display uppercase text-label">Technical Advisory</Text>
              <Text className="text-ink-3 text-label font-semibold leading-4 mt-0.5">
                Maintain an active Fync Portfolio. Recruitment bots prioritize synchronized profiles.
              </Text>
            </View>
          </View>
        )}

        {/* List */}
        <FlatList
          data={activeTab === 'all' ? jobs : shortlistedItems}
          keyExtractor={(item, index) => item._id || `fallback-${index}`}
          renderItem={renderItem}
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
              <View className="items-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name={activeTab === 'all' ? "briefcase" : "star-outline"} size={40} color="#C4BEB6" />
                </View>
                <Text className="text-ink font-display text-xl text-center uppercase">
                  {activeTab === 'all' ? "Zero Matches" : "No Shortlists"}
                </Text>
                <Text className="font-sans text-sm text-ink-3 text-center mt-2">
                  {activeTab === 'all'
                    ? (searchQuery ? "No job signals found in this sector." : "The career portal is currently silent.")
                    : "No shortlisted jobs found. Boost your portfolio to attract recruiters!"}
                </Text>
              </View>
            ) : null
          }
        />

        {/* Application Preview Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={applyModalVisible}
          onRequestClose={() => setApplyModalVisible(false)}
        >
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-paper rounded-t-sheet p-card-pad pb-12">
              <View className="items-center mb-6">
                <View className="w-12 h-1.5 bg-ink-4 rounded-full mb-6" />
                <Text className="font-display text-h1 text-ink">Review Application</Text>
                <Text className="text-ink-3 text-label font-display uppercase mt-1">Check your credentials before sending</Text>
              </View>

              <View className="bg-paper-2 rounded-sheet p-card-pad border border-line mb-10">
                <Text className="font-display text-label text-ink-3 uppercase mb-3" style={{ letterSpacing: 1.4 }}>Candidate Verification</Text>

                <View className="flex-row items-center gap-4 mb-6 pb-6 border-b border-line">
                  <Image source={{ uri: user?.avatar || 'https://via.placeholder.com/100' }} className="w-14 h-14 rounded-card bg-paper-2" />
                  <View>
                    <Text className="text-ink font-display text-lg uppercase">{user?.name}</Text>
                    <Text className="text-ink-3 text-label font-semibold uppercase">{user?.username} • {user?.college || 'External Entity'}</Text>
                  </View>
                </View>

                <View className="gap-5">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="bg-card p-2 rounded-lg border border-line">
                        <Ionicons name="document-text" size={16} color="#F97316" />
                      </View>
                      <Text className="font-semibold text-base text-ink">Master Resume</Text>
                    </View>
                    <Ionicons
                      name={user?.resumeUrl ? "checkmark-circle" : "close-circle"}
                      size={22}
                      color={user?.resumeUrl ? "#047857" : "#DC2626"}
                    />
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="bg-card p-2 rounded-lg border border-line">
                        <Ionicons name="shield-checkmark" size={16} color="#F97316" />
                      </View>
                      <Text className="font-semibold text-base text-ink">Fync Portfolio Sync</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={22} color="#047857" />
                  </View>
                </View>

                {!user?.resumeUrl && selectedItem?.requireResume && (
                  <View className="mt-8 p-5 bg-paper-2 rounded-card border border-line flex-row items-center">
                    <Ionicons name="alert-circle" size={20} color="#F97316" />
                    <Text className="text-brand-700 text-label font-display uppercase flex-1 ml-4 leading-4">
                      Access Denied: Role requires validated resume. Update Registry profile.
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={() => setApplyModalVisible(false)}
                  className="flex-1 py-5 rounded-xl items-center justify-center bg-paper-2"
                >
                  <Text className="text-ink-3 font-display uppercase text-label">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmApplication}
                  disabled={applying || (!user?.resumeUrl && selectedItem?.requireResume)}
                  className={`flex-1 py-5 rounded-card items-center justify-center shadow-hair ${(!user?.resumeUrl && selectedItem?.requireResume) ? 'bg-paper-2' : 'bg-brand-500 '}`}
                >
                  {applying ? <ActivityIndicator color="#12100E" /> : (
                    <Text className="font-display text-ink uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Confirm Application</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

export default JobList;
