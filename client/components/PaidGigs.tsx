import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, StatusBar, Animated } from 'react-native'
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import socket from '../utils/socket';
import { formatDistanceToNow } from 'date-fns';
import { Alert } from './ui/AlertModal';
import { C } from '../constants/colors';
import { AppBar, IconBtn, SegmentedTabs, Tag, Button, Empty, Sheet, FormField } from './ui/kit';

import FyncRefreshControl from './ui/FyncRefreshControl';
// --- TYPES ---
interface Gig {
    _id: string;
    title: string;
    description: string;
    stipend: string;
    postedUserCollege: string;
    status: string;
    visibility?: string;
    createdAt: string;
    postedBy: any;
}

const TABS = ['college', 'global', 'mine'] as const;
const TAB_LABELS = { college: 'College', global: 'Global', mine: 'Mine' };
const VIS = ['College', 'Global'] as const;
const VIS_LABELS = { College: 'Campus only', Global: 'Everyone' };

// Memoized at module scope so FlatList updates cards instead of remounting them.
const GigCard = React.memo(({ item, currentUser, onEdit, onDelete, onCloseGig, onMessage, connectingId }: any) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_CHAR = 150;

    const isOwner = item.postedBy?._id === currentUser?._id || item.postedBy === currentUser?._id;
    const avatarUrl = item.postedBy?.avatar || (isOwner ? currentUser?.avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.postedBy?.username || 'User')}`);
    const posterName = item.postedBy?.name || (isOwner ? currentUser?.name : 'Anonymous');
    const description: string = item.description || '';
    // formatDistanceToNow throws on an Invalid Date, which would take the whole list down.
    const created = new Date(item.createdAt);
    const postedAgo = isNaN(created.getTime()) ? '' : formatDistanceToNow(created, { addSuffix: true });
    const long = description.length > MAX_CHAR;

    return (
        <View className="bg-card mx-gutter mb-3 rounded-2xl border border-line p-4">
            <View className="flex-row items-start" style={{ gap: 8 }}>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="text-ink font-semibold text-base leading-snug" numberOfLines={2}>{item.title}</Text>
                    {postedAgo ? <Text className="text-ink-3 text-xs font-sans mt-1">{postedAgo}</Text> : null}
                </View>
                {isOwner && (
                    <View className="flex-row" style={{ marginRight: -11, marginTop: -10 }}>
                        <IconBtn name="pencil-outline" size={18} onPress={() => onEdit(item)} accessibilityLabel="Edit gig" />
                        <IconBtn name="trash-outline" size={18} color={C.danger} onPress={() => onDelete(item._id)} accessibilityLabel="Delete gig" />
                    </View>
                )}
            </View>

            <Tag icon="cash-outline" label={item.stipend || 'Pay: open'} tone={{ fg: C.success }} style={{ alignSelf: 'flex-start', marginTop: 12 }} />

            <Text className="text-ink-2 text-sm leading-6 mt-3 font-sans">
                {long && !isExpanded ? `${description.substring(0, MAX_CHAR)}...` : description}
                {long && (
                    <Text onPress={() => setIsExpanded(!isExpanded)} className="text-accent-text font-semibold" accessibilityRole="button">
                        {isExpanded ? " Show less" : " Read more"}
                    </Text>
                )}
            </Text>

            <View className="flex-row items-center mt-4 pt-3 border-t border-line" style={{ gap: 12 }}>
                <ExpoImage
                    source={{ uri: avatarUrl }}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.paper2 }}
                    cachePolicy="memory-disk"
                />
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="font-semibold text-sm text-ink" numberOfLines={1}>{posterName}</Text>
                    {!isOwner && item.postedUserCollege ? (
                        <Text className="text-ink-3 text-xs font-sans" numberOfLines={1}>{item.postedUserCollege}</Text>
                    ) : null}
                </View>
            </View>

            <View className="mt-3">
                {isOwner ? (
                    <Button block variant="tertiary" icon="close-circle-outline" title="Close gig" onPress={() => onCloseGig(item._id, 'Closed')} />
                ) : (
                    <Button
                        block
                        variant="primary"
                        icon="chatbubble-ellipses-outline"
                        title="Message poster"
                        loading={connectingId === item._id}
                        disabled={connectingId !== null && connectingId !== item._id}
                        onPress={() => onMessage(item._id, item.postedBy)}
                    />
                )}
            </View>
        </View>
    );
});

// Module-level so it keeps its identity across PaidGigs renders; defined inside
// the screen it remounted (and restarted its pulse) on every state change.
const GigSkeleton = () => {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);
    return (
        <Animated.View
            style={{ opacity: pulseAnim }}
            className="bg-card mx-gutter mb-3 rounded-2xl border border-line p-4"
        >
            <View className="flex-row justify-between items-center mb-6">
                <View className="h-6 bg-paper-2 rounded w-2/3" />
                <View className="w-10 h-10 bg-paper-2 rounded-card" />
            </View>
            <View className="h-8 bg-paper-2 rounded-xl w-32 mb-8" />

            <View className="h-4 bg-paper-2 rounded w-full mb-3" />
            <View className="h-4 bg-paper-2 rounded w-4/5 mb-10" />

            <View className="flex-row justify-between items-center pt-6 border-t border-line">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-paper-2 rounded-card" />
                    <View className="ml-3"><View className="h-4 bg-paper-2 rounded w-20" /></View>
                </View>
                <View className="w-24 h-10 bg-paper-2 rounded-card" />
            </View>
        </Animated.View>
    );
};

// =======================================================
// 2. MAIN COMPONENT (Using navigation prop, not hook)
// =======================================================
export default function PaidGigs({ navigation }: any) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'college' | 'global' | 'mine'>('college');
    const [gigs, setGigs] = useState<Gig[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);


    // Form / Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentEditId, setCurrentEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [stipend, setStipend] = useState('');
    const [visibility, setVisibility] = useState<'College' | 'Global'>('Global');
    const [submitting, setSubmitting] = useState(false);

    const [connectingId, setConnectingId] = useState<string | null>(null);

    // Tab switches overlap requests; only the latest may write. The ref also
    // stops onEndReached from fetching the same page twice before state lands.
    const reqIdRef = useRef(0);
    const inFlightRef = useRef(false);

    const fetchGigs = async (pageNum: number = 1, shouldAppend: boolean = false, showSkeleton: boolean = true) => {
        if (shouldAppend && inFlightRef.current) return;
        const id = ++reqIdRef.current;
        inFlightRef.current = true;
        if (pageNum > 1) setLoadingMore(true);
        else if (showSkeleton) setLoading(true);

        try {
            let endpoint = '';
            if (activeTab === 'college') endpoint = `/gigs?query=college&page=${pageNum}&limit=10`;
            else if (activeTab === 'global') endpoint = `/gigs?query=all&page=${pageNum}&limit=10`;
            else if (activeTab === 'mine') endpoint = `/gigs/your?page=${pageNum}&limit=10`;

            const res = await axios.get(endpoint);
            if (id !== reqIdRef.current) return;
            const resData = res.data;
            const fetchedGigs = activeTab === 'mine' ? resData.yourGigs : resData.gigs;

            if (fetchedGigs && Array.isArray(fetchedGigs)) {
                if (shouldAppend) {
                    // Deduped: a gig posted between page fetches shifts the pages and repeats a key.
                    setGigs(prev => [...prev, ...fetchedGigs.filter((g: any) => !prev.some(p => p._id === g._id))]);
                } else {
                    setGigs(fetchedGigs);
                }

                const pagination = resData.pagination;
                if (pagination) {
                    setHasMore(pagination.page < pagination.pages);
                    setPage(pagination.page);
                } else {
                    setHasMore(false);
                }
            } else {
                if (!shouldAppend) setGigs([]);
                setHasMore(false);
            }
        } catch (error: any) {
            if (id !== reqIdRef.current) return;
            if (error.response?.status === 404 && pageNum === 1) {
                setGigs([]);
                setHasMore(false);
            } else {
                console.log("Error fetching gigs", error);
            }
        } finally {
            if (id === reqIdRef.current) {
                inFlightRef.current = false;
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
        }
    };

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        fetchGigs(1, false);
    }, [activeTab]);

    const onRefresh = () => {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
        fetchGigs(1, false, false);
    };

    const handleLoadMore = () => {
        if (!loading && !loadingMore && hasMore) {
            fetchGigs(page + 1, true);
        }
    };


    const handleSubmit = async () => {
        if (!title.trim() || !description.trim()) {
            Alert.alert("Required", "Title and Description are required.");
            return;
        }

        setSubmitting(true);
        try {
            const payload = { title, description, stipend, visibility };

            if (editMode && currentEditId) {
                await axios.post(`/gigs/${currentEditId}/update`, payload);
                Alert.alert("Success", "Gig updated successfully!");
            } else {
                await axios.post('/gigs/create', payload);
                Alert.alert("Success", "Gig posted successfully!");
            }

            closeModal();
            fetchGigs(1, false, false);
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Action failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
        Alert.alert(
            "Confirm",
            `Are you sure you want to close this gig? It will be removed.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Close Gig", style: "destructive", onPress: async () => {
                        try {
                            await axios.post(`/gigs/${id}/status`, { status: newStatus });
                            setGigs(prev => prev.filter(g => g._id !== id));
                        } catch (error) {
                            Alert.alert("Error", "Could not update status.");
                        }
                    }
                }
            ]
        );
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        Alert.alert("Delete Gig", "Are you sure you want to delete this gig permanently?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        await axios.delete(`/gigs/${id}`);
                        setGigs(prev => prev.filter(g => g._id !== id));
                    } catch (error) {
                        Alert.alert("Error", "Could not delete gig.");
                    }
                }
            }
        ]);
    }, []);

    const handleMessage = useCallback(async (gigId: string, targetUser: any) => {
        if (connectingId) return;

        try {
            setConnectingId(gigId);
            const response = await axios.post("/chat/start", { userId: targetUser._id });
            const conversationId = response.data.conversation._id;

            socket.emit("join", { conversationId });

            navigation.navigate("Chat", {
                conversationId,
                otherUser: {
                    _id: targetUser._id,
                    name: targetUser.name || targetUser.username,
                    username: targetUser.username,
                    avatar: targetUser.avatar || `https://ui-avatars.com/api/?name=${targetUser.username}`
                }
            });
        } catch (error: any) {
            console.error("Connection Error:", error?.response?.data || error);
            Alert.alert("Error", error?.response?.data?.message || "Could not start chat");
        } finally {
            setConnectingId(null);
        }
    }, [connectingId, navigation]);

    const openCreateModal = () => {
        setVisibility(activeTab === 'college' ? 'College' : 'Global');
        setModalVisible(true);
    };

    const openEditModal = useCallback((gig: Gig) => {
        setTitle(gig.title);
        setDescription(gig.description);
        setStipend(gig.stipend === 'Not disclosed' ? '' : gig.stipend);
        setVisibility((gig.visibility as 'College' | 'Global') || 'Global');
        setCurrentEditId(gig._id);
        setEditMode(true);
        setModalVisible(true);
    }, []);

    const renderGig = useCallback(({ item }: { item: Gig }) => (
        <GigCard
            item={item}
            currentUser={user}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onCloseGig={handleStatusChange}
            onMessage={handleMessage}
            connectingId={connectingId}
        />
    ), [user, openEditModal, handleDelete, handleStatusChange, handleMessage, connectingId]);

    const closeModal = () => {
        setModalVisible(false);
        setEditMode(false);
        setCurrentEditId(null);
        setTitle('');
        setDescription('');
        setStipend('');
        setVisibility('Global');
    };


    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar
                    title="Paid gigs"
                    onBack={() => navigation.goBack()}
                    right={<IconBtn name="add" boxed onPress={openCreateModal} accessibilityLabel="Post a gig" />}
                />
                <View className="px-gutter mb-3">
                    <SegmentedTabs items={TABS} labels={TAB_LABELS} value={activeTab} onChange={setActiveTab} />
                </View>

                {loading && !refreshing ? (
                    <View>{[1, 2, 3].map(i => <GigSkeleton key={i} />)}</View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={gigs}
                        keyExtractor={(item) => item._id}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />}
                        contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
                        renderItem={renderGig}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={
                            loadingMore ? (
                                <View className="py-6 items-center">
                                    <ActivityIndicator size="small" color={C.brand[500]} />
                                </View>
                            ) : <View className="h-10" />
                        }
                        ListEmptyComponent={
                            <Empty icon="briefcase-outline" title="No gigs yet" hint="Tap + to post one." />
                        }
                    />
                )}
            </View>

            <Sheet
                visible={modalVisible}
                onClose={closeModal}
                title={editMode ? 'Edit gig' : 'New gig'}
                footer={
                    <Button
                        block
                        variant="primary"
                        icon={editMode ? 'checkmark-circle-outline' : 'paper-plane-outline'}
                        title={editMode ? 'Save changes' : 'Post gig'}
                        loading={submitting}
                        onPress={handleSubmit}
                    />
                }
            >
                <View style={{ gap: 16 }}>
                    <FormField label="Title" value={title} onChangeText={setTitle} placeholder="What do you need done?" />
                    <View style={{ gap: 6 }}>
                        <Text className="font-semibold text-ink-2" style={{ fontSize: 13 }}>Who can see it</Text>
                        <SegmentedTabs items={VIS} labels={VIS_LABELS} value={visibility} onChange={setVisibility} />
                    </View>
                    <FormField
                        label="Description"
                        value={description} onChangeText={setDescription}
                        multiline numberOfLines={5}
                        placeholder="Describe the work, timeline and skills needed"
                    />
                    <FormField label="Stipend" hint="Optional" value={stipend} onChangeText={setStipend} placeholder="e.g. ₹2,000" />
                </View>
            </Sheet>
        </View>
    );
}
