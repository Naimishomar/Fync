import React, { useState, useEffect, useRef } from 'react';
import {View, Text, ActivityIndicator, TouchableOpacity, ScrollView, StatusBar, Image, Dimensions, Animated, Vibration} from 'react-native'
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { navigationRef } from '../../utils/navigation';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import axios from '../../context/axiosConfig';
import Avatar from '../Avatar';
import { Alert } from '../ui/AlertModal';

const { width } = Dimensions.get('window');

const ARENAS = [
    { name: 'DSA', icon: 'code-braces', color: ['#4f46e5', '#7c3aed'], description: 'Algorithms & Structures' },
    { name: 'Frontend', icon: 'monitor-edit', color: ['#db2777', '#F97316'], description: 'Web UI & Experience' },
    { name: 'Backend', icon: 'server-network', color: ['#0891b2', '#0891B2'], description: 'Server & Database' },
    { name: 'System Design', icon: 'hexagon-multiple-outline', color: ['#047857', '#047857'], description: 'Architecture & Scaling' },
    { name: 'DevOps', icon: 'infinity', color: ['#B45309', '#B45309'], description: 'Cloud & Kubernetes' },
    { name: 'Cyber Security', icon: 'shield-lock', color: ['#DC2626', '#DC2626'], description: 'Hacking & Defense' }
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
            <View className="flex-1 bg-paper">
                <StatusBar barStyle="dark-content" />
                <SafeAreaView className="flex-1 justify-center items-center px-gutter">
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }} className="mb-10">
                        <View className="w-48 h-48 rounded-full border-4 border-brand-500/10 items-center justify-center">
                            <View className="w-40 h-40 rounded-full border-2 border-brand-500/20 items-center justify-center">
                                <View className="w-32 h-32 rounded-full bg-brand-50 items-center justify-center">
                                    <ActivityIndicator size="large" color="#F97316" />
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    <Text className="text-ink text-3xl font-display text-center uppercase">
                        Locating <Text className="text-accent-text">Rival</Text>
                    </Text>
                    <Text className="font-sans text-sm text-ink-3 mt-4 text-center px-4">
                        Searching {domain} Arena...
                    </Text>

                    <View className="mt-20 w-full">
                        <TouchableOpacity
                            onPress={() => setSearching(false)}
                            className="w-full py-5 bg-card rounded-card border border-line shadow-hair"
                        >
                            <Text className="font-semibold text-base text-ink text-center">Abort Protocol</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1">
                {/* Header Profile */}
                <View className="px-gutter py-4 flex-row justify-between items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                        <Ionicons name="chevron-back" size={24} color="#12100E" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => navigation.navigate("Profile", { userId: user?._id })}
                        className="flex-row items-center bg-card pr-4 pl-1 py-1 rounded-full border border-line shadow-hair"
                    >
                        <Avatar user={user as any} size={30} />
                        <View className="ml-2">
                            <Text className="text-ink text-label font-display uppercase">RANK #{stats.rank}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-gutter">
                    <View className="mt-6 mb-10">
                        <Text className="text-ink text-4xl font-display uppercase line-clamp-1">
                            Choose <Text className="text-accent-text">Arena</Text>
                        </Text>
                        <Text className="text-ink-3 mt-2 uppercase text-label font-semibold">Select your combat domain</Text>
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
                                className={`p-6 rounded-sheet mb-4 border transition-all ${domain === arena.name ? 'border-brand-500 bg-card shadow-hair ' : 'border-line bg-card shadow-hair '}`}
                            >
                                <View className={`w-12 h-12 rounded-card items-center justify-center mb-4 ${domain === arena.name ? 'bg-brand-50' : 'bg-paper-2 border border-line'}`}>
                                    <MaterialCommunityIcons
                                        name={arena.icon as any}
                                        size={24}
                                        color={domain === arena.name ? '#F97316' : '#8B857E'}
                                    />
                                </View>
                                <Text className={`font-display uppercase text-label ${domain === arena.name ? 'text-ink' : 'text-ink-3'}`}>{arena.name}</Text>
                                <Text className="text-ink-3 text-label mt-1 leading-3 font-semibold uppercase" numberOfLines={2}>{arena.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Leaderboard Summary */}
                    <View className="mt-10 mb-20">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-ink text-lg font-display uppercase">Global Aces</Text>
                            <Ionicons name="trophy" size={20} color="#B45309" />
                        </View>

                        {leaderboard.slice(0, 5).map((player, index) => (
                            <View key={player._id} className="bg-card p-4 rounded-card border border-line flex-row items-center mb-2 shadow-hair">
                                <Text className={`w-8 font-display text-xs ${index === 0 ? 'text-warning' : 'text-ink-3'}`}>#{index + 1}</Text>
                                <Image source={{ uri: player.avatar || `https://ui-avatars.com/api/?name=${player.username}` }} className="w-10 h-10 rounded-xl mr-3 border border-line" />
                                <View className="flex-1">
                                    <Text className="font-semibold text-base text-ink">{player.name || player.username}</Text>
                                    <Text className="text-ink-3 text-label font-semibold uppercase">@{player.username}</Text>
                                </View>
                                <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                    <Text className="text-accent-text font-display text-label uppercase">{player.oneVsOnePoints} PTS</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <View className="px-gutter pb-10 pt-4">
                    <TouchableOpacity
                        onPress={findMatch}
                        activeOpacity={0.8}
                        className='flex-row items-center justify-center bg-brand-500 border-2 border-ink py-4 rounded-card'
                    >
                        <Text className="text-ink font-display text-lg uppercase mr-3">Locate Rival</Text>
                        <Ionicons name="flash" size={22} color="#12100E" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

export default OneVsOneSetup;
