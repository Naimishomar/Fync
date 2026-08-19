import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, RefreshControl, Linking, TextInput, Animated, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import axios from '../context/axiosConfig';
import socket from '../utils/socket';
import { TeammateSkeleton } from './Skeleton';
import { Alert } from './ui/AlertModal';

const BG_IMAGE = "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop";

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

    // --- FETCH DEVELOPERS ---
    const fetchDevelopers = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/user/find-team', {
                params: { type: activeTab }
            });

            if (response.data.success) {
                setDevelopers(response.data.developers);
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            const msg = error.response?.data?.message || "Check your internet connection.";
            Alert.alert("Error", msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDevelopers();
    }, [activeTab]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDevelopers();
    };

    // --- 🔍 FILTER LOGIC ---
    const filteredDevelopers = developers.filter((dev) => {
        const query = searchQuery.toLowerCase();
        return (
            dev.skills.some(skill => skill.toLowerCase().includes(query)) ||
            dev.name.toLowerCase().includes(query) ||
            dev.username.toLowerCase().includes(query)
        );
    });

    const handleMessage = async (targetUser: UserProfile) => {
        if (connectingId) return;

        try {
            setConnectingId(targetUser._id);

            const response = await axios.post("/chat/start", {
                userId: targetUser._id
            });

            const conversationId = response.data.conversation._id;

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

    const openLink = (url: string | undefined) => {
        if (url) Linking.openURL(url).catch(() => Alert.alert("Error", "Invalid Link"));
    };

    // --- RENDER CARD ---
    const renderCard = ({ item }: { item: UserProfile }) => (
        <View className="bg-white rounded-4xl p-6 mb-5 border border-slate-100 mx-5">

            {/* Header */}
            <View className="flex-row items-center mb-5">
                <TouchableOpacity 
                    className="flex-row items-center flex-1"
                    onPress={() => navigation.navigate('PublicProfile', { userId: item._id })}
                >
                    <View className="p-1 rounded-full border border-slate-100 shadow-sm bg-white">
                        <Image
                            source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.name}` }}
                            className="w-16 h-16 rounded-full"
                        />
                    </View>
                    <View className="ml-4 flex-1">
                        <Text className="text-slate-900 text-lg font-black  tracking-tighter uppercase">{item.name}</Text>
                        <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">@{item.username}</Text>
                        <View className="flex-row items-center mt-1.5 bg-slate-50 self-start px-2 py-0.5 rounded-full border border-slate-100">
                            <MaterialCommunityIcons name="school" size={12} color="#94a3b8" />
                            <Text className="text-slate-500 text-2xs font-bold ml-1 uppercase tracking-tighter">
                                {item.year}YR • {item.major}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Social Icons */}
                <View className="flex-row gap-2">
                    {item.github_id && (
                        <TouchableOpacity onPress={() => openLink(item.github_id)} className="w-9 h-9 bg-slate-50 rounded-xl items-center justify-center border border-slate-100">
                            <FontAwesome name="github" size={18} color="#18181b" />
                        </TouchableOpacity>
                    )}
                    {item.linkedIn_id && (
                        <TouchableOpacity onPress={() => openLink(item.linkedIn_id)} className="w-9 h-9 bg-blue-50 rounded-xl items-center justify-center border border-blue-100">
                            <FontAwesome name="linkedin" size={18} color="#0077b5" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Skills */}
            <View className="flex-row flex-wrap gap-2 mb-5">
                {item.skills?.slice(0, 4).map((skill, index) => (
                    <View key={index} className="bg-white px-4 py-1.5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-500/5">
                        <Text className="text-pink-500 text-2xs font-black  uppercase tracking-tight">{skill}</Text>
                    </View>
                ))}
                {item.skills?.length > 4 && (
                    <View className="bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100">
                        <Text className="text-slate-500 text-2xs font-black uppercase">+{item.skills.length - 4}</Text>
                    </View>
                )}
            </View>

            {/* Bio */}
            {(item.about || item.experience) && (
                <View className="bg-slate-50/50 p-4 rounded-2xl mb-6 border border-slate-100">
                    <Text className="text-slate-500 text-xs font-medium leading-5 " numberOfLines={3}>
                        {item.about || item.experience || "No bio available."}
                    </Text>
                </View>
            )}

            {/* Footer */}
            <View className="flex-row justify-between items-center bg-slate-900/5 p-2 rounded-2xl border border-slate-900/5">
                <View className="flex-row items-center flex-1 ml-3 mr-4">
                    <Ionicons name="location" size={14} color="#94a3b8" />
                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-tighter ml-2 flex-1" numberOfLines={1}>
                        {item.college}
                    </Text>
                </View>

                <TouchableOpacity onPress={() => handleMessage(item)} disabled={connectingId !== null} className='rounded-2xl overflow-hidden'>
                    <View className="px-6 py-3 bg-slate-900 flex-row items-center">
                        {connectingId === item._id ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Ionicons name="chatbubble" size={16} color="white" />
                                <Text className="text-white font-black  ml-2 text-2xs uppercase tracking-wide">Chat</Text>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </View>

        </View>
    );

    const TeammateSkeleton = () => {
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
                className="bg-white rounded-4xl p-6 mb-5 border border-slate-100 mx-5 mt-2"
            >
                <View className="flex-row items-center mb-6">
                    <View className="w-16 h-16 rounded-full bg-slate-100" />
                    <View className="ml-4 flex-1">
                        <View className="h-5 bg-slate-100 rounded w-1/2 mb-2" />
                        <View className="h-3 bg-slate-100 rounded w-1/4 mb-3" />
                        <View className="h-3 bg-slate-100 rounded w-1/3" />
                    </View>
                </View>

                <View className="flex-row gap-2 mb-6">
                    {[1, 2, 3].map(i => <View key={i} className="h-7 w-20 bg-slate-100 rounded-2xl" />)}
                </View>

                <View className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
                    <View className="h-3 bg-slate-100 rounded w-full mb-2" />
                    <View className="h-3 bg-slate-100 rounded w-4/5" />
                </View>

                <View className="flex-row justify-between items-center">
                    <View className="h-4 bg-slate-100 rounded w-1/3" />
                    <View className="w-24 h-12 bg-slate-100 rounded-2xl" />
                </View>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION */}
            <View className="absolute top-0 w-full h-80 opacity-40">
                <LinearGradient
                    colors={['#ec4899', 'transparent']}
                    className="w-full h-full"
                />
            </View>

            <SafeAreaView className="flex-1">

                {/* HEADER */}
                <View className="px-8 pt-8 pb-4 flex-row justify-between items-center">
                    <View>
                        <Text className="text-slate-900 text-3xl font-black  tracking-tighter uppercase">Squad <Text className="text-pink-500">Builder</Text></Text>
                        <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">
                            Build your dream team today.
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm">
                        <Ionicons name="close" size={24} color="#18181b" />
                    </TouchableOpacity>
                </View>

                {/* SEARCH BAR */}
                <View className="mx-8 mt-6 mb-6">
                    <View className="flex-row items-center bg-white rounded-3xl px-6 py-4 border border-slate-100 shadow-2xl shadow-black/5">
                        <Ionicons name="search" size={20} color="#CBD5E1" />
                        <TextInput
                            placeholder="Search by skill or index..."
                            placeholderTextColor="#CBD5E1"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className="flex-1 ml-4 text-slate-900 text-sm font-black  tracking-tight"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* TABS */}
                <View className="flex-row mb-8 mx-8 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                    <TouchableOpacity
                        className={`flex-1 py-3.5 rounded-xl items-center justify-center flex-row ${activeTab === 'global' ? 'bg-slate-900' : 'bg-transparent'}`}
                        onPress={() => setActiveTab('global')}
                    >
                        <Ionicons name="globe-outline" size={16} color={activeTab === 'global' ? 'white' : '#94a3b8'} />
                        <Text className={`font-black  text-2xs uppercase tracking-widest ml-2 ${activeTab === 'global' ? 'text-white' : 'text-slate-500'}`}>
                            Global
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className={`flex-1 py-3.5 rounded-xl items-center justify-center flex-row ${activeTab === 'college' ? 'bg-slate-900' : 'bg-transparent'}`}
                        onPress={() => setActiveTab('college')}
                    >
                        <Ionicons name="school-outline" size={16} color={activeTab === 'college' ? 'white' : '#94a3b8'} />
                        <Text className={`font-black  text-2xs uppercase tracking-widest ml-2 ${activeTab === 'college' ? 'text-white' : 'text-slate-500'}`}>
                            Campus
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* CONTENT */}
                {loading && developers.length === 0 ? (
                    <View className="flex-1 mt-4">
                        {[1, 2, 3, 4].map(i => <TeammateSkeleton key={i} />)}
                    </View>
                ) : (
                    <FlatList
                        data={searchQuery.length > 0 ? filteredDevelopers : developers}
                        keyExtractor={(item) => item._id}
                        renderItem={renderCard}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
                        }
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-10">
                                <View className="w-20 h-20 bg-slate-50 rounded-4xl items-center justify-center mb-6 border border-slate-100">
                                    <MaterialCommunityIcons name="account-search-outline" size={40} color="#CBD5E1" />
                                </View>
                                <Text className="text-slate-900 font-black  text-xl tracking-tight text-center uppercase">No Talent Found</Text>
                                <Text className="text-slate-500 text-center font-bold text-xs mt-2 uppercase tracking-wide">
                                    {searchQuery ? "Your criteria returned void results." : "The arena is currently empty."}
                                </Text>
                            </View>
                        }
                    />
                )}

            </SafeAreaView>
        </View>
    );
}
