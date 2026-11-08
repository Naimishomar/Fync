import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import axios from '../context/axiosConfig';
import socket from '../utils/socket';
import { TeammateSkeleton } from './Skeleton';
import Avatar from './Avatar';
import { Alert } from './ui/AlertModal';
import { C } from '../constants/colors';
import { AppBar, SearchField, SegmentedTabs, Tag, IconBtn, Button, Empty } from './ui/kit';

interface UserProfile {
    _id: string;
    name: string;
    username: string;
    avatar: string;
    skills: string[];
    college: string;
    year: number;
    major: string;
    experience?: string;
    about?: string;
    github_id?: string;
    linkedIn_id?: string;
}

const openLink = (url: string | undefined) => {
    if (url) Linking.openURL(url).catch(() => Alert.alert("Error", "Invalid Link"));
};

const TABS = ['global', 'college'] as const;
const TAB_LABELS = { global: 'Global', college: 'Campus' };

/** One developer. Module scope + memo so rows update instead of remounting. */
const TeammateCard = memo(function TeammateCard({ item, connecting, busy, onOpen, onMessage }: {
    item: UserProfile; connecting: boolean; busy: boolean;
    onOpen: (u: UserProfile) => void; onMessage: (u: UserProfile) => void;
}) {
    const meta = [item.year ? `Year ${item.year}` : null, item.major].filter(Boolean).join(' · ') || 'Student';
    return (
        <View className="bg-card border border-line rounded-2xl p-4 mb-3 mx-gutter">
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <Pressable
                    className="flex-row items-center flex-1 active:opacity-70"
                    style={{ gap: 12, minWidth: 0 }}
                    onPress={() => onOpen(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, open profile`}
                >
                    <Avatar user={item} size={56} showBadge={false} />
                    <View className="flex-1" style={{ minWidth: 0 }}>
                        <Text className="text-ink text-base font-semibold" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-ink-3 text-sm font-sans" numberOfLines={1}>@{item.username}</Text>
                        <Text className="text-ink-3 text-sm font-sans" numberOfLines={1}>{meta}</Text>
                    </View>
                </Pressable>
                <View className="flex-row" style={{ marginRight: -11 }}>
                    {item.github_id ? <IconBtn name="logo-github" onPress={() => openLink(item.github_id)} accessibilityLabel="Open GitHub" /> : null}
                    {item.linkedIn_id ? <IconBtn name="logo-linkedin" color="#0077b5" onPress={() => openLink(item.linkedIn_id)} accessibilityLabel="Open LinkedIn" /> : null}
                </View>
            </View>

            {item.skills?.length ? (
                <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                    {item.skills.slice(0, 4).map((skill, i) => <Tag key={i} label={String(skill)} />)}
                    {item.skills.length > 4 ? <Tag label={`+${item.skills.length - 4}`} /> : null}
                </View>
            ) : null}

            {(item.about || item.experience) ? (
                <Text className="text-ink-2 text-sm font-sans leading-5 mt-3" numberOfLines={3}>
                    {item.about || item.experience}
                </Text>
            ) : null}

            <View className="flex-row items-center mt-4 pt-3 border-t border-line" style={{ gap: 12 }}>
                <View className="flex-row items-center flex-1" style={{ gap: 6, minWidth: 0 }}>
                    <Ionicons name="location-outline" size={14} color={C.ink3} />
                    <Text className="text-ink-3 text-sm font-sans flex-1" numberOfLines={1}>{item.college}</Text>
                </View>
                <Button small variant="solid" icon="chatbubble-outline" title="Chat" loading={connecting} disabled={busy && !connecting} onPress={() => onMessage(item)} accessibilityLabel={`Chat with ${item.name}`} />
            </View>
        </View>
    );
});

export default function FindTeammate() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'global' | 'college'>('global');
    const [developers, setDevelopers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const CURRENT_USER_ID = user?._id || user?.id;

    // 🔍 SEARCH STATE
    const [searchQuery, setSearchQuery] = useState("");

    // Track which specific user is being connected to (for the loading spinner)
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // --- FETCH DEVELOPERS ---
    // Ten at a time, appending as the list is scrolled. Page 1 replaces the list
    // so a tab switch or pull-to-refresh does not stack duplicates on top of it.
    const PAGE_SIZE = 10;

    // A tab switch fires a new page-1 fetch; the slower response of the old tab
    // must not land on top of it.
    const reqId = useRef(0);

    const fetchDevelopers = useCallback(async (pageNum = 1) => {
        const id = ++reqId.current;
        try {
            if (pageNum === 1) setLoading(true); else setLoadingMore(true);
            const response = await axios.get('/user/find-team', {
                params: { type: activeTab, page: pageNum, limit: PAGE_SIZE }
            });
            if (id !== reqId.current) return;

            if (response.data.success) {
                const batch = response.data.developers ?? [];
                setDevelopers((prev) => (pageNum === 1 ? batch : [...prev, ...batch.filter((b: UserProfile) => !prev.some((p) => p._id === b._id))]));
                const pg = response.data.pagination;
                // fall back to a short-batch check if an older server sends no
                // pagination block, so this cannot loop for ever
                setHasMore(pg ? pg.page < pg.pages : batch.length === PAGE_SIZE);
                setPage(pageNum);
            }
        } catch (error: any) {
            if (id !== reqId.current) return;
            console.error("Fetch error:", error);
            if (pageNum === 1) {
                const msg = error.response?.data?.message || "Check your internet connection.";
                Alert.alert("Error", msg);
            }
        } finally {
            if (id === reqId.current) {
                setLoading(false);
                setLoadingMore(false);
                setRefreshing(false);
            }
        }
    }, [activeTab]);

    const loadMore = useCallback(() => {
        if (loadingMore || loading || !hasMore) return;
        fetchDevelopers(page + 1);
    }, [loadingMore, loading, hasMore, page, fetchDevelopers]);

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        // Clear so the old tab's people don't sit under the new tab while it loads.
        setDevelopers([]);
        fetchDevelopers(1);
    }, [activeTab, fetchDevelopers]);

    const onRefresh = () => {
        setRefreshing(true);
        setHasMore(true);
        fetchDevelopers(1);
    };

    // --- 🔍 FILTER LOGIC ---
    const filteredDevelopers = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return developers.filter((dev) => (
            (dev.skills ?? []).some(skill => String(skill).toLowerCase().includes(query)) ||
            (dev.name ?? '').toLowerCase().includes(query) ||
            (dev.username ?? '').toLowerCase().includes(query)
        ));
    }, [developers, searchQuery]);

    const handleMessage = async (targetUser: UserProfile) => {
        if (connectingId) return;

        try {
            setConnectingId(targetUser._id);

            const response = await axios.post("/chat/start", {
                userId: targetUser._id
            });

            const conversationId = response.data?.conversation?._id;
            if (!conversationId) throw new Error("No conversation returned");

            socket.emit("join", { conversationId });

            navigation.navigate("Chat", {
                conversationId,
                otherUser: {
                    _id: targetUser._id,
                    name: targetUser.name,
                    username: targetUser.username,
                    avatar: targetUser.avatar
                }
            });
        } catch (error: any) {
            console.error("Connection Error:", error?.response?.data || error);
            Alert.alert("Error", error?.response?.data?.message || "Could not start chat");
        } finally {
            setConnectingId(null);
        }
    };


    const openProfile = useCallback((u: UserProfile) => navigation.navigate('PublicProfile', { userId: u._id }), [navigation]);
    const messageRef = useRef(handleMessage);
    messageRef.current = handleMessage;
    const onMessage = useCallback((u: UserProfile) => messageRef.current(u), []);
    const renderCard = useCallback(({ item }: { item: UserProfile }) => (
        <TeammateCard item={item} connecting={connectingId === item._id} busy={connectingId !== null} onOpen={openProfile} onMessage={onMessage} />
    ), [connectingId, openProfile, onMessage]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar title="Find teammates" onBack={() => navigation.goBack()} />

                <View className="mx-gutter mt-2 mb-3" style={{ gap: 12 }}>
                    <SearchField
                        placeholder="Search by skill, name or username"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <SegmentedTabs items={TABS} labels={TAB_LABELS} value={activeTab} onChange={setActiveTab} />
                </View>

                {loading && developers.length === 0 ? (
                    <View className="flex-1 mt-4">
                        {[1, 2, 3, 4].map(i => <TeammateSkeleton key={i} />)}
                    </View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={searchQuery.length > 0 ? filteredDevelopers : developers}
                        keyExtractor={(item) => item._id}
                        renderItem={renderCard}
                        contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} colors={[C.brand[500]]} />
                        }
                        // A local search filters what is already loaded, so paging
                        // while filtering would append rows the filter then hides.
                        onEndReached={searchQuery.length > 0 ? undefined : loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={
                            loadingMore ? <ActivityIndicator size="small" color={C.brand[500]} style={{ paddingVertical: 24 }} /> : null
                        }
                        ListEmptyComponent={
                            <Empty
                                icon="people-outline"
                                title="No one found"
                                hint={searchQuery ? "Nothing matches your search. Try another skill." : "No one is looking for a team yet."}
                            />
                        }
                    />
                )}

            </SafeAreaView>
        </View>
    );
}
