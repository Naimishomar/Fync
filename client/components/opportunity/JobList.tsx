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
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

// --- 1. MEMOIZED JOB CARD (Dark Theme) ---
const JobCard = memo(({ item, onPress }: { item: any; onPress: (url: string) => void }) => {
  return (
    <View className="bg-[#1e1e1e]/80 rounded-3xl mb-5 mx-5 p-5 border border-white/10 shadow-lg">
      
      {/* Header Row */}
      <View className="flex-row gap-4">
        {/* Company Logo */}
        <View className="w-16 h-16 rounded-2xl border border-white/10 overflow-hidden bg-white/5 items-center justify-center">
            <Image 
                source={{ uri: item.logoUrl2 || item.organisation?.logoUrl || 'https://via.placeholder.com/100' }} 
                className="w-12 h-12 rounded-xl"
                resizeMode="contain"
            />
        </View>

        {/* Title & Company */}
        <View className="flex-1 justify-center">
            <Text className="text-lg font-bold text-white leading-6" numberOfLines={2}>
                {item.title}
            </Text>
            <Text className="text-sm text-gray-400 font-medium mt-1">
                {item.organisation?.name || "Unknown Company"}
            </Text>
        </View>
      </View>

      {/* Tags Row */}
      <View className="mt-4 flex-row flex-wrap gap-2">
         {/* Experience */}
         <View className="flex-row items-center bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <Ionicons name="briefcase-outline" size={12} color="#9ca3af" />
            <Text className="text-xs text-gray-300 ml-1 font-medium">
                {(item.jobDetail?.min_experience === null || item.jobDetail?.max_experience === null) 
                    ? "Fresher" 
                    : `${item.jobDetail?.min_experience}-${item.jobDetail?.max_experience} Yrs`
                }
            </Text>
         </View>

         {/* Location */}
         <View className="flex-row items-center bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <Ionicons name="location-outline" size={12} color="#9ca3af" />
            <Text className="text-xs text-gray-300 ml-1 font-medium">
                {item.job_location || "Remote"}
            </Text>
         </View>
         
         {/* Type (Full Time/Contract) */}
         <View className="flex-row items-center bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/30">
            <Text className="text-xs text-indigo-300 font-bold">
                {item.jobDetail?.timing === 'full_time' ? 'Full Time' : 'Contract'}
            </Text>
         </View>
      </View>

      {/* Footer / CTA */}
      <View className="mt-5 pt-4 border-t border-white/10 flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Salary (CTC)</Text>
              <Text className="text-sm font-bold text-gray-200 mt-0.5">
                  {item.jobDetail?.paid_unpaid === "unpaid" 
                    ? "Unpaid" 
                    : (item.payment_amount 
                        ? `₹${item.payment_amount}` 
                        : (item.jobDetail?.min_salary 
                            ? `₹${item.jobDetail.min_salary} - ₹${item.jobDetail.max_salary}` 
                            : "Not Disclosed")
                      )
                  }
              </Text>
            </View>

            <TouchableOpacity 
              onPress={() => onPress(item.public_url)}
              activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#6366f1', '#a855f7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="px-6 py-2.5 rounded-full shadow-lg shadow-indigo-500/20"
                >
                    <Text className="text-white font-bold text-sm">Apply Now</Text>
                </LinearGradient>
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

  useEffect(() => {
    fetchJobs(1);
  }, []);

  const fetchJobs = async (pageNum: number) => {
    if (loading) return;
    setLoading(true);

    try {
      // Fetch from Unstop Public API
      const response = await fetch(
        `https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&page=${pageNum}&per_page=50&oppstatus=open&quickApply=true`
      );
      
      const json = await response.json();
      let rawData = json.data?.data || [];

      if (rawData.length === 0) {
        setHasMore(false);
      }

      // 🔍 Local Filtering (matches your previous logic)
      if (searchQuery.trim() !== "") {
        const lowerTerm = searchQuery.toLowerCase();
        rawData = rawData.filter((item: any) => {
           const titleMatch = item.title?.toLowerCase().includes(lowerTerm);
           const orgMatch = item.organisation?.name?.toLowerCase().includes(lowerTerm);
           const skillMatch = item.required_skills?.some((s: any) => 
              s.skill_name?.toLowerCase().includes(lowerTerm)
           );
           return titleMatch || orgMatch || skillMatch;
        });
      }

      setJobs((prev) => {
          const combined = [...prev, ...rawData];
          const uniqueMap = new Map(combined.map(item => [item.id, item]));
          return Array.from(uniqueMap.values());
      });
      
      setPage(pageNum);

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
    setJobs([]); 
    fetchJobs(1); 
  };

  const handleLinkPress = useCallback((slug: string) => {
    const url = `https://unstop.com/${slug}`;
    if (url) Linking.openURL(url);
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <JobCard item={item} onPress={handleLinkPress} />
  ), [handleLinkPress]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color="#ec4899" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-black">
      {/* 🌸 BACKGROUND 🌸 */}
      <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-50" />
      <LinearGradient 
        colors={['rgba(236, 72, 153, 0.40)', 'rgba(0,0,0,0.85)', '#000000']} 
        className="absolute w-full h-full" 
      />

      <SafeAreaView className="flex-1 px-2">
        
        {/* Header Title */}
        <View className="px-5 pt-4 pb-2">
            <Text className="text-white text-3xl font-black shadow-lg">Find Jobs 🚀</Text>
            <Text className="text-gray-300 text-sm mt-1 font-medium">
                Explore full-time roles and contracts.
            </Text>
        </View>

        {/* 🔍 Search Bar */}
        <View className="mx-5 mt-4 mb-2">
            <View className="flex-row items-center bg-[#1a1a1a]/90 rounded-2xl px-4 border border-white/10 shadow-md">
                <Ionicons name="search" size={20} color="#9ca3af" />
                <TextInput 
                    placeholder="Search jobs (e.g. SDE, Manager)..."
                    placeholderTextColor="#6b7280"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={onSearchSubmit}
                    returnKeyType="search"
                    className="flex-1 ml-3 text-white text-base font-medium"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(""); onSearchSubmit(); }}>
                        <Ionicons name="close-circle" size={20} color="#6b7280" />
                    </TouchableOpacity>
                )}
            </View>
        </View>

        {/* List */}
        <FlatList
            data={jobs}
            keyExtractor={(item, index) => item.id ? item.id.toString() : `fallback-${index}`}
            renderItem={renderItem}
            
            // Performance Props
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
                    <View className="items-center mt-20">
                        <Ionicons name="briefcase-outline" size={60} color="#333" />
                        <Text className="text-gray-500 mt-4 text-center px-10">
                            {searchQuery ? "No jobs found matching your search." : "No jobs available right now."}
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