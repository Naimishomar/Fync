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
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

// --- 1. MEMOIZED JOB CARD (Dark Theme) ---
const JobCard = memo(({ item, onPress }: { item: any; onPress: (url: string) => void }) => {
  return (
    <View className="bg-white rounded-2xl mb-5 mx-6 p-6 shadow-sm shadow-black/5 border border-gray-300">
      
      {/* Header Row */}
      <View className="flex-row gap-4 items-center">
        {/* Company Logo */}
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
         {/* Experience */}
         <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Ionicons name="briefcase" size={14} color="#64748b" />
            <Text className="text-[10px] font-black uppercase tracking-tight text-slate-500 ml-1">
                {item.duration || "Experience Needed"}
            </Text>
         </View>

         {/* Location */}
         <View className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Ionicons name="location-sharp" size={14} color="#64748b" />
            <Text className="text-[10px] font-black uppercase tracking-tight text-slate-500 ml-1">
                {item.location}
            </Text>
         </View>
         
         <View className="flex-row items-center bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
            <Text className="text-[10px] text-blue-500 font-black uppercase tracking-tight">
                {item.opportunityType}
            </Text>
         </View>
      </View>

       {/* Footer / CTA */}
      <View className="mt-4 flex-row items-center justify-between">
            <View>
              <Text className="text-gray-600 font-black uppercase text-[8px] tracking-[2px]">Annual Package</Text>
              <Text className="text-zinc-900 text-lg font-black italic mt-0.5 tracking-tighter uppercase">
                  {item.stipend}
              </Text>
            </View>

            <TouchableOpacity 
              onPress={() => onPress(item.applicationLink)}
              activeOpacity={0.9}
              className="bg-pink-500 px-8 py-3.5 rounded-2xl shadow-lg shadow-black/20"
            >
                <Text className="text-white font-black italic uppercase tracking-widest text-[12px]">Apply Now</Text>
            </TouchableOpacity>
      </View>

    </View>
  );
});

const JobList = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  useFocusEffect(
    useCallback(() => {
      fetchJobs(1);
    }, [searchQuery])
  );

  const fetchJobs = async (pageNum: number, term = searchQuery) => {
    if (loading) return;
    setLoading(true);

    try {
      const response = await axios.get(`/opportunity/list?type=job&page=${pageNum}&limit=15&search=${term}`);
      
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

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchJobs(page + 1);
    }
  }, [hasMore, loading, page]);

  const onSearchSubmit = () => {
    fetchJobs(1, searchQuery);
  };

  const handleLinkPress = useCallback((url: string) => {
    if (url) {
        if (!url.startsWith('http')) url = 'https://' + url;
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <JobCard item={item} onPress={handleLinkPress} />
  ), [handleLinkPress]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return (
      <View className="py-10 items-center">
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
                        <Ionicons name="megaphone" size={24} color="white" />
                    </View>
                    <View>
                        <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter uppercase">Find Jobs</Text>
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Scale Your Professional Impact</Text>
                    </View>
                </View>

                {(user?.user_access === 'recruiter' || user?.user_access === 'admin') && (
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('CreateOpportunity', { type: 'job' })}
                        className="bg-zinc-900 w-10 h-10 rounded-full items-center justify-center shadow-lg"
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                )}
            </View>
        </View>

        {/* 🔍 Search Bar */}
        <View className="px-6 mt-4 mb-4">
            <View className="flex-row items-center bg-white rounded-3xl px-6 py-2 border border-gray-300 shadow-sm shadow-black/5">
                <Ionicons name="search" size={20} color="#ec4899" />
                <TextInput 
                    placeholder="Search by role, skill, company..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={onSearchSubmit}
                    returnKeyType="search"
                    className="flex-1 ml-3 text-zinc-900 text-base font-black italic"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(""); fetchJobs(1, ""); }} className="bg-slate-50 p-1 rounded-full">
                        <Ionicons name="close" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>
        </View>

        {/* List */}
        <FlatList
            data={jobs}
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
                        <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6">
                            <Ionicons name="briefcase" size={40} color="#CBD5E1" />
                        </View>
                        <Text className="text-zinc-900 font-black text-xl tracking-tight text-center uppercase">Zero Matches</Text>
                        <Text className="text-slate-400 text-center font-bold text-xs mt-2 uppercase tracking-wide">
                            {searchQuery ? "No job signals found in this sector." : "The career portal is currently silent."}
                        </Text>
                    </View>
                ) : null
            }
        />
      </SafeAreaView>
    </View>
  );
};

export default JobList;