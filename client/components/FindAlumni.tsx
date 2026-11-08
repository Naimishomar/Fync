import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StatusBar } from "react-native";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import Avatar from "./Avatar";
import { TeammateSkeleton } from "./Skeleton";

import { RoleSticker, AppBar, IconBtn, SearchField, Chip, Sheet, Button, Empty, Tag } from './ui/kit';
import { C } from '../constants/colors';

import FyncRefreshControl from './ui/FyncRefreshControl';
/** One alumnus. Module scope + memo so FlatList rows update instead of remounting. */
const AlumniRow = memo(function AlumniRow({ item, onOpen, onChat }: { item: any; onOpen: (u: any) => void; onChat: (u: any) => void }) {
    return (
        <Pressable
            onPress={() => onOpen(item)}
            className="bg-card border border-line rounded-2xl p-4 mb-3 flex-row items-center active:opacity-85"
            style={{ gap: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, open profile`}
        >
            <Avatar user={item} size={56} />
            <View className="flex-1" style={{ minWidth: 0 }}>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Text className="font-semibold text-base text-ink" style={{ flexShrink: 1 }} numberOfLines={1}>{item.name}</Text>
                    {/* Colour is never the only signal: the ring says alumni, this says it in words. */}
                    <RoleSticker role={item.user_access ?? 'alumni'} />
                </View>
                <Text className="font-sans text-sm text-ink-3" numberOfLines={1}>@{item.username}</Text>
                {item.company ? (
                    <Text className="font-sans text-sm text-ink-2 mt-1" numberOfLines={1}>
                        {item.role} at <Text className="font-semibold text-ink">{item.company}</Text>
                    </Text>
                ) : null}
                {item.graduationYear ? <Tag icon="school-outline" label={`Batch of ${item.graduationYear}`} style={{ alignSelf: 'flex-start', marginTop: 8 }} /> : null}
            </View>
            <IconBtn name="chatbubble-outline" boxed onPress={() => onChat(item)} accessibilityLabel={`Message ${item.name}`} />
        </Pressable>
    );
});

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

    // Search-as-you-type: only the newest request may write state.
    const reqId = useRef(0);

    const fetchAlumni = async (pageNum = 1, search = "", batch = "", shouldAppend = false) => {
        const id = ++reqId.current;
        try {
            if (pageNum === 1) setLoading(true);
            else setLoadingMore(true);

            const res = await axios.get(`/user/get-alumni?page=${pageNum}&limit=10&search=${encodeURIComponent(search)}&batch=${batch}`);
            if (id !== reqId.current) return;
            if (res.data.success) {
                const newData = res.data.alumni || [];
                if (shouldAppend) {
                    // onEndReached can fire twice before loadingMore commits; dedupe so the page never repeats.
                    setAlumni(prev => { const seen = new Set(prev.map(a => a._id)); return [...prev, ...newData.filter((a: any) => !seen.has(a._id))]; });
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
            if (id === reqId.current) {
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
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
        if (!loading && !loadingMore && hasMore) {
            fetchAlumni(page + 1, debouncedSearch, selectedBatch, true);
        }
    };

    const startingChat = useRef(false);
    const startChat = async (targetUser: any) => {
        if (startingChat.current) return;
        startingChat.current = true;
        try {
            const res = await axios.post("/chat/start", { userId: targetUser._id });
            navigation.navigate("Chat", {
                conversationId: res.data.conversation._id,
                otherUser: targetUser
            });
        } catch (err) {
            console.log("Start chat error", err);
        } finally {
            startingChat.current = false;
        }
    };


    const [isFilterVisible, setIsFilterVisible] = useState(false);

    const openProfile = useCallback((u: any) => navigation.navigate("PublicProfile", { user: u }), [navigation]);
    const startChatRef = useRef(startChat);
    startChatRef.current = startChat;
    const onChat = useCallback((u: any) => startChatRef.current(u), []);
    const renderAlumniItem = useCallback(({ item }: { item: any }) => (
        <AlumniRow item={item} onOpen={openProfile} onChat={onChat} />
    ), [openProfile, onChat]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar
                    title="Campus alumni"
                    onBack={() => navigation.goBack()}
                    right={
                        <IconBtn
                            name="options-outline"
                            boxed
                            badge={selectedBatch ? 1 : undefined}
                            onPress={() => setIsFilterVisible(true)}
                            accessibilityLabel={selectedBatch ? `Filter by batch, ${selectedBatch} selected` : 'Filter by batch'}
                        />
                    }
                />
                <View className="px-gutter mb-2">
                    <SearchField
                        placeholder="Search by name, firm, or role"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <View className="px-gutter py-2">
                    <Text className="font-sans text-sm text-ink-3">
                        {alumni.length} results{selectedBatch ? ` in batch ${selectedBatch}` : ''}
                    </Text>
                </View>

                {loading && !refreshing ? (
                    <View className="flex-1 px-gutter pt-2">
                        {[1, 2, 3, 4].map(i => <TeammateSkeleton key={i} />)}
                    </View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={alumni}
                        keyExtractor={(item) => item._id}
                        renderItem={renderAlumniItem}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />
                        }
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={C.brand[500]} style={{ paddingVertical: 24 }} /> : null}
                        ListEmptyComponent={
                            <Empty
                                icon="people-outline"
                                title="No alumni found"
                                hint={searchQuery || selectedBatch ? "Nothing matches your search. Try another name or batch." : "No alumni have joined yet."}
                            />
                        }
                    />
                )}
            </View>

            <Sheet
                visible={isFilterVisible}
                onClose={() => setIsFilterVisible(false)}
                title="Filter by batch"
                footer={
                    <View className="flex-row" style={{ gap: 12 }}>
                        {selectedBatch ? (
                            <Button title="Clear" style={{ flex: 1 }} onPress={() => { setSelectedBatch(""); setIsFilterVisible(false); }} />
                        ) : null}
                        <Button title="Done" variant="primary" style={{ flex: 1 }} onPress={() => setIsFilterVisible(false)} />
                    </View>
                }
            >
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {batches.map((batch: string) => (
                        <Chip
                            key={batch || "all"}
                            label={batch === "" ? "All batches" : `Batch ${batch}`}
                            active={selectedBatch === batch}
                            onPress={() => { setSelectedBatch(batch); setIsFilterVisible(false); }}
                        />
                    ))}
                </View>
            </Sheet>
        </View>
    );
};

export default FindAlumni;
