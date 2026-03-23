import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  Alert, RefreshControl, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';

// --- TYPES ---
interface User {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
}

interface ActivityItem {
    _id: string;
    date: string;
    time: string;
    users: any[]; 
    admin: User;
    college: string;
    comments: any[]; 
    game_name?: string;
    venue?: string;
    team_size?: number;
    gamingDate?: string;
    destination?: string;
    outingDate?: string;
}

const CollaborationScreen = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState<'games' | 'outings'>('games');
    const [data, setData] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Modals
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newName, setNewName] = useState(""); 
    const [newVenue, setNewVenue] = useState(""); 
    const [newTeamSize, setNewTeamSize] = useState(""); 
    const [newDate, setNewDate] = useState(""); 
    const [newTime, setNewTime] = useState(""); 
    const [creating, setCreating] = useState(false);

    const [commentModalVisible, setCommentModalVisible] = useState(false);
    const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
    const [commentsList, setCommentsList] = useState<any[]>([]);
    const [newCommentText, setNewCommentText] = useState("");
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const commentInputRef = useRef<TextInput>(null);

    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const endpoint = tab === 'games' ? '/collaboration/games' : '/collaboration/outings';
            const res = await axios.get(endpoint);
            if (res.data.success) {
                const rawData = tab === 'games' ? res.data.gamings : res.data.outings;
                const filtered = rawData.filter((item: ActivityItem) => {
                const eventTime =
                    item.gamingDate
                    ? new Date(item.gamingDate)
                    : item.outingDate
                    ? new Date(item.outingDate)
                    : new Date(`${item.date}T${item.time || "00:00"}`);

                return eventTime.getTime() > Date.now();
                });

                filtered.sort((a: ActivityItem, b: ActivityItem) => {
                const getTs = (item: ActivityItem) => {
                    if (item.gamingDate) return new Date(item.gamingDate).getTime();
                    if (item.outingDate) return new Date(item.outingDate).getTime();
                    return new Date(`${item.date}T${item.time || "00:00"}`).getTime();
                };
                return getTs(a) - getTs(b);
                });


                setData(filtered);
            }
        } catch (err) {
            console.log("Fetch error", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { 
        setLoading(true);
        fetchData(); 
    }, [tab]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleCreate = async () => {
        if (!newName || !newDate || !newTime) {
            Alert.alert("Error", "Please fill all required fields");
            return;
        }
        setCreating(true);
        try {
            const endpoint = tab === 'games' ? '/collaboration/add/games' : '/collaboration/add/outing';
            const payload: any = {
                date: newDate,
                time: newTime,
            };

            if (tab === 'games') {
                payload.game_name = newName;
                payload.venue = newVenue;
                payload.team_size = Number(newTeamSize);
            } else {
                payload.destination = newName;
            }

            const res = await axios.post(endpoint, payload);
            if (res.data.success) {
                Alert.alert("Success", "Activity Created!");
                setCreateModalVisible(false);
                setNewName(""); setNewVenue(""); setNewTeamSize(""); setNewDate(""); setNewTime("");
                fetchData();
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Failed to create");
        } finally {
            setCreating(false);
        }
    };

    const handleJoin = async (item: any) => {
        const isJoined = item.users?.some((u: any) => (u._id || u) === user?._id);

        try {
            const endpoint =
            tab === "games"
                ? `/collaboration/games/${item._id}/${isJoined ? "leave" : "join"}`
                : `/collaboration/outings/${item._id}/${isJoined ? "leave" : "join"}`;

            const res = await axios.post(endpoint);

            if (res.data.success) {
                fetchData();
            }
        } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Action failed");
        }
    };

    const handleOpenComments = async (id: string) => {
        setActiveActivityId(id);
        setCommentModalVisible(true);
        setCommentsLoading(true);
        setReplyingTo(null);
        try {
            const res = await axios.get(`/collaboration/${tab === 'games' ? 'games' : 'outings'}/${id}/comment`); 
            setCommentsList(res.data.comments || []);
        } catch (error) {
            console.log("Comment fetch error", error);
        } finally {
            setCommentsLoading(false);
        }
    };

    const handlePostComment = async () => {
        if (!newCommentText.trim() || !activeActivityId) return;
        try {
            const res = await axios.post(`/collaboration/${tab === 'games' ? 'games' : 'outings'}/${activeActivityId}/comment`, {
                text: newCommentText,
                parentCommentId: replyingTo?._id || null
            });
            if (res.data.success) {
                const addedComment = res.data.comment;
                if (replyingTo) {
                    setCommentsList(prev => prev.map(c => {
                        if (c._id === replyingTo._id) {
                            return { ...c, replies: [...(c.replies || []), addedComment] };
                        }
                        return c;
                    }));
                } else {
                    setCommentsList([addedComment, ...commentsList]);
                }

                setNewCommentText("");
                setReplyingTo(null);
                
                setData(prev => prev.map(item => 
                    item._id === activeActivityId 
                    ? { ...item, comments: [...(item.comments || []), addedComment] } 
                    : item
                ));
            }
        } catch (error : any) {
            Alert.alert("Error", "Failed to post comment");
        }
    };

    const handleDelete = async (item: ActivityItem) => {
    try {
        const endpoint =
        tab === "games"
            ? `/collaboration/games/${item._id}`
            : `/collaboration/outings/${item._id}`;

        Alert.alert(
        "Delete Event",
        "Are you sure you want to delete this event?",
        [
            { text: "Cancel", style: "cancel" },
            {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
                const res = await axios.post(endpoint);
                if (res.data.success) {
                fetchData();
                }
            },
            },
        ]
        );
    } catch (err: any) {
        Alert.alert("Error", err.response?.data?.message || "Delete failed");
    }
    };


    const toggleUsers = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
    };


    const renderItem = ({ item }: { item: ActivityItem }) => {
        const isJoined = item.users?.some((u: any) => (u._id || u) === user?._id);

        const dateObj = new Date(item.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
            <View className="bg-white mx-4 mb-6 rounded-3xl border border-gray-100 shadow-sm shadow-black/5 overflow-hidden">
                {/* Header */}
                <View className="p-5 flex-row justify-between items-start">
                    <View className="flex-1">
                        <Text className="text-zinc-900 text-xl font-black italic tracking-tighter mb-1">
                            {tab === 'games' ? item.game_name : item.destination}
                        </Text>
                        <View className="flex-row items-center">
                            <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
                            <Text className="text-gray-400 text-xs font-bold ml-1 uppercase tracking-wider">
                                {formattedDate} • {item.time}
                            </Text>
                        </View>
                    </View>
                    
                    {/* Admin Avatar */}
                    <View className="items-center flex-row gap-4">
                        <View className='items-center justify-center'>
                            <Image
                                source={{
                                uri:
                                    item.admin?.avatar ||
                                    `https://ui-avatars.com/api/?name=${item.admin?.username}`,
                                }}
                                className="w-10 h-10 rounded-full border border-gray-100"
                            />
                            <Text className="text-gray-400 text-[8px] font-black uppercase mt-1">
                                Host
                            </Text>
                        </View>
                        {item.admin?._id === user._id && (
                            <TouchableOpacity
                            onPress={() => handleDelete(item)}
                            className="p-2 bg-red-50 rounded-full"
                            >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Details Body */}
                <View className="px-5 pb-5">
                    <View className="flex-row items-center mb-3">
                        <Ionicons name="location" size={18} color={tab === 'games' ? '#ec4899' : '#3b82f6'} />
                        <Text className="text-zinc-600 ml-2 font-bold italic tracking-tight">
                            {tab === 'games' ? item.venue : "Trip Destination"}
                        </Text>
                    </View>
                    
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons name="account-group" size={20} color="#9ca3af" />
                        <Text className="text-gray-500 font-bold ml-2 text-xs">
                            {item.users.length} {tab === 'games' && `/ ${item.team_size}`} Participants Joined
                        </Text>
                        <TouchableOpacity onPress={() => toggleUsers(item._id)} className="ml-3 bg-gray-50 p-1 rounded-full border border-gray-100">
                            <Ionicons name={expandedId === item._id ? "chevron-up" : "chevron-down"} size={16} color="#9ca3af"/>
                        </TouchableOpacity>
                    </View>

                    {expandedId === item._id && (
                    <View className="bg-gray-50 p-4 rounded-2xl mt-4 border border-gray-100">
                        {item.users.length === 0 ? (
                        <Text className="text-gray-400 text-sm font-medium italic">
                            No participants yet. Be the first to join!
                        </Text>
                        ) : (
                        item.users.map((u: any, idx) => (
                            <View key={u._id || u || idx} className="flex-row items-center mt-2.5">
                                <Image source={{ uri:u.avatar ||`https://ui-avatars.com/api/?name=${u.username || "User"}`}} className="w-7 h-7 rounded-full mr-3 border border-white"/>
                                <Text className="text-zinc-900 text-sm font-bold italic tracking-tight">
                                    {u.name || "User"}
                                </Text>
                            </View>
                        ))
                        )}
                    </View>
                    )}
                </View>

                {/* Action Footer */}
                <View className="flex-row border-t border-gray-50">
                    <TouchableOpacity 
                        onPress={() => handleJoin(item)}
                        className={`flex-1 py-4 items-center justify-center ${isJoined ? 'bg-gray-100' : (tab === 'games' ? 'bg-pink-500' : 'bg-blue-500')}`}
                    >
                        <Text className={`font-black italic tracking-tighter uppercase ${isJoined ? 'text-gray-400' : 'text-white'}`}>
                            {isJoined ? "Leave Activity" : "Secure Spot"}
                        </Text>
                    </TouchableOpacity>
                    
                    <View className="w-[1px] bg-gray-100" />

                    <TouchableOpacity 
                        onPress={() => handleOpenComments(item._id)}
                        className="flex-1 py-4 items-center justify-center bg-white flex-row gap-2 active:bg-gray-50"
                    >
                        <Ionicons name="chatbubble-outline" size={18} color="#1A1A1A" />
                        <Text className="text-zinc-900 font-black italic tracking-tighter uppercase">Discuss ({item.comments?.length || 0})</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-6 py-5 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm">
                    <View>
                        <Text className="text-2xl font-black text-zinc-900 italic tracking-tighter">Find <Text className="text-pink-500">Teammate</Text></Text>
                        <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Collaborate & Explore</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCreateModalVisible(true)} className="bg-pink-500 p-2.5 rounded-full shadow-sm shadow-pink-500/30">
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View className="flex-row mx-6 mt-6 mb-6 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm shadow-black/5">
                    <TouchableOpacity 
                        onPress={() => setTab('games')}
                        className={`flex-1 py-3 items-center rounded-xl ${tab === 'games' ? 'bg-pink-500 shadow-sm shadow-pink-500/20' : 'bg-transparent'}`}
                    >
                        <Text className={`font-black italic tracking-tighter uppercase ${tab === 'games' ? 'text-white' : 'text-gray-400'}`}>Gaming</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setTab('outings')}
                        className={`flex-1 py-3 items-center rounded-xl ${tab === 'outings' ? 'bg-blue-500 shadow-sm shadow-blue-500/20' : 'bg-transparent'}`}
                    >
                        <Text className={`font-black italic tracking-tighter uppercase ${tab === 'outings' ? 'text-white' : 'text-gray-400'}`}>Outings</Text>
                    </TouchableOpacity>
                </View>

                {/* List */}
                {loading ? (
                    <ActivityIndicator size="large" color="#ec4899" className="mt-20" />
                ) : (
                    <FlatList
                        data={data}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />}
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20 px-10">
                                <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-6 shadow-sm border border-gray-100">
                                    <Ionicons name={tab === 'games' ? 'game-controller-outline' : 'map-outline'} size={40} color="#cbd5e1" />
                                </View>
                                <Text className="text-zinc-900 text-xl font-black italic tracking-tight">No {tab} found</Text>
                                <Text className="text-gray-500 text-sm mt-2 text-center font-medium">Be the first player to start an activity and invite the community!</Text>
                            </View>
                        }
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </SafeAreaView>

            {/* --- CREATE MODAL --- */}
            <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
                <View className="flex-1 bg-black/40 justify-end">
                    <Pressable className="flex-1" onPress={() => setCreateModalVisible(false)} />
                    <View className="bg-white rounded-t-3xl p-8 h-[85%] border-t border-gray-100 shadow-2xl">
                        <View className="w-12 h-1 bg-gray-200 rounded-full self-center mb-8" />
                        
                        <View className="flex-row justify-between items-center mb-8">
                            <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter">Host <Text className="text-pink-500">{tab === 'games' ? 'Game' : 'Outing'}</Text></Text>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)} className="p-1 bg-gray-100 rounded-full">
                                <Ionicons name="close" size={24} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-6">
                                <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3">{tab === 'games' ? "Game Title" : "Destination"}</Text>
                                <TextInput 
                                    value={newName} onChangeText={setNewName}
                                    placeholder={tab === 'games' ? "e.g. Valorant, BGMI" : "e.g. Manali Trip"} 
                                    placeholderTextColor="#9ca3af"
                                    className="bg-white text-zinc-900 p-4 rounded-xl border border-gray-100 font-bold"
                                />
                            </View>

                            <View className="flex-row gap-4 mb-6">
                                <View className="flex-1 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                                    <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3">Date</Text>
                                    <TextInput 
                                        value={newDate} onChangeText={setNewDate} placeholder="2025-12-25" placeholderTextColor="#9ca3af"
                                        className="bg-white text-zinc-900 p-4 rounded-xl border border-gray-100 font-bold"
                                    />
                                </View>
                                <View className="flex-1 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                                    <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3">Time</Text>
                                    <TextInput 
                                        value={newTime} onChangeText={setNewTime} placeholder="14:00" placeholderTextColor="#9ca3af"
                                        className="bg-white text-zinc-900 p-4 rounded-xl border border-gray-100 font-bold"
                                    />
                                </View>
                            </View>

                            {tab === 'games' && (
                                <>
                                    <View className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-6">
                                        <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3">Venue / Platform</Text>
                                        <TextInput 
                                            value={newVenue} onChangeText={setNewVenue} placeholder="Discord, Room 304, etc." placeholderTextColor="#9ca3af"
                                            className="bg-white text-zinc-900 p-4 rounded-xl border border-gray-100 font-bold"
                                        />
                                    </View>
                                    <View className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-8">
                                        <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3">Team Size (Players)</Text>
                                        <TextInput 
                                            value={newTeamSize} onChangeText={setNewTeamSize} placeholder="e.g. 5" keyboardType="numeric" placeholderTextColor="#9ca3af"
                                            className="bg-white text-zinc-900 p-4 rounded-xl border border-gray-100 font-bold"
                                        />
                                    </View>
                                </>
                            )}

                            <TouchableOpacity 
                                onPress={handleCreate} disabled={creating}
                                className={`p-5 rounded-2xl items-center shadow-lg mb-10 ${tab === 'games' ? 'bg-pink-500 shadow-pink-500/30' : 'bg-blue-500 shadow-blue-500/30'}`}
                            >
                                {creating ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-lg italic tracking-tighter uppercase">Create Activity</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* --- COMMENT MODAL --- */}
            <Modal visible={commentModalVisible} animationType="slide" transparent onRequestClose={() => setCommentModalVisible(false)}>
                <View className="flex-1 bg-black/40 justify-end">
                    <Pressable className="flex-1" onPress={() => setCommentModalVisible(false)} />
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="bg-white rounded-t-3xl h-[75%] border-t border-gray-100 shadow-2xl">
                        <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
                            <View>
                                <Text className="text-zinc-900 text-xl font-black italic tracking-tighter">Event <Text className="text-pink-500">Discussion</Text></Text>
                                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Co-ordinate with others</Text>
                            </View>
                            <TouchableOpacity onPress={() => setCommentModalVisible(false)} className="p-2 bg-gray-50 rounded-full">
                                <Ionicons name="close" size={22} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>
                        
                        {commentsLoading ? (
                            <ActivityIndicator className="mt-10" color="#ec4899" />
                        ) : (
                            <FlatList 
                                data={commentsList}
                                keyExtractor={(item) => item._id}
                                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                                ListEmptyComponent={
                                    <View className="items-center mt-20 px-10">
                                        <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4 border border-gray-100">
                                            <Ionicons name="chatbubbles-outline" size={32} color="#cbd5e1" />
                                        </View>
                                        <Text className="text-center text-zinc-900 font-black italic tracking-tighter">No discussions yet</Text>
                                        <Text className="text-center text-gray-500 text-xs mt-1 font-medium">Ask questions or start planning your strategy!</Text>
                                    </View>
                                }
                                renderItem={({item}) => (
                                    <View className="mb-6">
                                        <View className="flex-row">
                                            <Image source={{ uri: item.commentor?.avatar || `https://ui-avatars.com/api/?name=${item.commentor?.username}` }} className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100" />
                                            <View className="ml-3 flex-1 bg-gray-50 p-4 rounded-3xl rounded-tl-none border border-gray-100">
                                                <Text className="text-zinc-900 font-bold text-xs">{item.commentor?.name}</Text>
                                                <Text className="text-zinc-600 text-sm mt-1 font-medium">{item.text}</Text>
                                                <TouchableOpacity onPress={() => {
                                                    setReplyingTo(item);
                                                    setNewCommentText(`@${item.commentor.username} `);
                                                    commentInputRef.current?.focus();
                                                }} className="mt-3">
                                                    <Text className="text-pink-500 text-[10px] font-black italic tracking-widest uppercase">Reply</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        
                                        {/* Replies */}
                                        {item.replies && item.replies.map((reply: any, rIdx) => (
                                            <View key={reply._id || rIdx} className="ml-12 mt-4 flex-row">
                                                <Image source={{ uri: reply.commentor?.avatar || `https://ui-avatars.com/api/?name=${reply.commentor?.username}` }} className="w-7 h-7 rounded-full bg-gray-50 border border-gray-100" />
                                                <View className="ml-3 flex-1 bg-gray-50 p-3 rounded-2xl rounded-tl-none border border-gray-100">
                                                    <Text className="text-zinc-900 font-bold text-[10px]">{reply.commentor?.name}</Text>
                                                    <Text className="text-zinc-600 text-xs mt-1 font-medium">
                                                        {reply.replyToUser && <Text className="text-pink-500 font-black">@{reply.replyToUser.username} </Text>}
                                                        {reply.text}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            />
                        )}

                        <View className="p-5 border-t border-gray-100 bg-white pb-10 shadow-sm">
                            {replyingTo && (
                                <View className="flex-row items-center justify-between bg-gray-50 px-4 py-2 mb-3 rounded-xl border border-gray-100">
                                    <Text className="text-gray-400 text-xs font-bold italic">Replying to <Text className="text-zinc-900">@{replyingTo.commentor.username}</Text></Text>
                                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                        <Ionicons name="close-circle" size={16} color="#9ca3af" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View className="flex-row items-center">
                                <TextInput 
                                    ref={commentInputRef}
                                    value={newCommentText} onChangeText={setNewCommentText}
                                    placeholder={replyingTo ? "Write a reply..." : "Ask something..."} 
                                    placeholderTextColor="#9ca3af"
                                    className="flex-1 bg-gray-50 text-zinc-900 rounded-2xl px-5 py-4 mr-3 border border-gray-100 font-medium"
                                />
                                <TouchableOpacity onPress={handlePostComment} className="bg-pink-500 p-4 rounded-2xl shadow-sm shadow-pink-500/20">
                                    <Ionicons name="send" size={20} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
};

export default CollaborationScreen;