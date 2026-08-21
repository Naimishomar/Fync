import React, { useState, useEffect, useCallback, useRef } from 'react';
import {View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Modal, TextInput, ScrollView, KeyboardAvoidingView, Pressable, Animated, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import socket from '../utils/socket';
import { formatDistanceToNow } from 'date-fns';
import { Alert } from './ui/AlertModal';

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

// =======================================================
// 1. EXTRACTED & MEMOIZED GIG CARD
// This prevents Reanimated and FlatList from crashing during tab switches
// =======================================================
const GigCard = React.memo(({ item, currentUser, onEdit, onDelete, onCloseGig, onMessage, connectingId }: any) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_CHAR = 150;

    const isOwner = item.postedBy?._id === currentUser?._id || item.postedBy === currentUser?._id;
    const avatarUrl = item.postedBy?.avatar || (isOwner ? currentUser?.avatar : `https://ui-avatars.com/api/?name=${item.postedBy?.username || 'User'}`);
    const posterName = item.postedBy?.name || (isOwner ? currentUser?.name : 'Anonymous');

    return (
        <View className="bg-card mx-gutter mb-6 rounded-sheet border border-line shadow-hair overflow-hidden">
            <View className="absolute left-0 top-0 bottom-0 w-[6px] bg-brand-500" />

            <View className="p-6 pl-8">
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1 mr-4">
                        <Text className="text-ink font-display text-lg uppercase leading-tight" numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text className="text-ink-3 text-label mt-1 uppercase font-display">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </Text>
                    </View>
                    {isOwner && (
                        <View className="flex-row gap-2 bg-paper-2 p-1.5 rounded-card border border-line">
                            <TouchableOpacity onPress={() => onEdit(item)} className="p-2 bg-card rounded-xl border border-line">
                                <Ionicons name="pencil" size={12} color="#12100E" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => onDelete(item._id)} className="p-2 bg-danger/10 rounded-xl border border-danger/15">
                                <Ionicons name="trash" size={12} color="#DB2777" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View className="flex-row items-center bg-success/10 self-start px-3 py-1.5 rounded-xl border border-success/15 mb-6">
                    <Ionicons name="cash-outline" size={14} color="#047857" />
                    <Text className="text-success text-label font-display ml-1.5 uppercase">
                        {item.stipend || 'Pay: Open'}
                    </Text>
                </View>

                <Text className="text-ink-2 text-sm leading-6 mb-6 font-medium">
                    "{item.description.length > MAX_CHAR && !isExpanded
                        ? `${item.description.substring(0, MAX_CHAR)}...`
                        : item.description
                    }"
                    {item.description.length > MAX_CHAR && (
                        <Text onPress={() => setIsExpanded(!isExpanded)} className="text-accent-text font-display ml-1 uppercase text-label">
                            {isExpanded ? " Less" : " Read More"}
                        </Text>
                    )}
                </Text>

                <View className="h-[1px] bg-paper-2 w-full mb-6" />

                <View className="flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center">
                        <Image
                            source={{ uri: avatarUrl }}
                            className="w-10 h-10 rounded-card border border-line bg-paper-2"
                        />
                        <View className="ml-3">
                            <Text className="text-label text-ink-3 uppercase font-display">Poster</Text>
                            <Text className="font-semibold text-base text-ink mt-0.5" numberOfLines={1}>
                                {posterName}
                            </Text>
                        </View>
                    </View>

                    {!isOwner && (
                        <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-ink-3 font-display text-label uppercase" numberOfLines={1}>
                                {item.postedUserCollege}
                            </Text>
                        </View>
                    )}
                </View>

                {isOwner ? (
                    <TouchableOpacity
                        onPress={() => onCloseGig(item._id, 'Closed')}
                        className="w-full py-5 bg-danger/10 border border-danger/15 rounded-card items-center justify-center flex-row shadow-hair"
                    >
                        <Ionicons name="close-circle" size={18} color="#DB2777" />
                        <Text className="text-danger font-display text-label uppercase ml-2">Terminate Gig</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={() => onMessage(item._id, item.postedBy)}
                        disabled={connectingId !== null}
                        activeOpacity={0.8}
                        className="w-full rounded-card overflow-hidden shadow-hair"
                    >
                        <View
                            className="py-5 flex-row items-center justify-center"
                         style={{ backgroundColor: '#F97316' }}>
                            {connectingId === item._id ? (
                                <ActivityIndicator size="small" color="#12100E" />
                            ) : (
                                <>
                                    <Ionicons name="chatbubble-ellipses" size={18} color="#12100E" />
                                    <Text className="text-ink font-display text-label uppercase ml-2">Initiate Contact</Text>
                                </>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
});

// =======================================================
// 2. MAIN COMPONENT (Using navigation prop, not hook)
// =======================================================
export default function PaidGigs({ navigation }: any) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'college' | 'global' | 'mine'>('college');
    const [gigs, setGigs] = useState<Gig[]>([]);
    const [loading, setLoading] = useState(false);
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

    const fetchGigs = async (pageNum: number = 1, shouldAppend: boolean = false) => {
        if (pageNum > 1) setLoadingMore(true);
        else if (!refreshing) setLoading(true);

        try {
            let endpoint = '';
            if (activeTab === 'college') endpoint = `/gigs?query=college&page=${pageNum}&limit=10`;
            else if (activeTab === 'global') endpoint = `/gigs?query=all&page=${pageNum}&limit=10`;
            else if (activeTab === 'mine') endpoint = `/gigs/your?page=${pageNum}&limit=10`;

            const res = await axios.get(endpoint);
            const resData = res.data;
            const fetchedGigs = activeTab === 'mine' ? resData.yourGigs : resData.gigs;

            if (fetchedGigs && Array.isArray(fetchedGigs)) {
                if (shouldAppend) {
                    setGigs(prev => [...prev, ...fetchedGigs]);
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
            if (error.response?.status === 404 && pageNum === 1) {
                setGigs([]);
                setHasMore(false);
            } else {
                console.log("Error fetching gigs", error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
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
        fetchGigs(1, false);
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
            fetchGigs();
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

    const closeModal = () => {
        setModalVisible(false);
        setEditMode(false);
        setCurrentEditId(null);
        setTitle('');
        setDescription('');
        setStipend('');
        setVisibility('Global');
    };

    const GigSkeleton = () => {
        const pulseAnim = useRef(new Animated.Value(0.3)).current;

        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <Animated.View
                style={{ opacity: pulseAnim }}
                className="bg-card mx-gutter mb-6 rounded-sheet border border-line p-card-pad shadow-hair"
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

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-gutter pt-6">
                    <View className="flex-row justify-between items-center mb-8">
                        <View>
                            <Text className="text-3xl font-display text-ink uppercase leading-tight">
                                Paid <Text className="text-accent-text">Gigs</Text>
                            </Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Freelance Work Protocol</Text>
                        </View>
                        <TouchableOpacity
                            onPress={openCreateModal}
                            activeOpacity={0.8}
                            className="w-14 h-14 bg-ink items-center justify-center border-2 border-ink rounded-md"
                        >
                            <Ionicons name="add" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row bg-card p-1.5 rounded-card mb-8 border border-line">
                        {[
                            { key: 'college', label: 'College' },
                            { key: 'global', label: 'Global' },
                            { key: 'mine', label: 'Mine' }
                        ].map((t) => (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => setActiveTab(t.key as any)}
                                className={`flex-1 py-3.5 items-center rounded-xl ${activeTab === t.key ? 'bg-ink' : 'bg-transparent'}`}
                            >
                                <Text className={`font-display text-label uppercase ${activeTab === t.key ? 'text-white' : 'text-ink-3'}`}>
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View>{[1, 2, 3].map(i => <GigSkeleton key={i} />)}</View>
                ) : (
                    <FlatList
                        data={gigs}
                        keyExtractor={(item) => item._id}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
                        contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
                        renderItem={({ item }) => (
                            <GigCard
                                item={item}
                                currentUser={user}
                                onEdit={openEditModal}
                                onDelete={handleDelete}
                                onCloseGig={handleStatusChange}
                                onMessage={handleMessage}
                                connectingId={connectingId}
                            />
                        )}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={() => (
                            loadingMore ? (
                                <View className="py-6 items-center">
                                    <ActivityIndicator size="small" color="#F97316" />
                                </View>
                            ) : <View className="h-10" />
                        )}
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20 px-gutter">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <Ionicons name="briefcase-outline" size={32} color="#C4BEB6" />
                                </View>
                                <Text className="font-semibold text-base text-ink text-center">No Gigs Active</Text>
                                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">Transmission silence detected.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            {/* CREATE / EDIT MODAL */}
            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
                <View className="flex-1 bg-paper">
                    <StatusBar barStyle="dark-content" />
                    <View className="flex-row justify-between items-center px-gutter py-6 border-b border-line bg-card">
                        <Text className="text-xl font-display text-ink uppercase leading-tight">
                            {editMode ? 'Edit' : 'New'} <Text className="text-accent-text">Gig Protocol</Text>
                        </Text>
                        <TouchableOpacity onPress={closeModal} className="bg-paper-2 p-2 rounded-card border border-line">
                            <Ionicons name="close" size={20} color="#12100E" />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAvoidingView behavior="padding" className="flex-1">
                        <ScrollView className="p-card-pad" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                            <Text className="text-ink-3 text-label font-display uppercase mb-4">Subject Matter</Text>
                            <TextInput
                                value={title} onChangeText={setTitle}
                                placeholder="Requirement Heading"
                                placeholderTextColor="#C4BEB6"
                                className="font-semibold text-base text-ink bg-card p-5 mb-6 border-[1.5px] border-ink shadow-hair rounded-md"
                            />

                            <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                              <Text className="text-ink-3 text-label font-display uppercase">Visible Radius</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <View className="flex-row bg-card p-1.5 rounded-card mb-8 border border-line shadow-hair">
                                <TouchableOpacity
                                    onPress={() => setVisibility('College')}
                                    className={`flex-1 py-3.5 items-center rounded-xl ${visibility === 'College' ? 'bg-ink' : 'bg-transparent'}`}
                                >
                                    <Text className={`font-display text-label uppercase ${visibility === 'College' ? 'text-white' : 'text-ink-3'}`}>
                                        Campus Only
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setVisibility('Global')}
                                    className={`flex-1 py-3.5 items-center rounded-xl ${visibility === 'Global' ? 'bg-brand-500' : 'bg-transparent'}`}
                                >
                                    <Text className={`font-display text-label uppercase ${visibility === 'Global' ? 'text-ink' : 'text-ink-3'}`}>
                                        Global Unit
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text className="text-ink-3 text-label font-display uppercase mb-4">Transmission Intel</Text>
                            <TextInput
                                value={description} onChangeText={setDescription}
                                multiline numberOfLines={5} textAlignVertical="top"
                                placeholder="Establish the requirements..."
                                placeholderTextColor="#C4BEB6"
                                className="bg-card p-5 mb-6 border-[1.5px] border-ink shadow-hair text-ink-2 leading-6 min-h-[150px] font-medium text-xs rounded-md"
                            />

                            <Text className="text-ink-3 text-label font-display uppercase mb-4">Stipend Allocation</Text>
                            <TextInput
                                value={stipend} onChangeText={setStipend}
                                placeholder="Credit Amount (Optional)"
                                placeholderTextColor="#C4BEB6"
                                className="bg-card p-5 mb-10 border-[1.5px] border-ink shadow-hair text-success font-display uppercase text-xs rounded-md"
                            />

                            <TouchableOpacity
                                onPress={handleSubmit} disabled={submitting}
                                activeOpacity={0.8}
                                className={`py-5 rounded-card items-center shadow-hair flex-row justify-center ${submitting ? 'bg-paper-2' : 'bg-ink '}`}
                            >
                                {submitting ? <ActivityIndicator color="#F97316" /> : (
                                    <>
                                        <Text className="text-white font-display uppercase text-xs mr-3">
                                            {editMode ? 'Sync Changes' : 'Deploy Gig'}
                                        </Text>
                                        <Ionicons name={editMode ? "checkmark-circle" : "paper-plane"} size={16} color="white" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}
