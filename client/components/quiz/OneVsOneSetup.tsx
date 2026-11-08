import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StatusBar, Dimensions, Animated, Vibration } from 'react-native';
import { Image } from 'expo-image';
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
import { C } from '../../constants/colors';
import { AppBar, BottomBar, Button, Card, Divider, H1, Label, ListRow, SectionHeader } from '../ui/kit';

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
    // cancel_1v1_match races with the matcher, so a match can still arrive
    // after the user aborted. Only act on it while we're actually searching.
    const searchingRef = useRef(false);
    searchingRef.current = searching;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/quiz/arena-stats');
                setStats({ points: res.data?.points ?? 0, rank: res.data?.rank ?? 0 });
            } catch (err) {
                console.log("Fetch Stats error:", err);
            }
        };

        const fetchLeaderboard = async () => {
            try {
                const res = await axios.get('/quiz/top-gladiators');
                setLeaderboard(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.log("Fetch Leaderboard error:", err);
            }
        };

        fetchStats();
        fetchLeaderboard();
    }, []);

    useEffect(() => {
        const onMatchFound = (data: any) => {
            if (!searchingRef.current) return;
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

        // The server answers with "error" when matchmaking is down; without
        // this the searching screen spun forever.
        const onError = (msg: any) => {
            if (!searchingRef.current) return;
            setSearching(false);
            Alert.alert("Arena Unavailable", typeof msg === 'string' ? msg : "Please try again later.");
        };

        socket.on("match_found", onMatchFound);
        socket.on("error", onError);
        return () => {
            socket.off("match_found", onMatchFound);
            socket.off("error", onError);
        };
    }, []);

    useEffect(() => {
        if (!searching) {
            pulseAnim.setValue(1);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [searching]);

    // Leave the queue whenever searching ends (abort, match found — a no-op
    // server-side then), the screen blurs, or it unmounts.
    useEffect(() => {
        if (!searching) return;
        const unsubBlur = navigation.addListener('blur', () => setSearching(false));
        return () => {
            unsubBlur();
            socket.emit("cancel_1v1_match", { domain });
        };
    }, [searching, domain, navigation]);

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
                <StatusBar barStyle={C.barStyle} />
                <SafeAreaView className="flex-1 justify-center items-center px-gutter">
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }} className="mb-10">
                        <View className="w-40 h-40 rounded-full bg-paper-2 items-center justify-center">
                            <ActivityIndicator size="large" color={C.brand[500]} />
                        </View>
                    </Animated.View>

                    <H1 style={{ textAlign: 'center' }}>Finding a rival</H1>
                    <Text className="font-sans text-sm text-ink-3 mt-2 text-center px-4">
                        Searching the {domain} arena…
                    </Text>

                    <Button title="Cancel search" block onPress={() => setSearching(false)} style={{ marginTop: 48 }} />
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <AppBar title="Choose arena" onBack={() => navigation.goBack()} right={
                <Pressable
                    onPress={() => navigation.navigate("Profile", { userId: user?._id })}
                    className="flex-row items-center bg-paper-2 pr-3 pl-1 py-1 rounded-full active:opacity-85"
                    style={{ marginRight: 11, minHeight: 44 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Your rank ${stats.rank}. Open profile`}
                >
                    <Avatar user={user as any} size={32} />
                    <Text className="text-ink text-xs font-semibold ml-2">Rank #{stats.rank}</Text>
                </Pressable>
            } />

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="flex-1 px-gutter" contentContainerStyle={{ paddingBottom: 24 }}>
                <Label style={{ marginTop: 8, marginBottom: 12 }}>Pick a domain</Label>

                <View className="flex-row flex-wrap justify-between">
                    {ARENAS.map((arena) => {
                        const on = domain === arena.name;
                        return (
                            <Pressable
                                key={arena.name}
                                onPress={() => {
                                    setDomain(arena.name);
                                    Vibration.vibrate(10);
                                }}
                                style={{ width: (width - 52) / 2 }}
                                className={`p-4 rounded-2xl mb-3 bg-card active:opacity-85 ${on ? 'border-2 border-brand-500' : 'border border-line'}`}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                                accessibilityLabel={`${arena.name}. ${arena.description}`}
                            >
                                <View className="flex-row items-start justify-between mb-3">
                                    <View className={`w-11 h-11 rounded-full items-center justify-center ${on ? 'bg-brand-50' : 'bg-paper-2'}`}>
                                        <MaterialCommunityIcons name={arena.icon as any} size={22} color={on ? C.brand[500] : C.ink} />
                                    </View>
                                    {on ? <Ionicons name="checkmark-circle" size={20} color={C.brand[500]} /> : null}
                                </View>
                                <Text className="font-semibold text-sm text-ink">{arena.name}</Text>
                                <Text className="text-ink-3 text-xs mt-1" numberOfLines={2}>{arena.description}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Leaderboard summary */}
                {leaderboard.length > 0 ? (
                    <>
                        <SectionHeader title="Top players" right={<Ionicons name="trophy-outline" size={20} color={C.warning} />} />
                        <Card style={{ paddingHorizontal: 16 }}>
                            {leaderboard.slice(0, 5).map((player, index) => (
                                <React.Fragment key={player._id ?? index}>
                                    {index > 0 ? <Divider /> : null}
                                    <ListRow
                                        leading={
                                            <View className="flex-row items-center" style={{ gap: 8 }}>
                                                <Text className={`w-7 font-display text-sm ${index === 0 ? 'text-warning' : 'text-ink-3'}`}>#{index + 1}</Text>
                                                <Image source={{ uri: player.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.username || '')}` }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.paper2 }} cachePolicy="memory-disk" />
                                            </View>
                                        }
                                        title={player.name || player.username}
                                        subtitle={`@${player.username}`}
                                        right={<Text className="text-accent-text font-semibold text-xs">{player.oneVsOnePoints} pts</Text>}
                                    />
                                </React.Fragment>
                            ))}
                        </Card>
                    </>
                ) : null}
            </ScrollView>

            <BottomBar>
                <Button title="Find a rival" icon="flash" variant="primary" block onPress={findMatch} />
            </BottomBar>
        </View>
    );
};

export default OneVsOneSetup;
