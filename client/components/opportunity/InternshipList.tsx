import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  Pressable, 
  Linking, 
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

const InternshipList = () => {
  const [internships, setInternships] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchInternships(1);
  }, []);

const fetchInternships = async (pageNum: number) => {
    if (loading) return;
    setLoading(true);

    try {
      console.log(`Fetching Internships page ${pageNum}...`);
      
      const response = await fetch(
        `https://unstop.com/api/public/opportunity/search-result?opportunity=internships&page=${pageNum}&per_page=15&oppstatus=open&quickApply=true`
      );
      
      const json = await response.json();
      const newData = json.data?.data || [];

      if (newData.length === 0) {
        setHasMore(false);
      } else {
        setInternships((prev) => {
          // 1. Combine old and new data
          const combined = [...prev, ...newData];
          
          // 2. Deduplicate using a Map (Key = ID, Value = Item)
          // This removes any duplicate IDs immediately
          const uniqueMap = new Map(combined.map(item => [item.id, item]));
          
          // 3. Convert back to array
          return Array.from(uniqueMap.values());
        });
        
        setPage(pageNum);
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

  const openLink = (slug: string) => {
    // Construct the full Unstop URL
    const url = `https://unstop.com/${slug}`;
    if (url) Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View 
      className="bg-white rounded-2xl mb-4 mx-4 p-4 border border-gray-200 shadow-sm"
    >
      <View className="flex-row gap-4">
        {/* Company Logo */}
        <View className="w-16 h-16 rounded-xl border border-gray-100 overflow-hidden bg-gray-50 items-center justify-center">
            <Image 
                source={{ uri: item.logoUrl2 || item.organisation?.logoUrl || 'https://via.placeholder.com/100' }} 
                className="w-12 h-12"
                resizeMode="contain"
            />
        </View>

        {/* Header Info */}
        <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900" numberOfLines={2}>
                {item.title}
            </Text>
            <Text className="text-sm text-gray-500 font-medium mt-1">
                {item.organisation?.name || "Unknown Company"}
            </Text>
        </View>
      </View>

      {/* Details Row */}
      <View className="mt-4 flex-row flex-wrap gap-2">
         {/* Location Badge */}
         <View className="flex-row items-center bg-gray-100 px-3 py-1.5 rounded-lg">
            <Ionicons name="location-outline" size={14} color="#4B5563" />
            <Text className="text-xs text-gray-600 ml-1 font-medium">
                {item.job_location || "Remote"}
            </Text>
         </View>

         {/* Duration Badge */}
         <View className="flex-row items-center bg-gray-100 px-3 py-1.5 rounded-lg">
            <Ionicons name="time-outline" size={14} color="#4B5563" />
            <Text className="text-xs text-gray-600 ml-1 font-medium">
                {item.duration || "Flexible"}
            </Text>
         </View>
         
         {/* Type Badge */}
         {item.filters?.map((f: any, i: number) => {
             if(f.type === 'opportunity_type') {
                 return (
                    <View key={i} className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                        <Text className="text-xs text-blue-700 font-semibold">{f.name}</Text>
                    </View>
                 )
             }
         })}
      </View>

      {/* Footer / CTA */}
      <View className="mt-4 pt-4 border-t border-gray-100 flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-gray-400 font-medium">Stipend / Salary</Text>
              <Text className="text-sm font-bold text-gray-800">
                  {item.jobDetail?.paid_unpaid === "unpaid" 
                    ? "Unpaid" 
                    : (item.payment_amount 
                        ? `₹${item.payment_amount}` 
                        : (item.jobDetail?.min_salary 
                            ? `₹${item.jobDetail.min_salary} - ₹${item.jobDetail.max_salary}/mo` 
                            : "Not Disclosed")
                      )
                  }
              </Text>
          </View>

          <Pressable className="bg-blue-600 px-5 py-2 rounded-full" 
            activeOpacity={0.9} 
            onPress={() => openLink(item.public_url)}>
                <Text className="text-white font-bold text-sm">Apply Now</Text>
          </Pressable>
      </View>

    </View>
  );

  const renderFooter = () => {
    if (!loading) return <View className="h-12" />;
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color="#4F46E5" />
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Text className="text-2xl font-bold text-gray-900 px-5 pt-5 pb-3 bg-white mb-2">
        💼 Find Internships
      </Text>
      
      <FlatList
        data={internships}
        keyExtractor={(item, index) => item.id?.toString() || `fallback-${index}`}
        renderItem={renderItem}
        
        // --- INFINITE SCROLL ---
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        
        contentContainerClassName="pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

export default InternshipList;