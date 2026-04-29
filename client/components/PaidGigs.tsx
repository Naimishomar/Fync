import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, ActivityIndicator,
    Alert, RefreshControl, Image, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable, Animated,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import socket from '../utils/socket';
import moment from 'moment';

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
        <View className="bg-white mx-8 mb-6 rounded-[32px] border border-slate-100 shadow-sm shadow-black/5 overflow-hidden">
            <View className="absolute left-0 top-0 bottom-0 w-[6px] bg-pink-500" />

            <View className="p-6 pl-8">
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1 mr-4">
                        <Text className="text-zinc-900 font-black  text-lg uppercase tracking-tight leading-tight" numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text className="text-slate-400 text-[10px] mt-1 uppercase tracking-widest font-black ">
                            {moment(item.createdAt).fromNow()}
                        </Text>
                    </View>
                    {isOwner && (
                        <View className="flex-row gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                            <TouchableOpacity onPress={() => onEdit(item)} className="p-2 bg-white rounded-xl border border-slate-100">
                                <Ionicons name="pencil" size={12} color="#18181b" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => onDelete(item._id)} className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                                <Ionicons name="trash" size={12} color="#f43f5e" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View className="flex-row items-center bg-emerald-50 self-start px-3 py-1.5 rounded-xl border border-emerald-100 mb-6">
                    <Ionicons name="cash-outline" size={14} color="#10b981" />
                    <Text className="text-emerald-600 text-[10px] font-black ml-1.5 uppercase tracking-widest">
                        {item.stipend || 'Pay: Open'}
                    </Text>
                </View>

                <Text className="text-slate-600 text-sm leading-6 mb-6 font-medium ">
                    "{item.description.length > MAX_CHAR && !isExpanded
                        ? `${item.description.substring(0, MAX_CHAR)}...`
                        : item.description
                    }"
                    {item.description.length > MAX_CHAR && (
                        <Text onPress={() => setIsExpanded(!isExpanded)} className="text-pink-500 font-black ml-1 uppercase text-[10px]">
                            {isExpanded ? " Less" : " Read More"}
                        </Text>
                    )}
                </Text>

                <View className="h-[1px] bg-slate-50 w-full mb-6" />

                <View className="flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center">
                        <Image
                            source={{ uri: avatarUrl }}
                            className="w-10 h-10 rounded-2xl border border-slate-200 bg-slate-50"
                        />
                        <View className="ml-3">
                            <Text className="text-[8px] text-slate-400 uppercase tracking-widest font-black ">Poster</Text>
                            <Text className="text-zinc-900 text-xs font-black  uppercase mt-0.5 tracking-tight" numberOfLines={1}>
                                {posterName}
                            </Text>
                        </View>
                    </View>

                    {!isOwner && (
                        <View className="bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                            <Text className="text-slate-400 font-black text-[8px] uppercase tracking-widest" numberOfLines={1}>
                                {item.postedUserCollege}
                            </Text>
                        </View>
                    )}
                </View>

                {isOwner ? (
                    <TouchableOpacity
                        onPress={() => onCloseGig(item._id, 'Closed')}
                        className="w-full py-5 bg-rose-50 border border-rose-100 rounded-3xl items-center justify-center flex-row shadow-sm"
                    >
                        <Ionicons name="close-circle" size={18} color="#f43f5e" />
                        <Text className="text-rose-500 font-black text-[10px] uppercase tracking-widest ml-2 ">Terminate Gig</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={() => onMessage(item._id, item.postedBy)}
                        disabled={connectingId !== null}
                        activeOpacity={0.8}
                        className="w-full rounded-3xl overflow-hidden shadow-lg shadow-pink-500/20"
                    >
                        <LinearGradient
                            colors={['#ec4899', '#be185d']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            className="py-5 flex-row items-center justify-center"
                        >
                            {connectingId === item._id ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Ionicons name="chatbubble-ellipses" size={18} color="white" />
                                    <Text className="text-white font-black text-[10px] uppercase tracking-[2px] ml-2 ">Initiate Contact</Text>
                                </>
                            )}
                        </LinearGradient>
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
                className="bg-white mx-8 mb-6 rounded-[32px] border border-slate-100 p-8 shadow-sm shadow-black/5"
            >
                <View className="flex-row justify-between items-center mb-6">
                    <View className="h-6 bg-slate-50 rounded w-2/3" />
                    <View className="w-10 h-10 bg-slate-50 rounded-2xl" />
                </View>
                <View className="h-8 bg-slate-50 rounded-xl w-32 mb-8" />

                <View className="h-4 bg-slate-50 rounded w-full mb-3" />
                <View className="h-4 bg-slate-50 rounded w-4/5 mb-10" />

                <View className="flex-row justify-between items-center pt-6 border-t border-slate-50">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 bg-slate-50 rounded-2xl" />
                        <View className="ml-3"><View className="h-4 bg-slate-50 rounded w-20" /></View>
                    </View>
                    <View className="w-24 h-10 bg-slate-50 rounded-2xl" />
                </View>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            <View className="absolute top-0 w-full h-80 opacity-10">
                <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-8 pt-6">
                    <View className="flex-row justify-between items-center mb-8">
                        <View>
                            <Text className="text-3xl font-black  text-zinc-900 tracking-tighter uppercase leading-tight">
                                Paid <Text className="text-pink-500">Gigs</Text> 💰
                            </Text>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mt-0.5">Freelance Work Protocol</Text>
                        </View>
                        <TouchableOpacity
                            onPress={openCreateModal}
                            activeOpacity={0.8}
                            className="w-14 h-14 rounded-2xl bg-zinc-900 items-center justify-center shadow-2xl shadow-black/40"
                        >
                            <Ionicons name="add" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row bg-white p-1.5 rounded-[22px] mb-8 border border-slate-100">
                        {[
                            { key: 'college', label: 'College' },
                            { key: 'global', label: 'Global' },
                            { key: 'mine', label: 'Mine' }
                        ].map((t) => (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => setActiveTab(t.key as any)}
                                className={`flex-1 py-3.5 items-center rounded-[18px] ${activeTab === t.key ? 'bg-zinc-900' : 'bg-transparent'}`}
                            >
                                <Text className={`font-black tracking-widest text-[10px]  uppercase ${activeTab === t.key ? 'text-white' : 'text-slate-400'}`}>
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
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />}
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
                                    <ActivityIndicator size="small" color="#ec4899" />
                                </View>
                            ) : <View className="h-10" />
                        )}
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20 px-10">
                                <View className="w-20 h-20 bg-white rounded-[32px] items-center justify-center mb-6 border border-slate-100 shadow-sm">
                                    <Ionicons name="briefcase-outline" size={32} color="#CBD5E1" />
                                </View>
                                <Text className="text-zinc-400 font-black  uppercase text-xs tracking-widest text-center">No Gigs Active</Text>
                                <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center">Transmission silence detected.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            {/* CREATE / EDIT MODAL */}
            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
                <View className="flex-1 bg-[#F8FAFC]">
                    <StatusBar barStyle="dark-content" />
                    <View className="flex-row justify-between items-center px-8 py-6 border-b border-slate-100 bg-white">
                        <Text className="text-xl font-black text-zinc-900  tracking-tighter uppercase leading-tight">
                            {editMode ? 'Edit' : 'New'} <Text className="text-pink-500">Gig Protocol</Text>
                        </Text>
                        <TouchableOpacity onPress={closeModal} className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                            <Ionicons name="close" size={20} color="#18181b" />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                        <ScrollView className="p-8" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Subject Matter</Text>
                            <TextInput
                                value={title} onChangeText={setTitle}
                                placeholder="Requirement Heading"
                                placeholderTextColor="#CBD5E1"
                                className="bg-white p-5 rounded-3xl mb-6 border border-slate-100 shadow-sm text-zinc-900 font-black  uppercase text-xs"
                            />

                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Visible Radius</Text>
                            <View className="flex-row bg-white p-1.5 rounded-[22px] mb-8 border border-slate-100 shadow-sm">
                                <TouchableOpacity
                                    onPress={() => setVisibility('College')}
                                    className={`flex-1 py-3.5 items-center rounded-[18px] ${visibility === 'College' ? 'bg-zinc-900' : 'bg-transparent'}`}
                                >
                                    <Text className={`font-black tracking-widest text-[10px]  uppercase ${visibility === 'College' ? 'text-white' : 'text-slate-400'}`}>
                                        Campus Only
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setVisibility('Global')}
                                    className={`flex-1 py-3.5 items-center rounded-[18px] ${visibility === 'Global' ? 'bg-pink-500' : 'bg-transparent'}`}
                                >
                                    <Text className={`font-black tracking-widest text-[10px]  uppercase ${visibility === 'Global' ? 'text-white' : 'text-slate-400'}`}>
                                        Global Unit
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Transmission Intel</Text>
                            <TextInput
                                value={description} onChangeText={setDescription}
                                multiline numberOfLines={5} textAlignVertical="top"
                                placeholder="Establish the requirements..."
                                placeholderTextColor="#CBD5E1"
                                className="bg-white p-5 rounded-3xl mb-6 border border-slate-100 shadow-sm text-zinc-700 leading-6 min-h-[150px] font-medium text-xs "
                            />

                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Stipend Allocation</Text>
                            <TextInput
                                value={stipend} onChangeText={setStipend}
                                placeholder="Credit Amount (Optional)"
                                placeholderTextColor="#CBD5E1"
                                className="bg-white p-5 rounded-3xl mb-10 border border-slate-100 shadow-sm text-emerald-600 font-black  uppercase text-xs"
                            />

                            <TouchableOpacity
                                onPress={handleSubmit} disabled={submitting}
                                activeOpacity={0.8}
                                className={`py-5 rounded-[24px] items-center shadow-xl flex-row justify-center ${submitting ? 'bg-slate-100' : 'bg-zinc-900 shadow-black/20'}`}
                            >
                                {submitting ? <ActivityIndicator color="#ec4899" /> : (
                                    <>
                                        <Text className="text-white font-black  uppercase tracking-widest text-xs mr-3">
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