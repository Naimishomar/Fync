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
  Alert
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

  const handleApply = async (item: any) => {
    if (user?.user_access === 'recruiter') {
      Alert.alert("Recruiter View", "You are viewing this as a recruiter. Recruiters cannot apply for their own or other's posts.");
      return;
    }

    Alert.alert(
      "Apply Now",
      `Do you want to apply for ${item.title} at ${item.company}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Apply on Fync",
          onPress: async () => {
            try {
              const res = await axios.post(`/opportunity/apply/${item._id}`);
              if (res.data.success) {
                Alert.alert("Success", "Your application has been submitted!");
              }
            } catch (error: any) {
              const msg = error.response?.data?.message || "Application failed";
              Alert.alert("Notice", msg);
            }
          }
        },
        {
          text: "External Link",
          onPress: () => {
            let url = item.applicationLink;
            if (url) {
              if (!url.startsWith('http')) url = 'https://' + url;
              Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
            }
          }
        }
      ]
    );
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
      </View>

      {/* Footer / CTA */}
      <View className="mt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-gray-600 font-black uppercase text-[8px] tracking-[2px]">
            {item.type === 'job' ? 'Annual Package' : 'Monthly Stipend'}
          </Text>
          <Text className="text-zinc-900 text-lg font-black italic mt-0.5 tracking-tighter uppercase">
            {item.isPaid ? item.stipend : "Unpaid"}
          </Text>
        </View>

        {user?.user_access !== 'recruiter' && (
          <TouchableOpacity
            onPress={() => handleApply(item)}
            activeOpacity={0.9}
            className="bg-pink-500 px-8 py-3.5 rounded-2xl shadow-lg shadow-black/20 border border-pink-300"
          >
            <Text className="text-white font-black italic uppercase tracking-widest text-[12px]">Apply Now</Text>
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

            {(user?.user_access === 'recruiter' || user?.user_access === 'admin') && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CreateOpportunity', { type: 'internship' })}
                className="bg-zinc-900 w-10 h-10 rounded-full items-center justify-center shadow-lg"
              >
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>
            )}
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
      </SafeAreaView>
    </View>
  );
};

export default InternshipList;