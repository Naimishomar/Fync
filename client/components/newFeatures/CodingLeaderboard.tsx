import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, FlatList, Image, TextInput, TouchableOpacity,
    ActivityIndicator, RefreshControl, Modal, ScrollView, Alert, Linking, Animated, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Octicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';

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
                Alert.alert("Welcome to the Arena! 🏆", "Your profile has been connected. Start coding to climb the ranks.");
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
                const total = res.data.user.codingStats.totalSolved;
                Alert.alert("Synced! ⚡", `You have solved ${total} problems on LeetCode.`);
                fetchLeaderboard();
            }
        } catch (err) {
            Alert.alert("Error", "Check your LeetCode username in settings.");
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

    // --- AUTOMATIC 10-MINUTE SYNC ---
    useEffect(() => {
        if (!hasLinkedProfile) return;
        const interval = setInterval(() => {
            console.log("⏰ 10 Minute Sync Cycle Triggered");
            fetchLeaderboard();
        }, 10 * 60 * 1000); // 10 minutes in milliseconds

        return () => clearInterval(interval);
    }, [hasLinkedProfile]);

    const renderItem = ({ item, index }: { item: any, index: number }) => (
        <TouchableOpacity onPress={() => openUserProfile(item)} className="flex-row items-center bg-white p-5 mb-4 mx-5 rounded-[28px] border border-slate-100 shadow-sm shadow-black/5">
            <View className="w-10 items-center justify-center mr-3">
                {index < 3 ? (
                    <View className={`w-8 h-8 rounded-full items-center justify-center ${index === 0 ? 'bg-amber-50' : index === 1 ? 'bg-slate-50' : 'bg-orange-50'}`}>
                        <MaterialCommunityIcons name="crown" size={18} color={index === 0 ? "#fbbf24" : index === 1 ? "#94a3b8" : "#78350f"} />
                    </View>
                ) : (
                    <Text className="text-slate-300 font-black  text-lg">#{index + 1}</Text>
                )}
            </View>
            <View className="p-0.5 rounded-full border border-slate-100 bg-white">
                <Image source={{ uri: item.avatar }} className="w-12 h-12 rounded-full" />
            </View>
            <View className="flex-1 ml-4">
                <Text className="text-zinc-900 font-black  text-sm uppercase tracking-tight" numberOfLines={1}>{item.name || item.username}</Text>
                <View className="flex-row items-center mt-1">
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{item.college || "Global Arena"}</Text>
                </View>
            </View>
            <View className="items-center bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100">
                <Text className="text-zinc-900 font-black  text-lg tracking-tighter">
                    {timeFilter === 'weekly' ? (item.weeklyStats?.questionsThisWeek || 0) : (item.codingStats?.totalSolved || 0)}
                </Text>
                <Text className="text-slate-400 text-[8px] font-black uppercase tracking-tighter">{timeFilter === 'weekly' ? '7 Days' : 'Solved'}</Text>
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
                className="flex-row items-center bg-white p-5 mb-4 mx-5 rounded-[28px] border border-slate-100"
            >
                <View className="w-10 items-center justify-center mr-3">
                    <View className="w-8 h-8 bg-slate-50 rounded-full" />
                </View>
                <View className="w-12 h-12 rounded-full bg-slate-50" />
                <View className="flex-1 ml-4 justify-center">
                    <View className="h-4 bg-slate-50 rounded w-1/2 mb-2" />
                    <View className="h-3 bg-slate-50 rounded w-1/4" />
                </View>
                <View className="items-end justify-center">
                    <View className="h-8 bg-slate-50 rounded-xl w-14" />
                </View>
            </Animated.View>
        );
    };

    if (!hasLinkedProfile) {
        return (
            <View className="flex-1 bg-[#F8FAFC]">
                <StatusBar barStyle="dark-content" />
                <LinearGradient colors={['#f97316', 'transparent']} className="absolute top-0 w-full h-80 opacity-20" />

                <SafeAreaView className="flex-1 items-center justify-center px-8">
                    <View className="w-24 h-24 bg-white rounded-[40px] items-center justify-center shadow-2xl shadow-orange-500/20 border border-slate-100 mb-8">
                        <MaterialCommunityIcons name="shield-lock" size={48} color="#f97316" />
                    </View>

                    <Text className="text-zinc-900 text-4xl font-black  uppercase tracking-tighter text-center">Join The<Text className="text-orange-500"> Arena</Text></Text>
                    <Text className="text-slate-400 text-center font-black uppercase text-[10px] tracking-widest mt-2 leading-4 px-10">
                        Connect your coding profiles to unlock the global leaderboard and track your progress.
                    </Text>

                    <View className="w-full mt-12 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <View className="flex-row items-center mb-6">
                            <View className="w-8 h-8 rounded-xl bg-orange-50 items-center justify-center mr-3">
                                <Image source={{ uri: LC_LOGO }} className="w-4 h-4" resizeMode="contain" />
                            </View>
                            <Text className="text-zinc-800 font-black  uppercase text-xs tracking-tight">LeetCode Username</Text>
                        </View>

                        <TextInput
                            placeholder="Enter username (e.g. jdoe22)"
                            placeholderTextColor="#CBD5E1"
                            value={lcUsername}
                            onChangeText={setLcUsername}
                            className="bg-slate-50 p-5 rounded-2xl text-zinc-900 font-black  text-sm border border-slate-100"
                        />

                        <TouchableOpacity
                            onPress={handleLinkProfile}
                            disabled={connecting}
                            className="bg-zinc-900 mt-6 py-5 rounded-2xl items-center shadow-xl shadow-black/10"
                        >
                            {connecting ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text className="text-white font-black  uppercase tracking-widest text-xs">Link Profile & Enter</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <Text className="text-slate-300 text-[8px] font-black uppercase tracking-widest mt-10 text-center px-10">
                        By entering, your coding stats will be visible to other hunters in the arena.
                    </Text>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION */}
            <View className="absolute top-0 w-full h-80 opacity-40">
                <LinearGradient
                    colors={['#f97316', 'transparent']}
                    className="w-full h-full"
                />
            </View>

            <SafeAreaView className="flex-1">
                <View className="px-8 pt-8 mb-6 flex-row justify-between items-center">
                    <View>
                        <Text className="text-zinc-900 text-3xl font-black  tracking-tighter uppercase">Coding<Text className="text-orange-500"> Rank</Text></Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px]">Campus Coding Arena</Text>
                    </View>
                    <TouchableOpacity onPress={handleManualRefresh} disabled={refreshingStats} className={`w-12 h-12 rounded-2xl items-center justify-center border shadow-sm ${refreshingStats ? 'border-orange-100 bg-orange-50' : 'border-slate-100 bg-white'}`}>
                        {refreshingStats ? <ActivityIndicator size="small" color="#f97316" /> : <Ionicons name="refresh" size={20} color="#18181b" />}
                    </TouchableOpacity>
                </View>

                <View className="px-8 mb-6">
                    <View className="flex-row items-center bg-white px-4 py-1 rounded-[20px] border border-slate-100 shadow-2xl shadow-black/5 mb-6">
                        <Ionicons name="search" size={20} color="#CBD5E1" />
                        <TextInput placeholder="Search hunters..." placeholderTextColor="#CBD5E1" value={search} onChangeText={setSearch} className="flex-1 text-zinc-900 font-black  uppercase text-sm tracking-tight" />
                    </View>

                    <View className="flex-row justify-between gap-4">
                        <View className="flex-1 flex-row bg-white rounded-[18px] p-1.5 border border-slate-100 shadow-sm">
                            {['college', 'global'].map(scope => (
                                <TouchableOpacity key={scope} onPress={() => setActiveScope(scope as any)} className={`flex-1 items-center py-3 rounded-[12px] ${activeScope === scope ? 'bg-zinc-900' : 'bg-transparent'}`}>
                                    <Text className={`font-black  text-[10px] uppercase tracking-widest ${activeScope === scope ? 'text-white' : 'text-slate-400'}`}>{scope === 'college' ? 'Campus' : 'Global'}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View className="flex-1 flex-row bg-white rounded-[18px] p-1.5 border border-slate-100 shadow-sm">
                            <TouchableOpacity onPress={() => setTimeFilter('allTime')} className={`flex-1 items-center py-3 rounded-[12px] ${timeFilter === 'allTime' ? 'bg-orange-500' : 'bg-transparent'}`}>
                                <Text className={`font-black  text-[10px] uppercase tracking-widest ${timeFilter === 'allTime' ? 'text-white' : 'text-slate-400'}`}>All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setTimeFilter('weekly')} className={`flex-1 items-center py-3 rounded-[12px] ${timeFilter === 'weekly' ? 'bg-green-500' : 'bg-transparent'}`}>
                                <Text className={`font-black  text-[10px] uppercase tracking-widest ${timeFilter === 'weekly' ? 'text-white' : 'text-slate-400'}`}>7 Days</Text>
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
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-10">
                                <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6 border border-slate-100">
                                    <FontAwesome5 name="code" size={32} color="#CBD5E1" />
                                </View>
                                <Text className="text-zinc-900 font-black  text-xl tracking-tight text-center uppercase">No Hunters Found</Text>
                                <Text className="text-slate-400 text-center font-bold text-xs mt-2 uppercase tracking-wide">The arena is currently quiet.</Text>
                            </View>
                        }
                    />
                )}

                {/* --- ULTRA DETAILED MODAL --- */}
                <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                    <BlurView intensity={20} tint="light" className="flex-1 justify-end">
                        <TouchableOpacity className="absolute inset-0" onPress={() => setModalVisible(false)} />
                        <View className="bg-white h-[85%] rounded-t-[48px] border-t border-slate-100 p-8 shadow-2xl">
                            <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mb-8" />

                            {profileLoading || !lcData ? (
                                <ActivityIndicator size="large" color="#f97316" className="mt-20" />
                            ) : (
                                <ScrollView showsVerticalScrollIndicator={false}>

                                    {/* 1. Header Profile */}
                                    <View className="items-center mb-10">
                                        <View className="p-1.5 rounded-full border-2 border-orange-500 bg-white shadow-xl shadow-orange-500/20">
                                            <Image source={{ uri: lcData?.profile?.avatar }} className="w-24 h-24 rounded-full bg-slate-50" />
                                        </View>
                                        <Text className="text-zinc-900 text-3xl font-black uppercase tracking-tighter mt-3">{lcData.profile?.name || dbUser?.name}</Text>
                                        <Text className="text-slate-400 font-black text-[10px] tracking-widest">@{dbUser?.codingProfiles?.leetcode}</Text>

                                        {/* Buttons Row */}
                                        <View className="flex-row mt-8 gap-4">
                                            <TouchableOpacity
                                                onPress={navigateToAppProfile}
                                                className="flex-row items-center bg-zinc-900 px-6 py-3.5 rounded-[20px] shadow-lg shadow-black/20"
                                            >
                                                <Ionicons name="person" size={14} color="white" />
                                                <Text className="text-white font-black  text-[10px] uppercase tracking-widest ml-2">Profile</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={openLeetCodeExternal}
                                                className="flex-row items-center bg-white px-6 py-3.5 rounded-[20px] border border-slate-100 shadow-sm"
                                            >
                                                <Image source={{ uri: LC_LOGO }} className="w-3.5 h-3.5" />
                                                <Text className="text-zinc-900 font-black  text-[10px] uppercase tracking-widest ml-2">LeetCode</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Ranking Chips */}
                                        <View className="flex-row mt-6 gap-3">
                                            <View className="bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
                                                <Text className="text-amber-600 font-black  text-[10px] uppercase tracking-tight">Global Rank #{lcData.profile?.ranking || "N/A"}</Text>
                                            </View>
                                            <View className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                                                <Text className="text-indigo-600 font-black  text-[10px] uppercase tracking-tight">{lcData.profile?.country || "Earth"}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* 2. Solved Stats */}
                                    <View className="flex-row gap-4 mb-8">
                                        <View className="flex-1 bg-zinc-900 p-6 rounded-[32px] items-center justify-center shadow-xl shadow-black/10">
                                            <Text className="text-4xl font-black  text-white tracking-tighter">{lcData.solved?.solvedProblem || 0}</Text>
                                            <View className="mt-1 bg-white/10 px-2 py-0.5 rounded-full">
                                                <Text className="text-white text-[9px] font-black uppercase tracking-widest">Total</Text>
                                            </View>
                                        </View>
                                        <View className="flex-1 gap-2">
                                            <View className="flex-row justify-between bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-100">
                                                <Text className="text-emerald-600 text-[10px] font-black uppercase ">Easy</Text>
                                                <Text className="text-zinc-900 text-xs font-black ">{lcData.solved?.easySolved || 0}</Text>
                                            </View>
                                            <View className="flex-row justify-between bg-amber-50 px-4 py-3 rounded-2xl border border-amber-100">
                                                <Text className="text-amber-600 text-[10px] font-black uppercase ">Med</Text>
                                                <Text className="text-zinc-900 text-xs font-black ">{lcData.solved?.mediumSolved || 0}</Text>
                                            </View>
                                            <View className="flex-row justify-between bg-rose-50 px-4 py-3 rounded-2xl border border-rose-100">
                                                <Text className="text-rose-600 text-[10px] font-black uppercase ">Hard</Text>
                                                <Text className="text-zinc-900 text-xs font-black ">{lcData.solved?.hardSolved || 0}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* 3. Activity Heatmap */}
                                    <View className="mb-8 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                        <Text className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-6">Activity Snapshot</Text>
                                        <View className="flex-row justify-between items-end px-2">
                                            {getActivityData(lcData.submissionCalendar).map((day: any, i: number) => (
                                                <View key={i} className="items-center gap-3">
                                                    {day.count > 0 ? (
                                                        <View className="items-center">
                                                            <View className="bg-emerald-50 px-1 rounded mb-1 border border-emerald-100">
                                                                <Text className="text-emerald-600 text-[8px] font-black">{day.count}</Text>
                                                            </View>
                                                            <View
                                                                className="w-4 bg-emerald-500 rounded-full"
                                                                style={{ height: Math.min(day.count * 10, 40) }}
                                                            />
                                                        </View>
                                                    ) : (
                                                        <View className="w-4 h-4 bg-slate-50 rounded-full border border-slate-100" />
                                                    )}
                                                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-tighter">{day.dayName}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* 4. Badges (Horizontal Scroll) */}
                                    {lcData.badges && lcData.badges.length > 0 && (
                                        <View className="mb-8">
                                            <Text className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4 ml-1">Elite Badges ({lcData.badges.length})</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-1">
                                                {lcData.badges.map((badge: any, i: number) => (
                                                    <View key={i} className="mr-6 items-center w-24 bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm">
                                                        <Image
                                                            source={{ uri: badge.icon.startsWith("http") ? badge.icon : `https://leetcode.com${badge.icon}` }}
                                                            className="w-14 h-14 mb-3"
                                                            resizeMode="contain"
                                                        />
                                                        <Text className="text-zinc-900 font-black  text-[8px] text-center uppercase tracking-tight" numberOfLines={2}>{badge.displayName}</Text>
                                                    </View>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {/* 5. Contest Rating */}
                                    {lcData.contest && (
                                        <View className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 mb-8 flex-row justify-between items-center">
                                            <View>
                                                <Text className="text-zinc-900 font-black  text-lg tracking-tight uppercase">Contest Rating</Text>
                                                <Text className="text-slate-500 text-[10px] font-bold uppercase mt-0.5">Top {lcData.contest.contestTopPercentage || 0}% Global</Text>
                                            </View>
                                            <View className="items-end bg-white px-5 py-2 rounded-2xl border border-slate-100 shadow-sm">
                                                <Text className="text-3xl font-black  text-orange-500 tracking-tighter">{Math.round(lcData.contest.contestRating || 0)}</Text>
                                            </View>
                                        </View>
                                    )}

                                    {/* 8. Recent Questions */}
                                    <Text className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4 ml-1">Recently Mastered</Text>
                                    {lcData.recentSubmissions && lcData.recentSubmissions.length > 0 ? (
                                        <View className="gap-2 mb-8">
                                            {lcData.recentSubmissions.slice(0, 5).map((sub: any, i: number) => (
                                                <View key={i} className="flex-row justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <View className="flex-1 mr-4">
                                                        <Text className="text-zinc-900 font-black  text-sm tracking-tight uppercase" numberOfLines={1}>{sub.title}</Text>
                                                        <Text className="text-slate-400 text-[9px] font-bold uppercase mt-1">
                                                            {new Date(parseInt(sub.timestamp) * 1000).toLocaleDateString()}
                                                        </Text>
                                                    </View>
                                                    <View className={`px-3 py-1 rounded-full ${sub.statusDisplay === 'Accepted' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                                        <Text className={`text-[8px] font-black uppercase tracking-widest ${sub.statusDisplay === 'Accepted' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {sub.statusDisplay}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text className="text-slate-300  mb-8">No recent activity detected.</Text>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => setModalVisible(false)}
                                        className="bg-zinc-900 py-5 rounded-[24px] items-center mb-10 shadow-xl shadow-black/20"
                                    >
                                        <Text className="text-white font-black uppercase tracking-widest text-xs">Close Profile</Text>
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