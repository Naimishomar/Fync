import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  Alert, RefreshControl, Image, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable
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
        <View className="bg-[#1e1e1e]/80 mx-5 mb-5 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
            <View className="absolute left-0 top-0 bottom-0 w-[5px] bg-pink-500" />

            <View className="p-3 pl-6">
                <View className="flex-row justify-between items-center">
                    <Text className="text-white text-lg font-bold flex-1 pr-3 leading-6" numberOfLines={2}>
                        {item.title}
                    </Text>
                    {isOwner && (
                        <View className="flex-row gap-3 bg-black/40 p-1.5 rounded-full border border-white/5">
                            <TouchableOpacity onPress={() => onEdit(item)} className="p-1.5 bg-white/10 rounded-full">
                                <Ionicons name="pencil" size={14} color="#9ca3af" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => onDelete(item._id)} className="p-1.5 bg-red-500/20 rounded-full">
                                <Ionicons name="trash" size={14} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View className="flex-row items-center bg-green-500/10 self-start px-3 py-1.5 rounded-lg border border-green-500/20 mb-3">
                    <Ionicons name="cash-outline" size={16} color="#4ade80" />
                    <Text className="text-green-400 text-xs font-black ml-1.5 tracking-wider">
                        {item.stipend || 'Not disclosed'}
                    </Text>
                </View>

                <Text className="text-gray-300 text-sm leading-6 mb-4">
                    {item.description.length > MAX_CHAR && !isExpanded 
                        ? `${item.description.substring(0, MAX_CHAR)}...` 
                        : item.description
                    }
                    {item.description.length > MAX_CHAR && (
                        <Text onPress={() => setIsExpanded(!isExpanded)} className="text-pink-400 font-bold ml-1">
                            {isExpanded ? " Show less" : " Show more"}
                        </Text>
                    )}
                </Text>

                <View className="h-[1px] bg-white/10 w-full mb-4" />

                <View className="flex-row justify-between items-center mb-4">
                    <View className="flex-row items-center flex-1">
                        <Image 
                            source={{ uri: avatarUrl }} 
                            className="w-10 h-10 rounded-full border border-white/20 bg-gray-800" 
                        />
                        <View className="ml-3 flex-1">
                            <Text className="text-white text-sm font-bold" numberOfLines={1}>{posterName}</Text>
                            <Text className="text-gray-500 text-[10px] tracking-wider uppercase font-bold mt-0.5">
                                {moment(item.createdAt).fromNow()}
                            </Text>
                        </View>
                    </View>
                    
                    {!isOwner && (
                        <View className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg max-w-[40%]">
                            <Text className="text-gray-400 font-bold text-[9px] uppercase tracking-widest text-center" numberOfLines={1}>
                                {item.postedUserCollege}
                            </Text>
                        </View>
                    )}
                </View>

                {isOwner ? (
                    <TouchableOpacity 
                        onPress={() => onCloseGig(item._id, 'Closed')}
                        className="w-full py-3 bg-red-500/10 border border-red-500/30 rounded-xl items-center justify-center flex-row"
                    >
                        <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                        <Text className="text-red-400 font-black text-xs uppercase tracking-widest ml-2">Close Gig</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        onPress={() => onMessage(item._id, item.postedBy)} 
                        disabled={connectingId !== null}
                        className="w-full rounded-xl overflow-hidden shadow-lg shadow-pink-500/20"
                    >
                        <LinearGradient
                            colors={['#ec4899', '#be185d']} 
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            className="py-3.5 flex-row items-center justify-center"
                        >
                            {connectingId === item._id ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Ionicons name="chatbubble-ellipses" size={18} color="white" />
                                    <Text className="text-white font-black text-xs uppercase tracking-widest ml-2">Message Freelancer</Text>
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

    const fetchGigs = async () => {
        try {
            let endpoint = '';
            if (activeTab === 'college') endpoint = '/gigs?query=college';
            else if (activeTab === 'global') endpoint = '/gigs?query=all';
            else if (activeTab === 'mine') endpoint = '/gigs/your';

            const res = await axios.get(endpoint);
            if (res.data.success || res.status === 200) {
                const fetchedData = activeTab === 'mine' ? res.data.yourGigs : res.data.gigs;
                setGigs(fetchedData || []);
            }
        } catch (error: any) {
            if (error.response?.status === 404) {
                setGigs([]); 
            } else {
                console.log("Error fetching gigs", error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchGigs();
    }, [activeTab]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchGigs();
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
                { text: "Close Gig", style: "destructive", onPress: async () => {
                    try {
                        await axios.post(`/gigs/${id}/status`, { status: newStatus });
                        setGigs(prev => prev.filter(g => g._id !== id)); 
                    } catch (error) {
                        Alert.alert("Error", "Could not update status.");
                    }
                }}
            ]
        );
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        Alert.alert("Delete Gig", "Are you sure you want to delete this gig permanently?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await axios.delete(`/gigs/${id}`);
                    setGigs(prev => prev.filter(g => g._id !== id));
                } catch (error) {
                    Alert.alert("Error", "Could not delete gig.");
                }
            }}
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

    return (
        <View className="flex-1 bg-black">
            <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 flex-row justify-between items-center z-10">
                    <View>
                        <Text className="text-3xl font-black italic text-white tracking-tighter">
                            PAID <Text className="text-pink-500">GIGS</Text> 💰
                        </Text>
                        <Text className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold">Find & post freelance work</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={openCreateModal}
                        className="p-3 bg-pink-600/20 rounded-full border border-pink-500/50 shadow-lg shadow-pink-500/30"
                    >
                        <Ionicons name="add" size={24} color="#ec4899" />
                    </TouchableOpacity>
                </View>

                <View className="flex-row bg-[#2a2a2a] p-1.5 rounded-2xl mx-6 mt-2 mb-4 border border-white/10 shadow-lg">
                    {[
                        { key: 'college', label: 'College' },
                        { key: 'global', label: 'Global' },
                        { key: 'mine', label: 'My Gigs' }
                    ].map((t) => (
                        <Pressable 
                            key={t.key}
                            onPress={() => setActiveTab(t.key as any)}
                            className={`flex-1 py-3 rounded-xl items-center ${
                                activeTab === t.key ? 'bg-pink-600/20 border border-pink-500' : ''
                            }`}
                        >
                            <Text className={`font-black tracking-widest text-[10px] uppercase ${activeTab === t.key ? 'text-pink-400' : 'text-gray-500'}`}>
                                {t.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color="#ec4899" className="mt-20" />
                ) : (
                    <FlatList
                        data={gigs}
                        keyExtractor={(item) => item._id}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />}
                        contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
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
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20 opacity-50">
                                <Ionicons name="briefcase-outline" size={64} color="gray" />
                                <Text className="text-gray-400 mt-4 font-bold text-lg">No gigs available right now.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            {/* CREATE / EDIT MODAL */}
            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
                <View className="flex-1 bg-[#1e1e1e]">
                    <View className="flex-row justify-between items-center px-6 py-5 border-b border-white/10 bg-black/20">
                        <Text className="text-xl font-black text-white italic tracking-tighter">
                            {editMode ? 'EDIT' : 'NEW'} <Text className="text-pink-500">GIG</Text>
                        </Text>
                        <TouchableOpacity onPress={closeModal} className="p-1 bg-white/10 rounded-full border border-white/10">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                        <ScrollView className="p-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                            
                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Gig Title</Text>
                            <TextInput 
                                value={title} onChangeText={setTitle} 
                                placeholder="e.g. Need a React Native dev for 1 week" 
                                placeholderTextColor="#6b7280" 
                                className="bg-[#2a2a2a] p-4 rounded-2xl mb-6 border border-white/10 text-white font-bold text-base"
                            />

                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Visibility Target</Text>
                            <View className="flex-row bg-[#2a2a2a] p-1.5 rounded-2xl mb-6 border border-white/10">
                                <TouchableOpacity 
                                    onPress={() => setVisibility('College')}
                                    className={`flex-1 py-3 rounded-xl items-center ${visibility === 'College' ? 'bg-pink-600/20 border border-pink-500' : ''}`}
                                >
                                    <Text className={`font-bold text-xs uppercase tracking-widest ${visibility === 'College' ? 'text-pink-400' : 'text-gray-500'}`}>
                                        My College
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => setVisibility('Global')}
                                    className={`flex-1 py-3 rounded-xl items-center ${visibility === 'Global' ? 'bg-pink-600/20 border border-pink-500' : ''}`}
                                >
                                    <Text className={`font-bold text-xs uppercase tracking-widest ${visibility === 'Global' ? 'text-pink-400' : 'text-gray-500'}`}>
                                        Global
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Description</Text>
                            <TextInput 
                                value={description} onChangeText={setDescription} 
                                multiline numberOfLines={5} textAlignVertical="top"
                                placeholder="Explain the exact requirements, skills needed, and timeframe..." 
                                placeholderTextColor="#6b7280" 
                                className="bg-[#2a2a2a] p-4 rounded-2xl mb-6 border border-white/10 text-white font-medium min-h-[120px]"
                            />

                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Stipend / Budget (Optional)</Text>
                            <TextInput 
                                value={stipend} onChangeText={setStipend} 
                                placeholder="e.g. ₹5000, 2k-4k, or 'Negotiable'" 
                                placeholderTextColor="#6b7280" 
                                className="bg-[#2a2a2a] p-4 rounded-2xl mb-8 border border-white/10 text-green-400 font-bold"
                            />

                            <TouchableOpacity 
                                onPress={handleSubmit} disabled={submitting} 
                                className="py-5 rounded-2xl items-center shadow-lg border border-pink-500/50 bg-pink-600 flex-row justify-center mt-2"
                            >
                                {submitting ? <ActivityIndicator color="white" /> : (
                                    <>
                                        <Text className="text-white font-black text-lg tracking-widest uppercase mr-2">
                                            {editMode ? 'Save Changes' : 'Post Gig'}
                                        </Text>
                                        <Ionicons name={editMode ? "checkmark-circle" : "rocket"} size={20} color="white" />
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