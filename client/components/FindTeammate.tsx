import React, { useState, useEffect, useRef, useCallback } from 'react';
import {View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, RefreshControl, Linking, TextInput, Animated, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
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
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // --- FETCH DEVELOPERS ---
    // Ten at a time, appending as the list is scrolled. Page 1 replaces the list
    // so a tab switch or pull-to-refresh does not stack duplicates on top of it.
    const PAGE_SIZE = 10;

    const fetchDevelopers = useCallback(async (pageNum = 1) => {
        try {
            if (pageNum === 1) setLoading(true); else setLoadingMore(true);
            const response = await axios.get('/user/find-team', {
                params: { type: activeTab, page: pageNum, limit: PAGE_SIZE }
            });

            if (response.data.success) {
                const batch = response.data.developers ?? [];
                setDevelopers((prev) => (pageNum === 1 ? batch : [...prev, ...batch]));
                const pg = response.data.pagination;
                // fall back to a short-batch check if an older server sends no
                // pagination block, so this cannot loop for ever
                setHasMore(pg ? pg.page < pg.pages : batch.length === PAGE_SIZE);
                setPage(pageNum);
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            if (pageNum === 1) {
                const msg = error.response?.data?.message || "Check your internet connection.";
                Alert.alert("Error", msg);
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [activeTab]);

    const loadMore = useCallback(() => {
        if (loadingMore || loading || !hasMore) return;
        fetchDevelopers(page + 1);
    }, [loadingMore, loading, hasMore, page, fetchDevelopers]);

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        fetchDevelopers(1);
    }, [activeTab, fetchDevelopers]);

    const onRefresh = () => {
        setRefreshing(true);
        setHasMore(true);
        fetchDevelopers(1);
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
    const renderCard = ({ item, index }: { item: UserProfile; index: number }) => (
        <View
            className={`bg-card rounded-card p-card-pad mb-5 mx-gutter ${index === 0 ? 'border-2 border-ink' : 'border border-line'}`}
            style={index === 0 ? { shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 } : undefined}
        >

            {/* Header */}
            <View className="flex-row items-center mb-5">
                <TouchableOpacity 
                    className="flex-row items-center flex-1"
                    onPress={() => navigation.navigate('PublicProfile', { userId: item._id })}
                >
                    <View className="p-1 rounded-full border border-line shadow-hair bg-card">
                        <Image
                            source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.name}` }}
                            className="w-16 h-16 rounded-full"
                        />
                    </View>
                    <View className="ml-4 flex-1">
                        <Text className="text-ink text-lg font-display uppercase">{item.name}</Text>
                        <Text className="text-ink-3 text-label font-display uppercase mt-0.5">@{item.username}</Text>
                        <View className="flex-row items-center mt-1.5 bg-paper-2 self-start px-2 py-0.5 rounded-full border border-line">
                            <MaterialCommunityIcons name="school" size={12} color="#8B857E" />
                            <Text className="text-ink-3 text-label font-semibold ml-1 uppercase">
                                {item.year}YR • {item.major}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Social Icons */}
                <View className="flex-row gap-2">
                    {item.github_id && (
                        <TouchableOpacity onPress={() => openLink(item.github_id)} className="w-9 h-9 bg-paper-2 rounded-card items-center justify-center border border-line">
                            <FontAwesome name="github" size={18} color="#12100E" />
                        </TouchableOpacity>
                    )}
                    {item.linkedIn_id && (
                        <TouchableOpacity onPress={() => openLink(item.linkedIn_id)} className="w-9 h-9 bg-fam-career/10 rounded-xl items-center justify-center border border-fam-career/15">
                            <FontAwesome name="linkedin" size={18} color="#0077b5" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Skills */}
            <View className="flex-row flex-wrap gap-2 mb-5">
                {item.skills?.slice(0, 4).map((skill, index) => (
                    <View key={index} className="bg-card border border-line px-2.5 py-1 rounded-full">
                        <Text className="text-accent-text text-label font-display uppercase">{skill}</Text>
                    </View>
                ))}
                {item.skills?.length > 4 && (
                    <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                        <Text className="text-ink-3 text-label font-display uppercase">+{item.skills.length - 4}</Text>
                    </View>
                )}
            </View>

            {/* Bio */}
            {(item.about || item.experience) && (
                <View className="bg-paper-2/50 p-4 rounded-card mb-6 border border-line">
                    <Text className="text-ink-3 text-xs font-medium leading-5" numberOfLines={3}>
                        {item.about || item.experience || "No bio available."}
                    </Text>
                </View>
            )}

            {/* Footer */}
            <View className="flex-row justify-between items-center bg-ink/5 p-2 rounded-card border border-ink/5">
                <View className="flex-row items-center flex-1 ml-3 mr-4">
                    <Ionicons name="location" size={14} color="#8B857E" />
                    <Text className="text-ink-3 text-label font-display uppercase ml-2 flex-1" numberOfLines={1}>
                        {item.college}
                    </Text>
                </View>

                <TouchableOpacity onPress={() => handleMessage(item)} disabled={connectingId !== null} className='rounded-card overflow-hidden'>
                    <View className="px-6 py-3 bg-ink flex-row items-center">
                        {connectingId === item._id ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Ionicons name="chatbubble" size={16} color="white" />
                                <Text className="text-white font-display ml-2 text-label uppercase">Chat</Text>
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
                className="bg-card rounded-sheet p-6 mb-5 border border-line mx-5 mt-2"
            >
                <View className="flex-row items-center mb-6">
                    <View className="w-16 h-16 rounded-full bg-paper-2" />
                    <View className="ml-4 flex-1">
                        <View className="h-5 bg-paper-2 rounded w-1/2 mb-2" />
                        <View className="h-3 bg-paper-2 rounded w-1/4 mb-3" />
                        <View className="h-3 bg-paper-2 rounded w-1/3" />
                    </View>
                </View>

                <View className="flex-row gap-2 mb-6">
                    {[1, 2, 3].map(i => <View key={i} className="h-7 w-20 bg-paper-2 rounded-card" />)}
                </View>

                <View className="bg-paper-2 p-4 rounded-card mb-6 border border-line">
                    <View className="h-3 bg-paper-2 rounded w-full mb-2" />
                    <View className="h-3 bg-paper-2 rounded w-4/5" />
                </View>

                <View className="flex-row justify-between items-center">
                    <View className="h-4 bg-paper-2 rounded w-1/3" />
                    <View className="w-24 h-12 bg-paper-2 rounded-card" />
                </View>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION */}

            <SafeAreaView className="flex-1">

                {/* HEADER */}
                <View className="px-gutter pt-8 pb-4 flex-row justify-between items-center">
                    <View>
                        <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Squad</Text>
                        <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Builder</Text>
                        <Text className="text-ink-3 text-label font-display uppercase mt-0.5">
                            Build your dream team today.
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                        <Ionicons name="close" size={24} color="#12100E" />
                    </TouchableOpacity>
                </View>

                {/* SEARCH BAR */}
                <View className="mx-gutter mt-6 mb-6">
                    <View className="flex-row items-center bg-card px-6 py-4 border-2 border-ink shadow-hair rounded-md">
                        <Ionicons name="search" size={20} color="#C4BEB6" />
                        <TextInput
                            placeholder="Search by skill or index..."
                            placeholderTextColor="#C4BEB6"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className="flex-1 ml-4 text-ink text-sm font-display"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <Ionicons name="close-circle" size={20} color="#C4BEB6" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* TABS */}
                <View className="flex-row mb-8 mx-gutter bg-card p-1.5 rounded-card border border-line shadow-hair">
                    <TouchableOpacity
                        className={`flex-1 py-3.5 rounded-xl items-center justify-center flex-row ${activeTab === 'global' ? 'bg-ink' : 'bg-transparent'}`}
                        onPress={() => setActiveTab('global')}
                    >
                        <Ionicons name="globe-outline" size={16} color={activeTab === 'global' ? 'white' : '#8B857E'} />
                        <Text className={`font-display text-label uppercase ml-2 ${activeTab === 'global' ? 'text-white' : 'text-ink-3'}`}>
                            Global
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className={`flex-1 py-3.5 rounded-xl items-center justify-center flex-row ${activeTab === 'college' ? 'bg-ink' : 'bg-transparent'}`}
                        onPress={() => setActiveTab('college')}
                    >
                        <Ionicons name="school-outline" size={16} color={activeTab === 'college' ? 'white' : '#8B857E'} />
                        <Text className={`font-display text-label uppercase ml-2 ${activeTab === 'college' ? 'text-white' : 'text-ink-3'}`}>
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
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" colors={['#F97316']} />
                        }
                        // A local search filters what is already loaded, so paging
                        // while filtering would append rows the filter then hides.
                        onEndReached={searchQuery.length > 0 ? undefined : loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={
                            loadingMore ? <ActivityIndicator size="small" color="#F97316" style={{ paddingVertical: 24 }} /> : null
                        }
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-gutter">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <MaterialCommunityIcons name="account-search-outline" size={40} color="#C4BEB6" />
                                </View>
                                <Text className="text-ink font-display text-xl text-center uppercase">No Talent Found</Text>
                                <Text className="font-sans text-sm text-ink-3 text-center mt-2">
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
