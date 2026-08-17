import React, { useEffect, useState, useCallback, memo } from 'react';
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
  StatusBar,
  Alert,
  Modal
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

// --- 1. MEMOIZED INTERNSHIP CARD (Arena Theme) ---
const InternshipCard = memo(({ item, onApply, hideApply }: { item: any; onApply: (item: any) => void; hideApply?: boolean }) => {
  return (
    <View className="bg-white rounded-2xl mb-6 mx-6 p-6 border border-slate-100 shadow-sm shadow-black/5">

      <View className="flex-row gap-4 items-center">
        {/* Company Logo */}
        <View className="w-16 h-16 rounded-2xl border border-slate-100 overflow-hidden bg-slate-50 items-center justify-center p-2 shadow-inner">
          <Image
            source={{ uri: item.companyLogo || 'https://via.placeholder.com/100' }}
            className="w-12 h-12 rounded-xl"
            resizeMode="contain"
          />
        </View>

        {/* Title & Company */}
        <View className="flex-1">
          <Text className="text-slate-900 text-base font-black  tracking-tighter uppercase leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">
            {item.company}
          </Text>
        </View>
      </View>

      {/* Tags Row */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        {/* Experience/Duration */}
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
          <Ionicons name="calendar" size={14} color="#94a3b8" />
          <Text className="text-2xs font-black uppercase tracking-wide text-slate-500 ml-2">
            {item.duration || "Self-Paced"}
          </Text>
        </View>

        {/* Location */}
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
          <Ionicons name="location-sharp" size={14} color="#94a3b8" />
          <Text className="text-2xs font-black uppercase tracking-wide text-slate-500 ml-2">
            {item.location}
          </Text>
        </View>

        <View className="flex-row items-center bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
          <Text className="text-2xs text-orange-500 font-black uppercase tracking-wide">
            {item.opportunityType}
          </Text>
        </View>
      </View>

      {/* Description */}
      {item.description && (
        <View className="mt-5 bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-200">
          <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-2 ">Protocol Details</Text>
          <Text className="text-slate-600 text-xs leading-5 font-medium">
            {item.description}
          </Text>
        </View>
      )}

      {/* Footer / CTA */}
      <View className="mt-6 flex-row items-center justify-between border-t border-slate-50 pt-5">
        <View>
          <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-1">Monthly Stipend</Text>
          <Text className="text-slate-900 text-lg font-black  tracking-tighter uppercase">
            {item.isPaid ? (item.stipend.startsWith('₹') ? item.stipend : `₹${item.stipend}`) : "Voluntary"}
          </Text>
        </View>

        {!hideApply && (
          <TouchableOpacity
            onPress={() => !item.hasApplied && onApply(item)}
            activeOpacity={item.hasApplied ? 1 : 0.9}
            className={`${item.hasApplied ? 'bg-slate-100 border-slate-200' : 'bg-slate-900'} px-8 py-3.5 rounded-2xl shadow-sm shadow-black/10`}
          >
            <Text className={`${item.hasApplied ? 'text-slate-500' : 'text-white'} font-black  uppercase tracking-widest text-2xs`}>
              {item.hasApplied ? 'Registered' : 'Apply Now'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
});

const InternshipList = () => {
  const route = useRoute<any>();
  const recruiterId = route.params?.recruiterId;
  const [activeTab, setActiveTab] = useState<'all' | 'shortlisted'>('all');
  const [internships, setInternships] = useState<any[]>([]);
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
        fetchInternships(1);
      } else {
        fetchShortlisted();
      }
    }, [searchQuery, activeTab])
  );

  const fetchInternships = async (pageNum: number, term = searchQuery) => {
    if (loading) return;
    setLoading(true);

    try {
      const recruiterParam = recruiterId ? `&recruiterId=${recruiterId}` : "";
      const response = await axios.get(`/opportunity/list?type=internship&page=${pageNum}&limit=15&search=${term}${recruiterParam}`);

      if (response.data.success) {
        const newData = response.data.data || [];

        if (newData.length === 0 && pageNum === 1) {
          setInternships([]);
          setHasMore(false);
        } else if (newData.length === 0) {
          setHasMore(false);
        } else {
          setInternships((prev) => {
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
      console.error("Error fetching internships:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShortlisted = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await axios.get(`/opportunity/student/shortlisted?type=internship`);
      if (response.data.success) {
        setShortlistedItems(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching shortlisted internships:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'all' && hasMore && !loading) {
      fetchInternships(page + 1);
    }
  }, [hasMore, loading, page, activeTab]);

  const onSearchSubmit = () => {
    if (activeTab === 'all') {
      fetchInternships(1, searchQuery);
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
        setInternships(prev => prev.map(opt =>
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
    <InternshipCard item={item} onApply={handleApply} hideApply={isRecruiter} />
  ), [handleApply, isRecruiter]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return (
      <View className="py-10 items-center">
        <ActivityIndicator size="small" color="#f97316" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#f97316', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>

        {/* Arena Header */}
        <View className="px-8 pt-2">
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                  Internships <Text className="text-orange-500">Hub</Text>
                </Text>
              </View>
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Professional Opportunity Archive</Text>
            </View>
          </View>
        </View>

        {/* Arena Tabs */}
        <View className="flex-row px-8 mb-4 gap-3">
          <TouchableOpacity
            onPress={() => setActiveTab('all')}
            className={`flex-1 py-4 rounded-2xl items-center ${activeTab === 'all' ? 'bg-orange-500 border-orange-400 shadow-orange-500/20' : 'bg-white border-slate-100 shadow-black/5'}`}
          >
            <Text className={`font-black uppercase  tracking-widest text-2xs ${activeTab === 'all' ? 'text-white' : 'text-slate-500'}`}>Market Registry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('shortlisted')}
            className={`flex-1 py-4 rounded-2xl items-center ${activeTab === 'shortlisted' ? 'bg-orange-500 border-orange-400 shadow-orange-500/20' : 'bg-white border-slate-100 shadow-black/5'}`}
          >
            <Text className={`font-black uppercase  tracking-widest text-2xs ${activeTab === 'shortlisted' ? 'text-white' : 'text-slate-500'}`}>Shortlisted</Text>
          </TouchableOpacity>
        </View>

        {/* 🔍 Arena Search Dock */}
        {activeTab === 'all' && (
          <View className="px-8 mb-3">
            <View className="flex-row items-center bg-white rounded-2xl px-5 h-14 border border-slate-100 shadow-xl shadow-black/5">
              <Ionicons name="search" size={20} color="#f97316" />
              <TextInput
                placeholder="Search roles, skills, or firms..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={onSearchSubmit}
                returnKeyType="search"
                className="flex-1 ml-3 text-slate-900 text-sm font-black  uppercase tracking-tighter"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(""); fetchInternships(1, ""); }} className="bg-slate-50 p-1.5 rounded-xl">
                  <Ionicons name="close" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 📝 Technical Note */}
        {user?.user_access !== 'recruiter' && (
          <View className="mx-8 p-5 bg-white rounded-2xl border border-slate-100 flex-row items-center shadow-sm shadow-black/5">
            <View className="bg-orange-500/10 w-10 h-10 rounded-xl items-center justify-center border border-orange-500/20">
              <Ionicons name="flash" size={20} color="#f97316" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-slate-900 font-black uppercase text-2xs tracking-tight">Technical Advisory</Text>
              <Text className="text-slate-500 text-2xs font-bold leading-4 mt-0.5">
                Maintain an active Fync Portfolio. Recruitment bots prioritize synchronized profiles.
              </Text>
            </View>
          </View>
        )}

        {/* List */}
        <FlatList
          data={activeTab === 'all' ? internships : shortlistedItems}
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
              <View className="items-center mt-20 px-10">
                <View className="w-20 h-20 bg-slate-50 rounded-4xl items-center justify-center mb-6">
                  <Ionicons name={activeTab === 'all' ? "briefcase" : "star-outline"} size={40} color="#CBD5E1" />
                </View>
                <Text className="text-slate-900 font-black text-xl tracking-tight text-center uppercase">
                  {activeTab === 'all' ? "Zero Matches" : "No Shortlists"}
                </Text>
                <Text className="text-slate-500 text-center font-bold text-xs mt-2 uppercase tracking-wide">
                  {activeTab === 'all'
                    ? (searchQuery ? "No internship signals found in this sector." : "The internship vault is currently silent.")
                    : "No shortlisted internships found. Boost your portfolio to attract recruiters!"}
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
            <View className="bg-white rounded-t-5xl p-8 pb-12">
              <View className="items-center mb-6">
                <View className="w-12 h-1.5 bg-slate-100 rounded-full mb-6" />
                <Text className="text-slate-900 text-2xl font-black uppercase tracking-tighter">Review Application</Text>
                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">Check your credentials before sending</Text>
              </View>

              <View className="bg-slate-50 rounded-4xl p-8 border border-slate-100 mb-10">
                <Text className="text-orange-500 font-black uppercase text-2xs tracking-wide mb-6">Candidate Verification</Text>

                <View className="flex-row items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                  <Image source={{ uri: user?.avatar || 'https://via.placeholder.com/100' }} className="w-14 h-14 rounded-2xl bg-slate-200" />
                  <View>
                    <Text className="text-slate-900 font-black text-lg tracking-tighter uppercase ">{user?.name}</Text>
                    <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wide">{user?.username} • {user?.college || 'External Entity'}</Text>
                  </View>
                </View>

                <View className="gap-5">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="bg-white p-2 rounded-lg border border-slate-100">
                        <Ionicons name="document-text" size={16} color="#f97316" />
                      </View>
                      <Text className="text-slate-600 font-black text-2xs uppercase tracking-wide">Master Resume</Text>
                    </View>
                    <Ionicons
                      name={user?.resumeUrl ? "checkmark-circle" : "close-circle"}
                      size={22}
                      color={user?.resumeUrl ? "#10b981" : "#ef4444"}
                    />
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="bg-white p-2 rounded-lg border border-slate-100">
                        <Ionicons name="shield-checkmark" size={16} color="#f97316" />
                      </View>
                      <Text className="text-slate-600 font-black text-2xs uppercase tracking-wide">Fync Portfolio Sync</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                  </View>
                </View>

                {!user?.resumeUrl && selectedItem?.requireResume && (
                  <View className="mt-8 p-5 bg-orange-50 rounded-2xl border border-orange-100 flex-row items-center">
                    <Ionicons name="alert-circle" size={20} color="#f97316" />
                    <Text className="text-orange-700 text-2xs font-black uppercase tracking-tight flex-1 ml-4 leading-4">
                      Access Denied: Role requires validated resume. Update Registry profile.
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={() => setApplyModalVisible(false)}
                  className="flex-1 py-5 rounded-xl items-center justify-center bg-slate-100"
                >
                  <Text className="text-slate-500 font-black uppercase text-2xs">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmApplication}
                  disabled={applying || (!user?.resumeUrl && selectedItem?.requireResume)}
                  className={`flex-1 py-5 rounded-2xl items-center justify-center shadow-lg ${(!user?.resumeUrl && selectedItem?.requireResume) ? 'bg-slate-200' : 'bg-orange-500 shadow-orange-500/20'}`}
                >
                  {applying ? <ActivityIndicator color="white" /> : (
                    <Text className="text-white font-black uppercase text-xs">Confirm Application</Text>
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

export default InternshipList;
