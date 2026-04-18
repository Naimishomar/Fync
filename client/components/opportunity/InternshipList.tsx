import React, { useEffect, useState, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

const InternshipList = () => {
  const [internships, setInternships] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 🔍 Search State
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [applying, setApplying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchInternships(1);
    }, [searchQuery])
  );

  const fetchInternships = async (pageNum: number, term = searchQuery) => {
    if (loading) return;
    setLoading(true);

    try {
      const response = await axios.get(`/opportunity/list?type=internship&page=${pageNum}&limit=15&search=${term}`);

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

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchInternships(page + 1);
    }
  };

  const onSearchSubmit = () => {
    setInternships([]);
    fetchInternships(1);
  };

  const handleApply = (item: any) => {
    if (user?.user_access === 'recruiter') {
      Alert.alert("Recruiter View", "You are viewing this as a recruiter. Recruiters cannot apply for their own or other's posts.");
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
  };

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

  const renderItem = ({ item }: { item: any }) => (
    <View className="bg-white rounded-2xl mb-5 mx-6 p-6 shadow-sm shadow-black/5 border border-gray-300">

      {/* Header Row */}
      <View className="flex-row gap-4 items-center">
        {/* Logo */}
        <View className="w-16 h-16 rounded-2xl border border-gray-200 overflow-hidden bg-slate-50 items-center justify-center p-2">
          <Image
            source={{ uri: item.companyLogo || 'https://via.placeholder.com/100' }}
            className="w-12 h-12 rounded-xl"
            resizeMode="contain"
          />
        </View>

        {/* Title & Company */}
        <View className="flex-1">
          <Text className="text-zinc-900 text-lg font-black italic tracking-tighter uppercase leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-gray-600 text-[10px] font-black uppercase tracking-widest mt-1">
            {item.company}
          </Text>
        </View>
      </View>

      {/* Tags Row */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        {/* Location */}
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-gray-300">
          <Ionicons name="location-sharp" size={14} color="#64748b" />
          <Text className="text-[10px] font-black uppercase tracking-tight text-slate-500 ml-1">
            {item.location}
          </Text>
        </View>

        {/* Duration */}
        <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-gray-300">
          <Ionicons name="calendar" size={14} color="#64748b" />
          <Text className="text-[10px] font-black uppercase tracking-tight text-slate-500 ml-1">
            {item.duration || "Self-Paced"}
          </Text>
        </View>

        <View className="bg-pink-50 px-3 py-1.5 rounded-xl border border-pink-100">
          <Text className="text-[10px] font-black uppercase tracking-tight text-pink-500">{item.opportunityType}</Text>
        </View>
        
        {item.experience && (
            <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-gray-300">
                <Ionicons name="school-outline" size={14} color="#64748b" />
                <Text className="text-[10px] font-black uppercase tracking-tight text-slate-500 ml-1">
                    {item.experience}
                </Text>
            </View>
        )}
      </View>

      {/* Description */}
      {item.description && (
        <View className="mt-4 bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200">
          <Text className="text-slate-400 font-black uppercase text-[8px] tracking-widest mb-2">Detailed Description</Text>
          <Text className="text-slate-600 text-[11px] leading-5">
            {item.description}
          </Text>
        </View>
      )}

      {/* Footer / CTA */}
      <View className="mt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-gray-600 font-black uppercase text-[8px] tracking-[2px]">
            {item.type === 'job' ? 'Annual Package' : 'Monthly Stipend'}
          </Text>
          <Text className="text-zinc-900 text-lg font-black italic mt-0.5 tracking-tighter uppercase">
            {item.isPaid ? (item.stipend.startsWith('₹') ? item.stipend : `₹${item.stipend}`) : "Unpaid"}
          </Text>
        </View>

        {user?.user_access !== 'recruiter' && (
          <TouchableOpacity
            onPress={() => !item.hasApplied && handleApply(item)}
            activeOpacity={item.hasApplied ? 1 : 0.9}
            className={`${item.hasApplied ? 'bg-gray-200 border-gray-300' : 'bg-pink-500 border-pink-300'} px-8 py-3.5 rounded-2xl shadow-lg shadow-black/20 border`}
          >
            <Text className={`${item.hasApplied ? 'text-gray-500' : 'text-white'} font-black italic uppercase tracking-widest text-[12px]`}>
              {item.hasApplied ? 'Applied' : 'Apply Now'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color="#ec4899" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">

        {/* Header Title */}
        <View className="px-8 pt-8 pb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 bg-pink-500 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/20">
                <Ionicons name="briefcase" size={24} color="white" />
              </View>
              <View>
                <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter uppercase">Internships</Text>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Kickstart Your Digital Career</Text>
              </View>
            </View>

          </View>
        </View>

        {/* 🔍 Search Bar */}
        <View className="px-6 mt-2 mb-4">
          <View className="flex-row items-center bg-white rounded-3xl px-6 py-2 border border-gray-300 shadow-sm shadow-black/5">
            <Ionicons name="search" size={20} color="#ec4899" />
            <TextInput
              placeholder="Search roles, companies..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={onSearchSubmit}
              returnKeyType="search"
              className="flex-1 ml-3 text-zinc-900 text-base font-black italic"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(""); fetchInternships(1, ""); }} className="bg-slate-50 p-1 rounded-full">
                <Ionicons name="close" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 📝 Important Note */}
        {user?.user_access !== 'recruiter' && (
          <View className="mx-6 mb-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex-row items-center">
            <Ionicons name="information-circle-outline" size={20} color="#6366f1" />
            <View className="ml-3 flex-1">
              <Text className="text-indigo-900 font-black uppercase text-[10px] tracking-tight">Pro Tip for Fyncers</Text>
              <Text className="text-indigo-600/80 text-[10px] font-bold leading-4 mt-0.5">
                Upload your resume in 'Edit Profile' & maintain your Fync Portfolio. Recruiters will receive both!
              </Text>
            </View>
          </View>
        )}

        {/* List */}
        <FlatList
          data={internships}
          keyExtractor={(item, index) => item._id || `fallback-${index}`}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View className="items-center mt-20 px-10">
                <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6">
                  <Ionicons name="search" size={40} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-900 font-black text-xl tracking-tight text-center uppercase">Zero Hits</Text>
                <Text className="text-slate-400 text-center font-bold text-xs mt-2 uppercase tracking-wide">
                  {searchQuery ? "We couldn't find matches for your search protocol." : "The internship vault is currently locked."}
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
                <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl">
                    <View className="items-center mb-6">
                        <View className="w-12 h-1.5 bg-slate-100 rounded-full mb-6" />
                        <Text className="text-zinc-900 text-2xl font-black italic uppercase tracking-tighter">Review Application</Text>
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Check your credentials before sending</Text>
                    </View>

                    <View className="bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-8">
                        <Text className="text-pink-500 font-black uppercase text-[10px] tracking-widest mb-4">You are applying as:</Text>
                        
                        <View className="flex-row items-center gap-4 mb-5 pb-5 border-b border-slate-100">
                             <Image source={{ uri: user?.avatar || 'https://via.placeholder.com/100' }} className="w-12 h-12 rounded-2xl" />
                             <View>
                                <Text className="text-zinc-900 font-black text-base">{user?.name}</Text>
                                <Text className="text-slate-500 text-xs font-bold">{user?.username} • {user?.college || 'No College Set'}</Text>
                             </View>
                        </View>

                        <View className="gap-4">
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="document-text-outline" size={18} color="#64748b" />
                                    <Text className="text-slate-600 font-bold text-xs uppercase">Resume Attached</Text>
                                </View>
                                <Ionicons 
                                    name={user?.resumeUrl ? "checkmark-circle" : "close-circle"} 
                                    size={20} 
                                    color={user?.resumeUrl ? "#10b981" : "#ef4444"} 
                                />
                            </View>

                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="globe-outline" size={18} color="#64748b" />
                                    <Text className="text-slate-600 font-bold text-xs uppercase">Fync Portfolio PDF</Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                            </View>
                        </View>

                        {!user?.resumeUrl && selectedItem?.requireResume && (
                            <View className="mt-4 p-4 bg-rose-50 rounded-2xl border border-rose-100 flex-row items-center">
                                <Ionicons name="warning" size={20} color="#ef4444" />
                                <Text className="text-rose-600 text-[10px] font-bold flex-1 ml-3 leading-4">
                                    This role requires a resume. Please upload one in your profile before applying.
                                </Text>
                            </View>
                        )}
                    </View>

                    <View className="flex-row gap-4">
                        <TouchableOpacity 
                            onPress={() => setApplyModalVisible(false)}
                            className="flex-1 h-16 rounded-2xl items-center justify-center bg-slate-100"
                        >
                            <Text className="text-slate-500 font-black uppercase tracking-widest text-xs">Back</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={confirmApplication}
                            disabled={applying || (!user?.resumeUrl && selectedItem?.requireResume)}
                            className={`flex-[2] h-16 rounded-2xl items-center justify-center shadow-lg shadow-pink-200 ${(!user?.resumeUrl && selectedItem?.requireResume) ? 'bg-slate-300' : 'bg-pink-500'}`}
                        >
                            {applying ? <ActivityIndicator color="white" /> : (
                                <Text className="text-white font-black italic uppercase tracking-widest text-sm">Send Application</Text>
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