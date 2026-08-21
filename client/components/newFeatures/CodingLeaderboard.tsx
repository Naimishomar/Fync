import React, { useState, useEffect, useRef } from 'react';
import {View, Text, FlatList, Image, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, ScrollView, Linking, Animated, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Octicons from '@expo/vector-icons/Octicons';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

import { StampCard } from '../ui/kit';
// Mirrors LEETCODE_COOLDOWN_SECONDS on the server.
const COOLDOWN_MS = 15 * 60 * 1000;

const LC_LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png";

export default function CodingLeaderboard() {
    const { user, setUser } = useAuth();
    const navigation = useNavigation<any>();

    const [activeScope, setActiveScope] = useState<'global' | 'college'>('college');
    const [timeFilter, setTimeFilter] = useState<'allTime' | 'weekly'>('allTime');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [refreshingStats, setRefreshingStats] = useState(false);
    
    // Global Timer State
    const [syncCountdown, setSyncCountdown] = useState<string>("");
    const [canRefresh, setCanRefresh] = useState(false);
    const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);

    // Profile Connection State
    const [lcUsername, setLcUsername] = useState("");
    const [connecting, setConnecting] = useState(false);
    const hasLinkedProfile = !!user?.codingProfiles?.leetcode;

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [lcData, setLcData] = useState<any>(null);
    const [dbUser, setDbUser] = useState<any>(null);

    // --- 1. LINK PROFILE HANDLER ---
    const handleLinkProfile = async () => {
        if (!lcUsername.trim()) return Alert.alert("Required", "Please enter your LeetCode username.");

        setConnecting(true);
        try {
            const res = await axios.put('/leaderboard/update-profiles', { leetcode: lcUsername });
            if (res.data.success) {
                setUser(res.data.user);
                Alert.alert("Welcome to the Arena!", "Your profile has been connected. Start coding to climb the ranks.");
                fetchLeaderboard();
            }
        } catch (err: any) {
            Alert.alert("Link Failed", err.response?.data?.message || "Something went wrong");
        } finally {
            setConnecting(false);
        }
    };

    // --- HELPER: Process Calendar Data ---
    const getActivityData = (calendarString: string) => {
        try {
            const calendar = JSON.parse(calendarString);
            const today = new Date();
            const last7Days = [];

            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                d.setHours(0, 0, 0, 0);
                const dateStr = d.toISOString().split('T')[0];
                let count = 0;
                Object.keys(calendar).forEach(ts => {
                    const submissionDate = new Date(parseInt(ts) * 1000).toISOString().split('T')[0];
                    if (submissionDate === dateStr) count += calendar[ts];
                });
                last7Days.push({ date: d, count, dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }) });
            }
            return last7Days;
        } catch (e) {
            return Array(7).fill({ count: 0, dayName: '-' });
        }
    };

    const fetchLeaderboard = async () => {
        if (!hasLinkedProfile) return;
        try {
            if (!refreshing) setLoading(true);
            const res = await axios.get(`/leaderboard?scope=${activeScope}&type=${timeFilter}&search=${search}`);
            if (res.data.success) {
                const filtered = res.data.leaderboard.filter((u: any) => u.codingProfiles?.leetcode);
                setUsers(filtered);
            }
        } catch (error) {
            console.error("Leaderboard Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleManualRefresh = async () => {
        setRefreshingStats(true);
        try {
            const res = await axios.post('/leaderboard/refresh');
            if (res.data.success) {
                setUser(res.data.user);
                if (res.data.nextRefreshAt) setNextRefreshAt(new Date(res.data.nextRefreshAt));
                const total = res.data.user.codingStats.totalSolved;
                Alert.alert(
                    res.data.synced ? "Synced" : "Already Up To Date",
                    `You have solved ${total} problems on LeetCode.`
                );
                fetchLeaderboard();
            }
        } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Check your LeetCode username in settings.");
        } finally {
            setRefreshingStats(false);
        }
    };

    const openUserProfile = async (userData: any) => {
        setDbUser(userData);
        setModalVisible(true);
        setProfileLoading(true);
        try {
            const res = await axios.get(`/leaderboard/user/${userData._id}`);
            if (res.data.success) {
                setLcData(res.data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setProfileLoading(false);
        }
    };

    const navigateToAppProfile = () => {
        setModalVisible(false);
        navigation.navigate("PublicProfile", { user: dbUser });
    };

    const openLeetCodeExternal = () => {
        if (dbUser?.codingProfiles?.leetcode) {
            Linking.openURL(`https://leetcode.com/${dbUser.codingProfiles.leetcode}`);
        }
    };

    useEffect(() => { fetchLeaderboard(); }, [activeScope, timeFilter]);
    useEffect(() => { const t = setTimeout(fetchLeaderboard, 500); return () => clearTimeout(t); }, [search]);
    const onRefresh = () => { setRefreshing(true); fetchLeaderboard(); };

    // --- PER-USER COOLDOWN TIMER ---
    // This used to count down to the next :00/:15/:30/:45 wall-clock boundary and
    // open the refresh button for everyone in the same 30-second window — every
    // linked user in the college hit LeetCode at once. The window now starts from
    // *this* user's last sync, so taps are naturally spread out. The server
    // enforces the same cooldown regardless.
    useEffect(() => {
        if (!hasLinkedProfile) return;

        const tick = () => {
            const last = nextRefreshAt
                ? nextRefreshAt.getTime()
                : new Date(user?.codingStats?.lastUpdated || 0).getTime() + COOLDOWN_MS;
            const msLeft = last - Date.now();

            if (msLeft <= 0) {
                setCanRefresh(true);
                setSyncCountdown("00:00");
                return;
            }
            setCanRefresh(false);
            const mins = Math.floor(msLeft / 60000);
            const secs = Math.floor((msLeft % 60000) / 1000);
            setSyncCountdown(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [hasLinkedProfile, user?.codingStats?.lastUpdated, nextRefreshAt]);

    const renderItem = ({ item, index }: { item: any, index: number }) => (
        <TouchableOpacity onPress={() => openUserProfile(item)} className="flex-row items-center bg-card p-5 mb-4 mx-5 rounded-card border border-line shadow-hair">
            <View className="w-10 items-center justify-center mr-3">
                {index < 3 ? (
                    <View className={`w-8 h-8 rounded-full items-center justify-center ${index === 0 ? 'bg-warning/10' : index === 1 ? 'bg-paper-2' : 'bg-brand-50'}`}>
                        <MaterialCommunityIcons name="crown" size={18} color={index === 0 ? "#B45309" : index === 1 ? "#8B857E" : "#B45309"} />
                    </View>
                ) : (
                    <Text className="text-ink-4 font-display text-lg">#{index + 1}</Text>
                )}
            </View>
            <View className="p-0.5 rounded-full border border-line bg-card">
                <Image source={{ uri: item.avatar }} className="w-12 h-12 rounded-full" />
            </View>
            <View className="flex-1 ml-4">
                <Text className="text-ink font-display text-sm uppercase" numberOfLines={1}>{item.name || item.username}</Text>
                <View className="flex-row items-center mt-1">
                    <Text className="text-ink-3 text-label font-display uppercase">{item.college || "Global Arena"}</Text>
                </View>
            </View>
            <View className="items-center bg-paper-2 px-3 py-1.5 rounded-card border border-line">
                <Text className="text-ink font-display text-lg">
                    {timeFilter === 'weekly' ? (item.weeklyStats?.questionsThisWeek || 0) : (item.codingStats?.totalSolved || 0)}
                </Text>
                <Text className="text-ink-3 text-label font-display uppercase">{timeFilter === 'weekly' ? '7 Days' : 'Solved'}</Text>
            </View>
        </TouchableOpacity>
    );

    const LeaderboardSkeleton = () => {
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
                className="flex-row items-center bg-card p-5 mb-4 mx-5 rounded-card border border-line"
            >
                <View className="w-10 items-center justify-center mr-3">
                    <View className="w-8 h-8 bg-paper-2 rounded-full" />
                </View>
                <View className="w-12 h-12 rounded-full bg-paper-2" />
                <View className="flex-1 ml-4 justify-center">
                    <View className="h-4 bg-paper-2 rounded w-1/2 mb-2" />
                    <View className="h-3 bg-paper-2 rounded w-1/4" />
                </View>
                <View className="items-end justify-center">
                    <View className="h-8 bg-paper-2 rounded-xl w-14" />
                </View>
            </Animated.View>
        );
    };

    if (!hasLinkedProfile) {
        return (
            <View className="flex-1 bg-paper">
                <StatusBar barStyle="dark-content" />

                <SafeAreaView className="flex-1">
                    {/* Header with Back Button */}
                    <View className="px-gutter py-4 flex-row items-center">
                        <TouchableOpacity 
                            onPress={() => navigation.goBack()}
                            className="w-11 h-11 items-center justify-center rounded-xl"
                        
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                            <Ionicons name="arrow-back" size={20} color="#12100E" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 50 }}>
                        <View className="items-center mb-10">
                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-8">
                                <MaterialCommunityIcons name="shield-lock" size={48} color="#F97316" />
                            </View>

                            <Text className="text-ink text-4xl font-display uppercase text-center">Join The<Text className="text-accent-text"> Arena</Text></Text>
                            <Text className="font-sans text-sm text-ink-3 text-center mt-4 px-6">
                                Connect your LeetCode profile to unlock the leaderboard and climb the global ranks.
                            </Text>
                        </View>

                        <StampCard radius={26} style={{ width: '100%' }}>
                        <View className="w-full p-card-pad">
                            <View className="flex-row items-center mb-6 px-2">
                                <View className="w-10 h-10 rounded-card bg-card items-center justify-center mr-4 shadow-hair">
                                    <Image source={{ uri: LC_LOGO }} className="w-5 h-5" resizeMode="contain" />
                                </View>
                                <View>
                                    <Text className="font-semibold text-base text-ink">LeetCode Identity</Text>
                                    <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Verification Required</Text>
                                </View>
                            </View>

                            <TextInput
                                placeholder="USERNAME (E.G. NAIMISHOMAR)"
                                placeholderTextColor="#8B857E"
                                value={lcUsername}
                                onChangeText={setLcUsername}
                                autoCapitalize="none"
                                className="bg-card px-6 py-5 text-ink font-display text-sm border-[1.5px] border-ink rounded-md"
                            />

                            <TouchableOpacity
                                onPress={handleLinkProfile}
                                disabled={connecting}
                                activeOpacity={0.8}
                                className="bg-ink mt-6 py-5 items-center border-2 border-ink rounded-md"
                            >
                                {connecting ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <View className="flex-row items-center">
                                        <Text className="text-white font-display uppercase text-label mr-2">Link Profile & Enter</Text>
                                        <Ionicons name="rocket-outline" size={16} color="white" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                        </StampCard>

                        <Text className="font-sans text-sm text-ink-4 mt-12 text-center px-gutter">
                            Your coding stats will be fetched directly from LeetCode and displayed in the Fync Arena.
                        </Text>
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION */}

            <SafeAreaView className="flex-1">
                <View className="px-gutter pt-8 mb-6 flex-row justify-between items-center">
                    <View>
                        <Text className="text-ink text-3xl font-display uppercase">Coding<Text className="text-accent-text"> Rank</Text></Text>
                        <Text className="text-ink-3 text-label font-display uppercase">Campus Coding Arena</Text>
                    </View>
                    
                    {/* Synchronized Refresh Timer */}
                    {canRefresh ? (
                        <TouchableOpacity 
                            onPress={() => {
                                fetchLeaderboard();
                                setCanRefresh(false);
                            }} 
                            disabled={loading} 
                            className={`px-4 py-2.5 rounded-xl items-center shadow-hair ${loading ? 'bg-brand-200' : 'bg-brand-500 '}`}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#12100E" />
                            ) : (
                                <View className="flex-row items-center">
                                    <Ionicons name="reload" size={12} color="#12100E" />
                                    <Text className="text-ink font-display text-label uppercase ml-1.5">Load Fresh</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View className="bg-card border border-line items-center justify-center px-2.5 py-1 rounded-full">
                            <Text className="font-display text-label text-ink-3 uppercase mb-0.5">Next Sync</Text>
                            <Text className="text-ink font-display text-sm">{syncCountdown}</Text>
                        </View>
                    )}
                </View>

                <View className="px-gutter mb-6">
                    <View className="flex-row items-center bg-card px-4 py-1 border-2 border-ink shadow-hair mb-6 rounded-md">
                        <Ionicons name="search" size={20} color="#C4BEB6" />
                        <TextInput placeholder="Search hunters..." placeholderTextColor="#C4BEB6" value={search} onChangeText={setSearch} className="flex-1 text-ink font-display uppercase text-sm" />
                    </View>

                    <View className="flex-row justify-between gap-4">
                        <View className="flex-1 flex-row bg-card rounded-xl p-1.5 border border-line shadow-hair">
                            {['college', 'global'].map(scope => (
                                <TouchableOpacity key={scope} onPress={() => setActiveScope(scope as any)} className={`flex-1 items-center py-3 rounded-md ${activeScope === scope ? 'bg-ink' : 'bg-transparent'}`}>
                                    <Text className={`font-display text-label uppercase ${activeScope === scope ? 'text-white' : 'text-ink-3'}`}>{scope === 'college' ? 'Campus' : 'Global'}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View className="flex-1 flex-row bg-card rounded-xl p-1.5 border border-line shadow-hair">
                            <TouchableOpacity onPress={() => setTimeFilter('allTime')} className={`flex-1 items-center py-3 rounded-md ${timeFilter === 'allTime' ? 'bg-brand-500' : 'bg-transparent'}`}>
                                <Text className={`font-display text-label uppercase ${timeFilter === 'allTime' ? 'text-ink' : 'text-ink-3'}`}>All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setTimeFilter('weekly')} className={`flex-1 items-center py-3 rounded-md ${timeFilter === 'weekly' ? 'bg-success' : 'bg-transparent'}`}>
                                <Text className={`font-display text-label uppercase ${timeFilter === 'weekly' ? 'text-white' : 'text-ink-3'}`}>7 Days</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View className="mt-2">
                        {[1, 2, 3, 4, 5].map(i => <LeaderboardSkeleton key={i} />)}
                    </View>
                ) : (
                    <FlatList
                        data={users} keyExtractor={(item) => item._id} renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-gutter">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <FontAwesome5 name="code" size={32} color="#C4BEB6" />
                                </View>
                                <Text className="text-ink font-display text-xl text-center uppercase">No Hunters Found</Text>
                                <Text className="font-sans text-sm text-ink-3 text-center mt-2">The arena is currently quiet.</Text>
                            </View>
                        }
                    />
                )}

                {/* --- ULTRA DETAILED MODAL --- */}
                <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                    <BlurView intensity={20} tint="light" className="flex-1 justify-end">
                        <TouchableOpacity className="absolute inset-0" onPress={() => setModalVisible(false)} />
                        <View className="bg-paper h-[85%] rounded-t-sheet border-t border-line p-card-pad shadow-hair">
                            <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mb-8" />

                            {profileLoading || !lcData ? (
                                <ActivityIndicator size="large" color="#F97316" className="mt-20" />
                            ) : (
                                <ScrollView showsVerticalScrollIndicator={false}>

                                    {/* 1. Header Profile */}
                                    <View className="items-center mb-10">
                                        <View className="p-1.5 rounded-full border-2 border-brand-500 bg-card shadow-hair">
                                            <Image source={{ uri: lcData?.profile?.avatar }} className="w-24 h-24 rounded-full bg-paper-2" />
                                        </View>
                                        <Text className="text-ink text-3xl font-display uppercase mt-3">{lcData.profile?.name || dbUser?.name}</Text>
                                        <Text className="text-ink-3 font-display text-label">@{dbUser?.codingProfiles?.leetcode}</Text>

                                        {/* Buttons Row */}
                                        <View className="flex-row mt-8 gap-4">
                                            <TouchableOpacity
                                                onPress={navigateToAppProfile}
                                                className="flex-row items-center bg-ink px-6 py-3.5 border-2 border-ink rounded-md"
                                            >
                                                <Ionicons name="person" size={14} color="white" />
                                                <Text className="text-white font-display text-label uppercase ml-2">Profile</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={openLeetCodeExternal}
                                                className="flex-row items-center bg-card px-6 py-3.5 rounded-card border border-line shadow-hair"
                                            >
                                                <Image source={{ uri: LC_LOGO }} className="w-3.5 h-3.5" />
                                                <Text className="text-ink font-display text-label uppercase ml-2">LeetCode</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Ranking Chips */}
                                        <View className="flex-row mt-6 gap-3">
                                            <View className="bg-warning/10 border border-warning/15 px-2.5 py-1 rounded-full">
                                                <Text className="text-warning font-display text-label uppercase">Global Rank #{lcData.profile?.ranking || "N/A"}</Text>
                                            </View>
                                            <View className="bg-recruiter/10 border border-recruiter/15 px-2.5 py-1 rounded-full">
                                                <Text className="text-recruiter font-display text-label uppercase">{lcData.profile?.country || "Earth"}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* 2. Solved Stats */}
                                    <View className="flex-row gap-4 mb-8">
                                        <View className="flex-1 bg-ink p-6 rounded-sheet items-center justify-center shadow-hair">
                                            <Text className="text-4xl font-display text-white">{lcData.solved?.solvedProblem || 0}</Text>
                                            <View className="mt-1 bg-card/10 px-2 py-0.5 rounded-full">
                                                <Text className="text-white text-label font-display uppercase">Total</Text>
                                            </View>
                                        </View>
                                        <View className="flex-1 gap-2">
                                            <View className="flex-row justify-between bg-success/10 px-4 py-3 rounded-card border border-success/15">
                                                <Text className="text-success text-label font-display uppercase">Easy</Text>
                                                <Text className="text-ink text-xs font-display">{lcData.solved?.easySolved || 0}</Text>
                                            </View>
                                            <View className="flex-row justify-between bg-warning/10 px-4 py-3 rounded-card border border-warning/15">
                                                <Text className="text-warning text-label font-display uppercase">Med</Text>
                                                <Text className="text-ink text-xs font-display">{lcData.solved?.mediumSolved || 0}</Text>
                                            </View>
                                            <View className="flex-row justify-between bg-danger/10 px-4 py-3 rounded-card border border-danger/15">
                                                <Text className="text-danger text-label font-display uppercase">Hard</Text>
                                                <Text className="text-ink text-xs font-display">{lcData.solved?.hardSolved || 0}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* 3. Activity Heatmap */}
                                    <View className="mb-8 bg-card p-6 rounded-sheet border border-line shadow-hair">
                                        <View className="flex-row items-center mt-6 mb-6" style={{ gap: 12 }}>
                                          <Text className="text-ink-3 font-display text-label uppercase">Activity Snapshot</Text>
                                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                                        </View>
                                        <View className="flex-row justify-between items-end px-2">
                                            {getActivityData(lcData.submissionCalendar).map((day: any, i: number) => (
                                                <View key={i} className="items-center gap-3">
                                                    {day.count > 0 ? (
                                                        <View className="items-center">
                                                            <View className="bg-success/10 px-1 rounded mb-1 border border-success/15">
                                                                <Text className="text-success text-label font-display">{day.count}</Text>
                                                            </View>
                                                            <View
                                                                className="w-4 bg-success rounded-full"
                                                                style={{ height: Math.min(day.count * 10, 40) }}
                                                            />
                                                        </View>
                                                    ) : (
                                                        <View className="w-4 h-4 bg-paper-2 rounded-full border border-line" />
                                                    )}
                                                    <Text className="text-ink-3 text-label font-display uppercase">{day.dayName}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* 4. Badges (Horizontal Scroll) */}
                                    {lcData.badges && lcData.badges.length > 0 && (
                                        <View className="mb-8">
                                            <Text className="text-ink-3 font-display text-label uppercase mb-4 ml-1">Elite Badges ({lcData.badges.length})</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-1">
                                                {lcData.badges.map((badge: any, i: number) => (
                                                    <View key={i} className="mr-6 items-center w-24 bg-card p-4 rounded-card border border-line shadow-hair">
                                                        <Image
                                                            source={{ uri: badge.icon.startsWith("http") ? badge.icon : `https://leetcode.com${badge.icon}` }}
                                                            className="w-14 h-14 mb-3"
                                                            resizeMode="contain"
                                                        />
                                                        <Text className="text-ink font-display text-label text-center uppercase" numberOfLines={2}>{badge.displayName}</Text>
                                                    </View>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {/* 5. Contest Rating */}
                                    {lcData.contest && (
                                        <View className="bg-paper-2 p-6 rounded-sheet border border-line mb-8 flex-row justify-between items-center">
                                            <View>
                                                <Text className="text-ink font-display text-lg uppercase">Contest Rating</Text>
                                                <Text className="text-ink-3 text-label font-semibold uppercase mt-0.5">Top {lcData.contest.contestTopPercentage || 0}% Global</Text>
                                            </View>
                                            <View className="items-end bg-card px-5 py-2 rounded-card border border-line shadow-hair">
                                                <Text className="text-3xl font-display text-accent-text">{Math.round(lcData.contest.contestRating || 0)}</Text>
                                            </View>
                                        </View>
                                    )}

                                    {/* 8. Recent Questions */}
                                    <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                                      <Text className="text-ink-3 font-display text-label uppercase">Recently Mastered</Text>
                                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                                    </View>
                                    {lcData.recentSubmissions && lcData.recentSubmissions.length > 0 ? (
                                        <View className="gap-2 mb-8">
                                            {lcData.recentSubmissions.slice(0, 5).map((sub: any, i: number) => (
                                                <View key={i} className="flex-row justify-between items-center bg-card p-4 rounded-card border border-line shadow-hair">
                                                    <View className="flex-1 mr-4">
                                                        <Text className="text-ink font-display text-sm uppercase" numberOfLines={1}>{sub.title}</Text>
                                                        <Text className="text-ink-3 text-label font-semibold uppercase mt-1">
                                                            {new Date(parseInt(sub.timestamp) * 1000).toLocaleDateString()}
                                                        </Text>
                                                    </View>
                                                    <View className={`px-3 py-1 rounded-full ${sub.statusDisplay === 'Accepted' ? 'bg-success/10' : 'bg-danger/10'}`}>
                                                        <Text className={`text-label font-display uppercase ${sub.statusDisplay === 'Accepted' ? 'text-success' : 'text-danger'}`}>
                                                            {sub.statusDisplay}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text className="text-ink-4 mb-8">No recent activity detected.</Text>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => setModalVisible(false)}
                                        className="bg-ink py-5 rounded-card items-center mb-10 shadow-hair"
                                    >
                                        <Text className="text-white font-display uppercase text-xs">Close Profile</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            )}
                        </View>
                    </BlurView>
                </Modal>
            </SafeAreaView>
        </View>
    );
};
