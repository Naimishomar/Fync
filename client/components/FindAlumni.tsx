import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View, Text, FlatList, Pressable, Image, ActivityIndicator,
    TextInput, TouchableOpacity, Dimensions, RefreshControl, StatusBar, Modal, ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import Avatar from "./Avatar";
import { TeammateSkeleton } from "./Skeleton";

import { RoleSticker } from './ui/kit';
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

    const renderAlumniItem = ({ item, index }: { item: any; index: number }) => (
        <View
            className={`bg-card rounded-card p-card-pad mb-3 flex-row items-center ${index === 0 ? 'border-2 border-ink' : 'border border-line'}`}
            style={index === 0 ? { shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 } : undefined}
        >
            <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item })}>
                <View className="p-0.5 rounded-full">
                    <Avatar user={item} size={62} />
                </View>
            </Pressable>

            <View className="flex-1 ml-5 pr-2">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="font-semibold text-lg text-ink" numberOfLines={1}>{item.name}</Text>
                  {/* Colour is never the only signal: the ring says alumni, this
                      says it in words. */}
                  <RoleSticker role={item.user_access ?? 'alumni'} />
                </View>
                <Text className="font-sans text-sm text-ink-3">@{item.username}</Text>

                <View className="flex-row items-center mt-2 bg-paper-2 self-start px-2.5 rounded-full border border-line" style={{ minHeight: 28 }}>
                    <MaterialCommunityIcons name="school" size={14} color="#F97316" />
                    <Text className="font-medium text-label text-brand-700 ml-1.5">
                        Batch of {item.graduationYear}
                    </Text>
                </View>

                {item.company && (
                    <View className="flex-row items-center mt-2">
                        <Ionicons name="briefcase" size={14} color="#8B857E" />
                        <Text className="text-ink-3 text-label ml-2 font-semibold uppercase" numberOfLines={1}>
                            {item.role} at <Text className="text-ink font-display">{item.company}</Text>
                        </Text>
                    </View>
                )}
            </View>

            <View className="gap-3">
                <TouchableOpacity
                    onPress={() => startChat(item)}
                    className="bg-ink w-12 h-12 rounded-card items-center justify-center shadow-hair"
                >
                    <Ionicons name="chatbubble" size={18} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => navigation.navigate("PublicProfile", { user: item })}
                    className="bg-paper-2 w-12 h-12 rounded-card items-center justify-center border border-line"
                >
                    <Ionicons name="chevron-forward" size={18} color="#8B857E" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION */}

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Arena Header */}
                <View className="px-gutter pt-2">
                    <View className="flex-row items-center justify-between mb-4">
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
                                <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Campus</Text>
                                <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Alumni</Text>
                            </View>
                            <Text className="text-ink-3 text-label font-display uppercase">Professional Alumni Registry</Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => setIsFilterVisible(true)}
                            className={`w-12 h-12 rounded-card items-center justify-center border ${selectedBatch ? 'bg-brand-500 border-brand-400 shadow-hair ' : 'bg-card border-line shadow-hair'}`}
                        >
                            <Ionicons name="options" size={22} color={selectedBatch ? "white" : "#12100E"} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 🔍 Arena Search Dock */}
                <View className="px-gutter mb-2">
                    <View className="flex-row items-center bg-card px-5 h-14 border-2 border-ink shadow-hair rounded-md">
                        <Ionicons name="search" size={20} color="#F97316" />
                        <TextInput
                            placeholder="Search by name, firm, or role..."
                            placeholderTextColor="#8B857E"
                            className="flex-1 ml-3 text-ink text-sm font-display uppercase"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")} className="bg-paper-2 p-1.5 rounded-xl">
                                <Ionicons name="close" size={16} color="#8B857E" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* 📝 Technical Stats Header */}
                <View className="px-gutter py-4 flex-row items-center justify-between">
                    <Text className="text-ink-3 text-label font-display uppercase">
                        Network Signal • {alumni.length} results {selectedBatch && `in ${selectedBatch}`}
                    </Text>
                    <View className="h-[1px] flex-1 bg-paper-2 ml-4 opacity-30" />
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
                        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
                        }
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={() => (
                            loadingMore ? (
                                <ActivityIndicator size="small" color="#F97316" className="py-6" />
                            ) : null
                        )}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-gutter">
                                <View className="bg-card p-card-pad rounded-sheet border border-line shadow-hair items-center">
                                    <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                        <MaterialCommunityIcons name="account-search-outline" size={48} color="#C4BEB6" />
                                    </View>
                                    <Text className="text-ink font-display uppercase text-xl text-center">
                                        Registry Clear
                                    </Text>
                                    <Text className="font-sans text-sm text-ink-3 mt-2 text-center px-4">
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
                    <View className="bg-paper rounded-t-sheet px-gutter pt-10 pb-12 shadow-hair border-t border-line">
                        <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mb-10" />

                        <View className="flex-row items-center justify-between mb-8">
                            <Text className="font-display uppercase text-ink text-h1">
                                Filter <Text className="text-accent-text">Batches</Text>
                            </Text>
                            {selectedBatch && (
                                <TouchableOpacity onPress={() => { setSelectedBatch(""); setIsFilterVisible(false); }}>
                                    <Text className="text-accent-text font-display text-label uppercase">Wipe Filter</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View className="flex-row items-center mt-6 mb-6" style={{ gap: 12 }}>
                          <Text className="text-ink-3 text-label font-display uppercase">Archive Search Parameters</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>

                        <ScrollView className="max-h-[350px]" showsVerticalScrollIndicator={false}>
                            <View className="flex-row flex-wrap gap-3">
                                {batches.map((batch: string) => (
                                    <TouchableOpacity
                                        key={batch || "all"}
                                        onPress={() => {
                                            setSelectedBatch(batch);
                                            setIsFilterVisible(false);
                                        }}
                                        className={`px-6 py-4 rounded-xl ${selectedBatch === batch ? 'bg-brand-500 shadow-hair ' : 'bg-paper-2 border-line'}`}
                                    >
                                        <Text className={`font-display text-sm uppercase ${selectedBatch === batch ? 'text-ink' : 'text-ink-3'}`}>
                                            {batch === "" ? "Global Archive" : `Batch ${batch}`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            onPress={() => setIsFilterVisible(false)}
                            className="bg-ink mt-10 h-16 rounded-card items-center justify-center shadow-hair"
                        >
                            <Text className="text-white font-display uppercase text-xs">Apply Filter</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default FindAlumni;
