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
import { LinearGradient } from 'expo-linear-gradient';
import { TeammateSkeleton } from "./Skeleton";

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
            navigation.navigate("Chat", {
                conversationId: res.data.conversation._id,
                otherUser: targetUser
            });
        } catch (err) {
            console.log("Start chat error", err);
        }
    };

    const [isFilterVisible, setIsFilterVisible] = useState(false);

    const renderAlumniItem = ({ item }: { item: any }) => (
        <View className="bg-white rounded-xl p-3 mb-3 border border-slate-100 flex-row items-center shadow-sm shadow-black/5">
            <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item })}>
                <View className="p-1 bg-slate-50 rounded-full border border-orange-500 shadow-inner">
                    <Avatar user={item} size={62} />
                </View>
            </Pressable>

            <View className="flex-1 ml-5 pr-2">
                <Text className="text-slate-900 font-black text-base" numberOfLines={1}>{item.name}</Text>
                <Text className="text-slate-500 text-2xs font-black">@{item.username}</Text>

                <View className="flex-row items-center mt-2 bg-orange-50 self-start px-3 py-1 rounded-md border border-orange-100">
                    <MaterialCommunityIcons name="school" size={14} color="#f97316" />
                    <Text className="text-orange-500 text-2xs font-black ml-2 uppercase">
                        Batch of {item.graduationYear}
                    </Text>
                </View>

                {item.company && (
                    <View className="flex-row items-center mt-2">
                        <Ionicons name="briefcase" size={14} color="#94a3b8" />
                        <Text className="text-slate-500 text-2xs ml-2 font-bold uppercase tracking-tight" numberOfLines={1}>
                            {item.role} at <Text className="text-slate-900 font-black ">{item.company}</Text>
                        </Text>
                    </View>
                )}
            </View>

            <View className="gap-3">
                <TouchableOpacity
                    onPress={() => startChat(item)}
                    className="bg-slate-900 w-12 h-12 rounded-2xl items-center justify-center shadow-lg shadow-black/20"
                >
                    <Ionicons name="chatbubble" size={18} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => navigation.navigate("PublicProfile", { user: item })}
                    className="bg-slate-50 w-12 h-12 rounded-2xl items-center justify-center border border-slate-100"
                >
                    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                </TouchableOpacity>
            </View>
        </View>
    );

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
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-1">
                            <View className="flex-row items-center">
                                <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                                    Campus <Text className="text-orange-500">Alumni</Text>
                                </Text>
                            </View>
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Professional Alumni Registry</Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => setIsFilterVisible(true)}
                            className={`w-12 h-12 rounded-2xl items-center justify-center border ${selectedBatch ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/20' : 'bg-white border-slate-100 shadow-sm'}`}
                        >
                            <Ionicons name="options" size={22} color={selectedBatch ? "white" : "#18181b"} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 🔍 Arena Search Dock */}
                <View className="px-8 mb-2">
                    <View className="flex-row items-center bg-white rounded-2xl px-5 h-14 border border-slate-100 shadow-xl shadow-black/5">
                        <Ionicons name="search" size={20} color="#f97316" />
                        <TextInput
                            placeholder="Search by name, firm, or role..."
                            placeholderTextColor="#94a3b8"
                            className="flex-1 ml-3 text-slate-900 text-sm font-black  uppercase tracking-tighter"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")} className="bg-slate-50 p-1.5 rounded-xl">
                                <Ionicons name="close" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* 📝 Technical Stats Header */}
                <View className="px-8 py-4 flex-row items-center justify-between">
                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">
                        Network Signal • {alumni.length} results {selectedBatch && `in ${selectedBatch}`}
                    </Text>
                    <View className="h-[1px] flex-1 bg-slate-200 ml-4 opacity-30" />
                </View>

                {loading && !refreshing ? (
                    <View className="flex-1 px-6 pt-2">
                        {[1, 2, 3, 4].map(i => <TeammateSkeleton key={i} />)}
                    </View>
                ) : (
                    <FlatList
                        data={alumni}
                        keyExtractor={(item) => item._id}
                        renderItem={renderAlumniItem}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 10, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
                        }
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={() => (
                            loadingMore ? (
                                <ActivityIndicator size="small" color="#f97316" className="py-6" />
                            ) : null
                        )}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-10">
                                <View className="bg-white p-10 rounded-5xl border border-slate-100 shadow-xl shadow-black/5 items-center">
                                    <View className="w-20 h-20 bg-slate-50 rounded-4xl items-center justify-center mb-6">
                                        <MaterialCommunityIcons name="account-search-outline" size={48} color="#CBD5E1" />
                                    </View>
                                    <Text className="text-slate-900 font-black  uppercase text-xl tracking-tighter text-center">
                                        Registry Clear
                                    </Text>
                                    <Text className="text-slate-500 text-2xs mt-2 text-center font-bold uppercase tracking-wide leading-5 px-4">
                                        {searchQuery || selectedBatch ? "No signal detected matching your search protocol." : "The alumni archive is currently silent."}
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
                <View className="flex-1 justify-end bg-black/60">
                    <TouchableOpacity
                        className="flex-1"
                        activeOpacity={1}
                        onPress={() => setIsFilterVisible(false)}
                    />
                    <View className="bg-white rounded-t-5xl px-8 pt-10 pb-12 shadow-2xl border-t border-slate-100">
                        <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mb-10" />

                        <View className="flex-row items-center justify-between mb-8">
                            <Text className="text-3xl font-black tracking-tighter uppercase leading-tight text-slate-900">
                                Filter <Text className="text-orange-500">Batches</Text>
                            </Text>
                            {selectedBatch && (
                                <TouchableOpacity onPress={() => { setSelectedBatch(""); setIsFilterVisible(false); }}>
                                    <Text className="text-orange-500 font-black text-2xs uppercase tracking-wide">Wipe Filter</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-6 ml-1">Archive Search Parameters</Text>

                        <ScrollView className="max-h-[350px]" showsVerticalScrollIndicator={false}>
                            <View className="flex-row flex-wrap gap-3">
                                {batches.map((batch: string) => (
                                    <TouchableOpacity
                                        key={batch || "all"}
                                        onPress={() => {
                                            setSelectedBatch(batch);
                                            setIsFilterVisible(false);
                                        }}
                                        className={`px-6 py-4 rounded-xl ${selectedBatch === batch ? 'bg-orange-500 shadow-xl shadow-orange-500/20' : 'bg-slate-50 border-slate-100'}`}
                                    >
                                        <Text className={`font-black  text-xs uppercase tracking-tighter ${selectedBatch === batch ? 'text-white' : 'text-slate-500'}`}>
                                            {batch === "" ? "Global Archive" : `Batch ${batch}`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            onPress={() => setIsFilterVisible(false)}
                            className="bg-slate-900 mt-10 h-16 rounded-2xl items-center justify-center shadow-xl shadow-black/20"
                        >
                            <Text className="text-white font-black uppercase text-xs">Apply Filter</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default FindAlumni;
