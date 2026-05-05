import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Image,
    Dimensions,
    Animated,
    Vibration
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { navigationRef } from '../../utils/navigation';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import axios from '../../context/axiosConfig';
import Avatar from '../Avatar';

const { width } = Dimensions.get('window');

const ARENAS = [
    { name: 'DSA', icon: 'code-braces', color: ['#4f46e5', '#7c3aed'], description: 'Algorithms & Structures' },
    { name: 'Frontend', icon: 'monitor-edit', color: ['#db2777', '#ec4899'], description: 'Web UI & Experience' },
    { name: 'Backend', icon: 'server-network', color: ['#0891b2', '#06b6d4'], description: 'Server & Database' },
    { name: 'System Design', icon: 'hexagon-multiple-outline', color: ['#16a34a', '#22c55e'], description: 'Architecture & Scaling' },
    { name: 'DevOps', icon: 'infinity', color: ['#f59e0b', '#d97706'], description: 'Cloud & Kubernetes' },
    { name: 'Cyber Security', icon: 'shield-lock', color: ['#ef4444', '#b91c1c'], description: 'Hacking & Defense' }
];

const OneVsOneSetup = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [domain, setDomain] = useState<string>("DSA");
    const [searching, setSearching] = useState<boolean>(false);
    const [stats, setStats] = useState<{ points: number, rank: number }>({ points: 0, rank: 0 });
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    // UI Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/quiz/arena-stats');
                setStats(res.data);
            } catch (err) {
                console.log("Fetch Stats error:", err);
            }
        };

        const fetchLeaderboard = async () => {
            try {
                const res = await axios.get('/quiz/top-gladiators');
                setLeaderboard(res.data);
            } catch (err) {
                console.log("Fetch Leaderboard error:", err);
            }
        };

        fetchStats();
        fetchLeaderboard();
    }, []);

    useEffect(() => {
        const onMatchFound = (data: any) => {
            const { matchRoomId, questions, opponent, endTime } = data;
            setSearching(false);

            // Fixed navigationRef problem by using navigation instance or ref check
            if (navigationRef.isReady()) {
                navigationRef.navigate("QuizScreen", {
                    questions,
                    roomId: matchRoomId,
                    mode: '1v1',
                    endTime,
                    opponent
                });
            } else {
                navigation.navigate("QuizScreen", {
                    questions,
                    roomId: matchRoomId,
                    mode: '1v1',
                    endTime,
                    opponent
                });
            }
        };

        socket.on("match_found", onMatchFound);
        return () => {
            socket.off("match_found", onMatchFound);
        };
    }, []);

    useEffect(() => {
        if (searching) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [searching]);

    const findMatch = () => {
        if (!user?._id) return Alert.alert("Join Fync", "Please register to participate in the Arena.");
        Vibration.vibrate(50);
        setSearching(true);
        socket.emit("find_1v1_match", {
            user: { _id: user._id, username: user.username, avatar: user.avatar, name: user.name },
            domain
        });
    };

    if (searching) {
        return (
            <View className="flex-1 bg-[#F8FAFC]">
                <StatusBar barStyle="dark-content" />
                <SafeAreaView className="flex-1 justify-center items-center px-10">
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }} className="mb-10">
                        <View className="w-48 h-48 rounded-full border-4 border-pink-500/10 items-center justify-center">
                            <View className="w-40 h-40 rounded-full border-2 border-pink-500/20 items-center justify-center">
                                <View className="w-32 h-32 rounded-full bg-pink-50 items-center justify-center">
                                    <ActivityIndicator size="large" color="#ec4899" />
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    <Text className="text-zinc-900 text-3xl font-black  tracking-tight text-center uppercase">
                        Locating <Text className="text-pink-500">Rival</Text>
                    </Text>
                    <Text className="text-slate-400 text-xs mt-4 text-center px-4 tracking-widest uppercase font-bold">
                        Searching {domain} Arena...
                    </Text>

                    <View className="mt-20 w-full">
                        <TouchableOpacity
                            onPress={() => setSearching(false)}
                            className="w-full py-5 bg-white rounded-[30px] border border-slate-100 shadow-sm shadow-black/5"
                        >
                            <Text className="text-zinc-900 text-center font-black  uppercase tracking-widest text-xs">Abort Protocol</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1">
                {/* Header Profile */}
                <View className="px-8 py-4 flex-row justify-between items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm">
                        <Ionicons name="chevron-back" size={24} color="#18181b" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => navigation.navigate("Profile", { userId: user?._id })}
                        className="flex-row items-center bg-white pr-4 pl-1 py-1 rounded-full border border-slate-100 shadow-sm"
                    >
                        <Avatar user={user as any} size={30} />
                        <View className="ml-2">
                            <Text className="text-zinc-900 text-[10px] font-black uppercase  tracking-tighter">RANK #{stats.rank}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-8">
                    <View className="mt-6 mb-10">
                        <Text className="text-zinc-900 text-4xl font-black  uppercase tracking-tighter line-clamp-1">
                            Choose <Text className="text-pink-500">Arena</Text>
                        </Text>
                        <Text className="text-slate-400 mt-2 tracking-widest uppercase text-[10px] font-bold">Select your combat domain</Text>
                    </View>

                    {/* Arena Card System */}
                    <View className="flex-row flex-wrap justify-between">
                        {ARENAS.map((arena) => (
                            <TouchableOpacity
                                key={arena.name}
                                onPress={() => {
                                    setDomain(arena.name);
                                    Vibration.vibrate(10);
                                }}
                                style={{ width: (width - 80) / 2 }}
                                className={`p-6 rounded-[35px] mb-4 border transition-all ${domain === arena.name ? 'border-pink-500 bg-white shadow-xl shadow-pink-500/10' : 'border-slate-100 bg-white shadow-sm shadow-black/5'}`}
                            >
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center mb-4 ${domain === arena.name ? 'bg-pink-50' : 'bg-slate-50 border border-slate-100'}`}>
                                    <MaterialCommunityIcons
                                        name={arena.icon as any}
                                        size={24}
                                        color={domain === arena.name ? '#ec4899' : '#94a3b8'}
                                    />
                                </View>
                                <Text className={`font-black  uppercase text-[11px] ${domain === arena.name ? 'text-zinc-900' : 'text-slate-400'}`}>{arena.name}</Text>
                                <Text className="text-slate-400 text-[8px] mt-1 leading-3 font-bold uppercase" numberOfLines={2}>{arena.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Leaderboard Summary */}
                    <View className="mt-10 mb-20">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-zinc-900 text-lg font-black  uppercase tracking-tighter">Global Aces</Text>
                            <Ionicons name="trophy" size={20} color="#fbbf24" />
                        </View>

                        {leaderboard.slice(0, 5).map((player, index) => (
                            <View key={player._id} className="bg-white p-4 rounded-3xl border border-slate-100 flex-row items-center mb-2 shadow-sm shadow-black/5">
                                <Text className={`w-8 font-black  text-xs ${index === 0 ? 'text-amber-500' : 'text-slate-400'}`}>#{index + 1}</Text>
                                <Image source={{ uri: player.avatar || `https://ui-avatars.com/api/?name=${player.username}` }} className="w-10 h-10 rounded-xl mr-3 border border-slate-100" />
                                <View className="flex-1">
                                    <Text className="text-zinc-900 font-black  text-xs uppercase tracking-tight">{player.name || player.username}</Text>
                                    <Text className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">@{player.username}</Text>
                                </View>
                                <View className="bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
                                    <Text className="text-pink-500 font-black  text-[10px] uppercase">{player.oneVsOnePoints} PTS</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <View className="px-8 pb-10 pt-4">
                    <TouchableOpacity
                        onPress={findMatch}
                        activeOpacity={0.8}
                        className='flex-row items-center justify-center bg-pink-500 py-4 rounded-[30px] shadow-xl shadow-pink-500/20'
                    >
                        <Text className="text-white font-black  text-lg uppercase tracking-[4px] mr-3">Locate Rival</Text>
                        <Ionicons name="flash" size={22} color="white" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

export default OneVsOneSetup;
