import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View, Text, FlatList, Pressable, Image, ActivityIndicator,
    TextInput, TouchableOpacity, Dimensions, RefreshControl, StatusBar, Modal, ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import Avatar from "./Avatar";

const { width } = Dimensions.get("window");

const FindAlumni = ({ navigation }: any) => {
    const { user } = useAuth();
    const [alumni, setAlumni] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedBatch, setSelectedBatch] = useState("");
    
    // Pagination States
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Generate years dynamically from 1990 to next year
    const batches = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [""];
        for (let year = currentYear + 1; year >= 1990; year--) {
            years.push(year.toString());
        }
        return years;
    }, []);

    // Search Debounce Implementation
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 1000); // 1-second delay
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchAlumni = async (pageNum = 1, search = "", batch = "", shouldAppend = false) => {
        try {
            if (pageNum === 1) setLoading(true);
            else setLoadingMore(true);

            const res = await axios.get(`/user/get-alumni?page=${pageNum}&limit=10&search=${search}&batch=${batch}`);
            if (res.data.success) {
                const newData = res.data.alumni || [];
                if (shouldAppend) {
                    setAlumni(prev => [...prev, ...newData]);
                } else {
                    setAlumni(newData);
                }
                
                const pagination = res.data.pagination;
                if (pagination) {
                    setHasMore(pagination.page < pagination.pages);
                    setPage(pagination.page);
                } else {
                    setHasMore(false);
                }
            }
        } catch (error) {
            console.log("Error fetching alumni:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    // Trigger fetch on search or batch change
    useEffect(() => {
        fetchAlumni(1, debouncedSearch, selectedBatch, false);
    }, [debouncedSearch, selectedBatch]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAlumni(1, debouncedSearch, selectedBatch, false);
    }, [debouncedSearch, selectedBatch]);

    const loadMore = () => {
        if (!loadingMore && hasMore) {
            fetchAlumni(page + 1, debouncedSearch, selectedBatch, true);
        }
    };

    const startChat = async (targetUser: any) => {
        try {
            const res = await axios.post("/chat/start", { userId: targetUser._id });
            navigation.navigate("Chat", { conversationId: res.data.conversation._id });
        } catch (err) {
            console.log("Start chat error", err);
        }
    };

    const [isFilterVisible, setIsFilterVisible] = useState(false);

    const renderAlumniItem = ({ item }: { item: any }) => (
        <View className="bg-white rounded-[32px] p-5 mb-5 border border-gray-100 flex-row items-center shadow-sm shadow-black/5">
            <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item })}>
                <View className="p-1 bg-pink-50 rounded-full border border-pink-100">
                    <Avatar user={item} size={64} />
                </View>
            </Pressable>
            
            <View className="flex-1 ml-4 pr-2">
                <Text className="text-zinc-900 font-bold text-lg tracking-tight" numberOfLines={1}>{item.name}</Text>
                <Text className="text-gray-400 text-xs font-medium">@{item.username}</Text>
                
                <View className="flex-row items-center mt-2 bg-pink-50 self-start px-2 py-1 rounded-lg">
                    <MaterialCommunityIcons name="school" size={14} color="#ec4899" />
                    <Text className="text-pink-600 text-[10px] font-bold ml-1 uppercase letter-spacing-1">
                        Batch of {item.graduationYear}
                    </Text>
                </View>

                {item.company && (
                    <View className="flex-row items-center mt-2">
                        <Ionicons name="briefcase" size={14} color="#64748b" />
                        <Text className="text-slate-500 text-[12px] ml-1 font-medium" numberOfLines={1}>
                            {item.role} at <Text className="text-zinc-900 font-bold">{item.company}</Text>
                        </Text>
                    </View>
                )}
            </View>

            <View className="gap-3">
                <TouchableOpacity 
                    onPress={() => startChat(item)}
                    className="bg-pink-500 w-11 h-11 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/20"
                >
                    <Ionicons name="chatbubble" size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => navigation.navigate("PublicProfile", { user: item })}
                    className="bg-gray-50 w-11 h-11 rounded-2xl items-center justify-center border border-gray-100"
                >
                    <Ionicons name="chevron-forward" size={20} color="#1f2937" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-4 pb-4 bg-white border-b border-gray-100 shadow-sm shadow-black/5 w-full">
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity onPress={() => navigation.goBack()} className="bg-gray-50 p-2.5 rounded-full border border-gray-100">
                          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                      </TouchableOpacity>
                      <View>
                          <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter">CAMPUS <Text className="text-pink-500">ALUMNI</Text></Text>
                          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">{user?.college}</Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity 
                        onPress={() => setIsFilterVisible(true)}
                        className={`p-2.5 rounded-full border ${selectedBatch ? 'bg-pink-500 border-pink-500' : 'bg-white border-gray-100'}`}
                    >
                        <Ionicons name="options-outline" size={22} color={selectedBatch ? "white" : "#1f2937"} />
                    </TouchableOpacity>
                </View>

                {/* Search Bar Container */}
                <View className="px-6 pt-6 pb-2">
                    <View className="flex-row items-center bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm shadow-black/5">
                        <Ionicons name="search" size={20} color="#ec4899" />
                        <TextInput
                            placeholder="Search by name, company, or role..."
                            placeholderTextColor="#94a3b8"
                            className="flex-1 text-zinc-900 ml-3 font-bold text-[15px]"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery("")}>
                                <Ionicons name="close-circle" size={20} color="#94a3b8" />
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* Stats Header */}
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <Text className="text-slate-400 text-[11px] font-black uppercase tracking-widest">
                        Core Network • {alumni.length} results {selectedBatch && `in ${selectedBatch}`}
                    </Text>
                    <View className="h-[1px] flex-1 bg-gray-200 ml-4 opacity-50" />
                </View>

                {loading && !refreshing ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#ec4899" />
                    </View>
                ) : (
                    <FlatList
                        data={alumni}
                        keyExtractor={(item) => item._id}
                        renderItem={renderAlumniItem}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 10, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
                        }
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={() => (
                            loadingMore ? (
                                <ActivityIndicator size="small" color="#ec4899" className="py-6" />
                            ) : null
                        )}
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20">
                                <View className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm items-center">
                                    <View className="w-20 h-20 bg-pink-50 rounded-3xl items-center justify-center mb-6">
                                        <MaterialCommunityIcons name="account-search-outline" size={48} color="#ec4899" />
                                    </View>
                                    <Text className="text-zinc-900 font-black italic text-xl tracking-tight text-center">
                                        No Results Found
                                    </Text>
                                    <Text className="text-slate-500 text-sm mt-2 text-center font-medium leading-5 px-4">
                                        {searchQuery || selectedBatch ? "We couldn't find any alumni matching your current filter criteria." : "No alumni from your college have joined yet."}
                                    </Text>
                                </View>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            {/* Filter Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isFilterVisible}
                onRequestClose={() => setIsFilterVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <TouchableOpacity 
                        className="flex-1" 
                        activeOpacity={1} 
                        onPress={() => setIsFilterVisible(false)} 
                    />
                    <View className="bg-white rounded-t-[40px] px-6 pt-8 pb-12 shadow-2xl">
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-8" />
                        
                        <View className="flex-row items-center justify-between mb-8">
                            <Text className="text-2xl font-black italic tracking-tighter text-zinc-900">
                                Filter <Text className="text-pink-500">Batches</Text>
                            </Text>
                            {selectedBatch && (
                                <TouchableOpacity onPress={() => { setSelectedBatch(""); setIsFilterVisible(false); }}>
                                    <Text className="text-pink-500 font-bold text-xs uppercase tracking-widest">Clear All</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <Text className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-4 ml-1">Select Graduation Year</Text>
                        
                        <ScrollView className="max-h-[350px]" showsVerticalScrollIndicator={false}>
                            <View className="flex-row flex-wrap gap-3">
                                {batches.map((batch: string) => (
                                    <TouchableOpacity
                                        key={batch || "all"}
                                        onPress={() => {
                                            setSelectedBatch(batch);
                                            setIsFilterVisible(false);
                                        }}
                                        className={`px-6 py-3.5 rounded-2xl border ${selectedBatch === batch ? 'bg-pink-500 border-pink-500 shadow-lg shadow-pink-500/20' : 'bg-gray-50 border-gray-100'}`}
                                    >
                                        <Text className={`font-black italic text-[13px] uppercase tracking-tighter ${selectedBatch === batch ? 'text-white' : 'text-zinc-600'}`}>
                                            {batch === "" ? "All Batches" : `Batch ${batch}`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <TouchableOpacity 
                            onPress={() => setIsFilterVisible(false)}
                            className="bg-zinc-900 mt-10 py-5 rounded-[24px] items-center justify-center shadow-xl shadow-black/20"
                        >
                            <Text className="text-white font-black italic uppercase tracking-tight text-base">Close Filters</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default FindAlumni;
