import React, { useEffect, useState, useCallback, memo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  Pressable, 
  Linking,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

// --- 1. SEPARATE & MEMOIZE JOB CARD ---
// This prevents the whole list from re-rendering when you search or load more.
const JobCard = memo(({ item, onPress }: { item: any; onPress: (url: string) => void }) => {
  return (
    <View className="bg-white rounded-2xl mb-4 mx-4 p-4 border border-gray-200 shadow-sm">
      <View className="flex-row gap-4">
        {/* Company Logo */}
        <View className="w-16 h-16 rounded-xl border border-gray-100 overflow-hidden bg-gray-50 items-center justify-center">
            <Image 
                source={{ uri: item.logoUrl2 || item.organisation?.logoUrl || 'https://via.placeholder.com/100' }} 
                className="w-12 h-12 rounded-md"
                resizeMode="contain"
            />
        </View>
        <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900" numberOfLines={2}>{item.title}</Text>
            <Text className="text-sm text-gray-500 font-medium mt-1">
                {item.organisation?.name || "Unknown Company"}
            </Text>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2">
         <View className="flex-row items-center bg-gray-100 px-2 py-1 rounded-md">
            <Ionicons name="briefcase-outline" size={12} color="#4B5563" />
            <Text className="text-xs text-gray-600 ml-1 font-medium">
                {(item.jobDetail?.min_experience === null || item.jobDetail?.max_experience === null) 
                    ? "Fresher" 
                    : `${item.jobDetail?.min_experience}-${item.jobDetail?.max_experience} Years`
                }
            </Text>
         </View>
         <View className="flex-row items-center bg-gray-100 px-2 py-1 rounded-md">
            <Ionicons name="location-outline" size={12} color="#4B5563" />
            <Text className="text-xs text-gray-600 ml-1 font-medium">{item.job_location || "Remote"}</Text>
         </View>
         <View className="flex-row items-center bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
             <Text className="text-xs text-purple-700 font-medium">
                {item.jobDetail?.timing === 'full_time' ? 'Full Time' : 'Contract'}
             </Text>
         </View>
      </View>

      <View className="mt-4 pt-4 border-t border-gray-100 flex-row items-center justify-between">
          <View>
              <Text className="text-xs text-gray-400 font-medium">Salary (CTC)</Text>
              <Text className="text-sm font-bold text-gray-800">
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

          <Pressable 
            className="bg-blue-600 px-5 py-2 rounded-full" 
            activeOpacity={0.9} 
            onPress={() => onPress(item.public_url)}
          >
              <Text className="text-white font-bold text-sm">Apply Now</Text>
          </Pressable>
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
      console.log(`Fetching Jobs page ${pageNum}...`);
      
      const response = await fetch(
        `https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&page=${pageNum}&per_page=50&oppstatus=open&quickApply=true`
      );
      
      const json = await response.json();
      let rawData = json.data?.data || [];

      if (rawData.length === 0) {
        setHasMore(false);
      }

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

  // --- 2. MEMOIZED RENDER ITEM ---
  const renderItem = useCallback(({ item }: { item: any }) => (
    <JobCard item={item} onPress={handleLinkPress} />
  ), [handleLinkPress]);

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return <View className="py-6 items-center"><ActivityIndicator size="small" color="#4F46E5" /></View>;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      
      <View className="bg-white px-4 pt-4 pb-4 border-b border-gray-100 z-10 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 mb-4">🚀 Find Jobs</Text>
        
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput 
                placeholder="Search jobs (e.g. SDE, Manager)..." 
                className="flex-1 ml-2 text-gray-800 font-medium"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={onSearchSubmit}
                returnKeyType="search"
            />
        </View>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item, index) => item.id ? item.id.toString() : `fallback-${index}`}
        renderItem={renderItem}
        
        // --- 3. PERFORMANCE OPTIMIZATIONS ---
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true} 
        updateCellsBatchingPeriod={50}

        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        contentContainerClassName="pt-4 pb-10"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
            !loading ? (
                <View className="items-center justify-center mt-20">
                    <Ionicons name="briefcase-outline" size={48} color="#D1D5DB" />
                    <Text className="text-gray-500 mt-4 text-lg">No jobs found.</Text>
                    <Text className="text-gray-400 text-sm">Try a different search term.</Text>
                </View>
            ) : null
        }
      />
    </SafeAreaView>
  );
};

export default JobList;