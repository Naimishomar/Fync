import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  Alert, RefreshControl, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable
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

                console.log("RAW:", rawData.length);
                console.log("FILTERED:", filtered.length);

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
                // Reset Form
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
        // FIXED: Check object IDs because users array is populated
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
        try {
            const item = data.find(i => i._id === id);
            if (item && item.comments) {
                setCommentsList(item.comments); 
            } else {
                const type = tab === 'games' ? 'games' : 'outings';
                const res = await axios.get(`/collaboration/${type}/comment/all/${id}`); 
                setCommentsList(res.data.comments || []);
            }
        } catch (error) {
            console.log("Comment fetch error", error);
        } finally {
            setCommentsLoading(false);
        }
    };

    const handlePostComment = async () => {
        if (!newCommentText.trim() || !activeActivityId) return;
        try {
            const type = tab === 'games' ? 'games' : 'outings';
            const res = await axios.post(`/collaboration/${type}/comment/add/${activeActivityId}`, {
                text: newCommentText
            });
            if (res.data.success) {
                setCommentsList([res.data.comment, ...commentsList]);
                setNewCommentText("");
                // Optionally update main list data count
                setData(prev => prev.map(item => 
                    item._id === activeActivityId 
                    ? { ...item, comments: [...item.comments, res.data.comment] } 
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
        // FIXED: Use .some() to check object IDs because users array is populated
        const isJoined = item.users?.some((u: any) => (u._id || u) === user?._id);

        const dateObj = new Date(item.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
            <View className="bg-gray-900 mx-4 mb-4 rounded-2xl border border-gray-800 shadow-md overflow-hidden">
                {/* Header */}
                <View className="p-4 flex-row justify-between items-start">
                    <View className="flex-1">
                        <Text className="text-white text-xl font-bold mb-1">
                            {tab === 'games' ? item.game_name : item.destination}
                        </Text>
                        <View className="flex-row items-center">
                            <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
                            <Text className="text-gray-400 text-xs ml-1">
                                {formattedDate} • {item.time}
                            </Text>
                        </View>
                    </View>
                    
                    {/* Admin Avatar */}
                    <View className="items-center gap-5 flex-row">
                        <View className='items-center justify-center'>
                            <Image
                                source={{
                                uri:
                                    item.admin?.avatar ||
                                    `https://ui-avatars.com/api/?name=${item.admin?.username}`,
                                }}
                                className="w-8 h-8 rounded-full border border-gray-600"
                            />
                            <Text className="text-gray-500 text-[10px] mt-1">
                                Host
                            </Text>
                        </View>
                        {item.admin?._id === user._id && (
                            <TouchableOpacity
                            onPress={() => handleDelete(item)}
                            className="p-2 rounded-full mb-5"
                            >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Details Body */}
                <View className="px-4 pb-4">
                    <View className="flex-row items-center mb-2">
                        <Ionicons name="location" size={16} color={tab === 'games' ? '#f472b6' : '#60a5fa'} />
                        <Text className="text-gray-300 ml-2 font-medium">
                            {tab === 'games' ? item.venue : "Trip Destination"}
                        </Text>
                    </View>
                    
                    <View className="flex-row items-center mb-2">
                        <MaterialCommunityIcons name="account-group" size={16} color="#9ca3af" />
                        <Text className="text-gray-400 ml-2">
                            {item.users.length} {tab === 'games' && `/ ${item.team_size}`} Joined
                        </Text>
                        <TouchableOpacity onPress={() => toggleUsers(item._id)} className="ml-2">
                            <Ionicons name={expandedId === item._id ? "chevron-up" : "chevron-down"} size={18} color="#9ca3af"/>
                        </TouchableOpacity>
                    </View>

                    {expandedId === item._id && (
                    <View className="bg-gray-800 p-3 rounded-lg mb-2">
                        {item.users.length === 0 ? (
                        <Text className="text-gray-500 text-sm">
                            No participants yet
                        </Text>
                        ) : (
                        item.users.map((u: any) => (
                            <View key={u._id || u} className="flex-row items-center mt-2">
                                <Image source={{ uri:u.avatar ||`https://ui-avatars.com/api/?name=${u.username || "User"}`}} className="w-6 h-6 rounded-full mr-2"/>
                                <Text className="text-gray-300 text-sm">
                                    {u.name || "User"}
                                </Text>
                            </View>
                        ))
                        )}
                    </View>
                    )}
                </View>

                {/* Action Footer */}
                <View className="flex-row border-t border-gray-800">
                    <TouchableOpacity 
                        onPress={() => handleJoin(item)}
                        className={`flex-1 py-3 items-center justify-center ${isJoined ? 'bg-red-700' : (tab === 'games' ? 'bg-pink-600' : 'bg-blue-600')}`}
                    >
                        <Text className={`font-bold ${isJoined ? 'text-gray-400' : 'text-white'}`}>
                            {isJoined ? "Leave" : "Join Now"}
                        </Text>
                    </TouchableOpacity>
                    
                    <View className="w-[1px] bg-gray-800" />

                    <TouchableOpacity 
                        onPress={() => handleOpenComments(item._id)}
                        className="flex-1 py-3 items-center justify-center bg-gray-900 flex-row gap-2"
                    >
                        <Ionicons name="chatbubble-outline" size={18} color="white" />
                        <Text className="text-white font-medium">Discuss ({item.comments?.length || 0})</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-black">
            {/* Background Gradient */}
            <LinearGradient 
                colors={['rgba(30, 64, 175, 0.2)', '#000000']} 
                className="absolute w-full h-full" 
            />

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-4 py-4 flex-row justify-between items-center">
                    <View>
                        <Text className="text-2xl font-bold text-white">Find Teammate</Text>
                        <Text className="text-gray-400 text-xs">Collaborate & Explore</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCreateModalVisible(true)} className="bg-gray-800 p-2 rounded-full">
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View className="flex-row mx-4 mb-4 bg-gray-900 p-1 rounded-xl border border-gray-800">
                    <TouchableOpacity 
                        onPress={() => setTab('games')}
                        className={`flex-1 py-2 items-center rounded-lg ${tab === 'games' ? 'bg-pink-600' : 'bg-transparent'}`}
                    >
                        <Text className={`font-bold ${tab === 'games' ? 'text-white' : 'text-gray-400'}`}>Gaming</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setTab('outings')}
                        className={`flex-1 py-2 items-center rounded-lg ${tab === 'outings' ? 'bg-blue-600' : 'bg-transparent'}`}
                    >
                        <Text className={`font-bold ${tab === 'outings' ? 'text-white' : 'text-gray-400'}`}>Outings</Text>
                    </TouchableOpacity>
                </View>

                {/* List */}
                {loading ? (
                    <ActivityIndicator size="large" color="white" className="mt-20" />
                ) : (
                    <FlatList
                        data={data}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20">
                                <Ionicons name="game-controller-outline" size={48} color="#fff" />
                                <Text className="text-gray-500 mt-4">No active {tab} found.</Text>
                            </View>
                        }
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}
            </SafeAreaView>

            {/* --- CREATE MODAL --- */}
            <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-gray-900 rounded-t-3xl p-6 h-[80%] border-t border-gray-800">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white text-xl font-bold">Host {tab === 'games' ? 'Game' : 'Outing'}</Text>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                                <Ionicons name="close" size={24} color="gray" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text className="text-gray-400 text-xs uppercase mb-2">{tab === 'games' ? "Game Name" : "Destination"}</Text>
                            <TextInput 
                                value={newName} onChangeText={setNewName}
                                placeholder={tab === 'games' ? "e.g. Valorant, BGMI" : "e.g. Manali Trip"} 
                                placeholderTextColor="#666"
                                className="bg-black text-white p-4 rounded-xl mb-4 border border-gray-800"
                            />

                            <View className="flex-row gap-4 mb-4">
                                <View className="flex-1">
                                    <Text className="text-gray-400 text-xs uppercase mb-2">Date (YYYY-MM-DD)</Text>
                                    <TextInput 
                                        value={newDate} onChangeText={setNewDate} placeholder="2025-12-25" placeholderTextColor="#666"
                                        className="bg-black text-white p-4 rounded-xl border border-gray-800"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-400 text-xs uppercase mb-2">Time (HH:MM)</Text>
                                    <TextInput 
                                        value={newTime} onChangeText={setNewTime} placeholder="14:00" placeholderTextColor="#666"
                                        className="bg-black text-white p-4 rounded-xl border border-gray-800"
                                    />
                                </View>
                            </View>

                            {tab === 'games' && (
                                <>
                                    <Text className="text-gray-400 text-xs uppercase mb-2">Venue / Platform</Text>
                                    <TextInput 
                                        value={newVenue} onChangeText={setNewVenue} placeholder="e.g. Discord, Room 304" placeholderTextColor="#666"
                                        className="bg-black text-white p-4 rounded-xl mb-4 border border-gray-800"
                                    />
                                    <Text className="text-gray-400 text-xs uppercase mb-2">Team Size</Text>
                                    <TextInput 
                                        value={newTeamSize} onChangeText={setNewTeamSize} placeholder="e.g. 5" keyboardType="numeric" placeholderTextColor="#666"
                                        className="bg-black text-white p-4 rounded-xl mb-4 border border-gray-800"
                                    />
                                </>
                            )}

                            <TouchableOpacity 
                                onPress={handleCreate} disabled={creating}
                                className={`p-4 rounded-xl items-center mt-4 ${tab === 'games' ? 'bg-pink-600' : 'bg-blue-600'}`}
                            >
                                {creating ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Create Activity</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* --- COMMENT MODAL --- */}
            <Modal visible={commentModalVisible} animationType="slide" transparent onRequestClose={() => setCommentModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/60 justify-end">
                    <Pressable className="flex-1" onPress={() => setCommentModalVisible(false)} />
                    <View className="bg-gray-900 rounded-t-3xl h-[70%] border-t border-gray-800">
                        <View className="flex-row justify-center items-center p-4 border-b border-gray-800">
                            <View className="w-12 h-1 bg-gray-700 rounded-full" />
                        </View>
                        
                        {commentsLoading ? (
                            <ActivityIndicator className="mt-10" color="white" />
                        ) : (
                            <FlatList 
                                data={commentsList}
                                keyExtractor={(item) => item._id}
                                contentContainerStyle={{ padding: 16 }}
                                ListEmptyComponent={<Text className="text-gray-500 text-center mt-10">No discussions yet.</Text>}
                                renderItem={({item}) => (
                                    <View className="flex-row mb-4">
                                        <Image source={{ uri: item.commentor?.avatar }} className="w-8 h-8 rounded-full bg-gray-700" />
                                        <View className="ml-3 flex-1">
                                            <Text className="text-white font-bold text-xs">{item.commentor?.name}</Text>
                                            <Text className="text-gray-300 text-sm mt-0.5">{item.text}</Text>
                                        </View>
                                    </View>
                                )}
                            />
                        )}

                        <View className="p-3 border-t border-gray-800 bg-black flex-row items-center">
                            <TextInput 
                                value={newCommentText} onChangeText={setNewCommentText}
                                placeholder="Ask something..." placeholderTextColor="#666"
                                className="flex-1 bg-gray-800 text-white rounded-full px-4 py-3 mr-2"
                            />
                            <TouchableOpacity onPress={handlePostComment}>
                                <Ionicons name="send" size={24} color={tab === 'games' ? '#db2777' : '#2563eb'} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

export default CollaborationScreen;