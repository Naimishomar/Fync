import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Vibration,
    BackHandler,
    AppState,
    AppStateStatus,
    Alert,
    StatusBar,
    Animated,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
//@ts-ignore
import KeepAwake from 'react-native-keep-awake';
import { useNavigation } from '@react-navigation/native';

// Safe wrapper to prevent crashes if module is missing
const safeActivate = () => { try { KeepAwake?.activate?.(); } catch (e) { } };
const safeDeactivate = () => { try { KeepAwake?.deactivate?.(); } catch (e) { } };
import Toast from 'react-native-toast-message';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

type SessionType = 'work' | 'study' | 'creative' | 'core';

const SESSION_THEMES = {
    work: { label: 'Working', colors: ['#4f46e5', '#7c3aed'], icon: 'briefcase', quote: 'Deep work produces results.', tree: '🌲' },
    study: { label: 'Studying', colors: ['#0891b2', '#06b6d4'], icon: 'book', quote: 'Knowledge is power.', tree: '🌳' },
    creative: { label: 'Creating', colors: ['#db2777', '#ec4899'], icon: 'color-palette', quote: 'Unleash your imagination.', tree: '🌸' },
    core: { label: 'Core Focus', colors: ['#16a34a', '#22c55e'], icon: 'flash', quote: 'Concentration is the key.', tree: '🌵' }
};

const MOTIVATIONAL_QUOTES = [
    "Focus on being productive instead of busy.",
    "Don't stop until you're proud.",
    "Stay focused, go after your dreams.",
    "Small progress is still progress.",
    "Your future self will thank you for this.",
    "One thing at a time.",
];

export default function FocusProductivity() {
    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState<'setup' | 'session' | 'forest'>('setup');
    const [sessionType, setSessionType] = useState<SessionType>('work');
    const [seconds, setSeconds] = useState(25 * 60);
    const [initialSeconds, setInitialSeconds] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [isAppLocked, setIsAppLocked] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [currentQuote, setCurrentQuote] = useState(MOTIVATIONAL_QUOTES[0]);
    const [forestHistory, setForestHistory] = useState<any[]>([]);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const appState = useRef(AppState.currentState);
    const lastDistractionTime = useRef<number | null>(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await AsyncStorage.getItem('@focus_forest_history');
            if (data) {
                setForestHistory(JSON.parse(data));
            }
        } catch (e) {
            console.error("Failed to load forest history", e);
        }
    };

    const saveSessionToHistory = async (status: 'success' | 'failed') => {
        const newSession = {
            id: Date.now().toString(),
            type: sessionType,
            duration: initialSeconds,
            status,
            date: new Date().toISOString()
        };
        const updatedHistory = [newSession, ...forestHistory];
        setForestHistory(updatedHistory);
        try {
            await AsyncStorage.setItem('@focus_forest_history', JSON.stringify(updatedHistory));
        } catch (e) {
            console.error("Failed to save session", e);
        }
    };

    useEffect(() => {
        const backAction = () => {
            if (isAppLocked) {
                Vibration.vibrate(500);
                Toast.show({
                    type: 'error',
                    text1: 'ZONE LOCKED 🔒',
                    text2: 'Finish your mission to exit.',
                    position: 'bottom'
                });
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            backHandler.remove();
            subscription.remove();
            if (timerRef.current) clearInterval(timerRef.current);
            safeDeactivate();
        };
    }, [isAppLocked, forestHistory]);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
            if (isActive && isAppLocked) {
                lastDistractionTime.current = Date.now();
                Vibration.vibrate([0, 500, 200, 500]);
            }
        } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            if (isActive && isAppLocked && lastDistractionTime.current) {
                handleFail("You minimized the app. Your tree has withered.");
                lastDistractionTime.current = null;
            }
        }
        appState.current = nextAppState;
    };

    const handleFail = (reason: string) => {
        setIsActive(false);
        setIsAppLocked(false);
        safeDeactivate();
        saveSessionToHistory('failed');
        Alert.alert("🚨 ZONE BREACHED!", reason, [{ text: "I Accept", style: "destructive", onPress: () => setActiveTab('setup') }]);
    };

    useEffect(() => {
        if (isActive && seconds > 0) {
            timerRef.current = setInterval(() => {
                setSeconds((prev) => prev - 1);
                if (seconds % 60 === 0) {
                    rotateQuote();
                }
            }, 1000);
        } else if (seconds <= 0 && isActive) {
            handleSessionComplete();
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, seconds]);

    const rotateQuote = () => {
        const nextQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ]).start();
        setCurrentQuote(nextQuote);
    };

    const handleSessionComplete = () => {
        setIsActive(false);
        setIsAppLocked(false);
        setShowConfetti(true);
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);
        safeDeactivate();
        saveSessionToHistory('success');
        setTimeout(() => setShowConfetti(false), 5000);
    };

    const startSession = () => {
        setInitialSeconds(seconds);
        setActiveTab('session');
        setIsActive(true);
        setIsAppLocked(true);
        safeActivate();
    };

    const giveUp = () => {
        Alert.alert(
            "Give Up?",
            "Are you sure you want to stop? Your tree will wither and die.",
            [
                { text: "Keep Going", style: "cancel" },
                { text: "Give Up", style: "destructive", onPress: () => handleFail("You gave up. Your tree has withered.") }
            ]
        );
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const getTreeStage = () => {
        if (seconds <= 0) return SESSION_THEMES[sessionType].tree;
        const progress = 1 - (seconds / initialSeconds);
        if (progress < 0.25) return '🌱';
        if (progress < 0.5) return '🌿';
        if (progress < 0.75) return '🪴';
        return SESSION_THEMES[sessionType].tree;
    };

    const renderSetup = () => (
        <View className="flex-1 px-8 pt-10">
            <View className="flex-row justify-between items-center mb-10">
                <View>
                    <Text className="text-zinc-900 text-3xl font-black uppercase tracking-tighter leading-tight">Focus <Text className="text-green-500">Forest</Text></Text>
                    <Text className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1">Grow your productivity</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveTab('forest')} className="bg-green-50 w-12 h-12 rounded-2xl items-center justify-center border border-green-100">
                    <Ionicons name="leaf" size={24} color="#22c55e" />
                </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap justify-between gap-4">
                {(Object.keys(SESSION_THEMES) as SessionType[]).map((type) => (
                    <TouchableOpacity
                        key={type}
                        onPress={() => setSessionType(type)}
                        style={{ width: (width - 80) / 2 }}
                        className={`p-6 rounded-[32px] border ${sessionType === type ? 'border-green-500 bg-white' : 'border-slate-100 bg-white'}`}
                    >
                        <View className={`w-12 h-12 rounded-2xl items-center justify-center mb-4 ${sessionType === type ? 'bg-green-500' : 'bg-slate-50'}`}>
                            <Ionicons name={SESSION_THEMES[type].icon as any} size={24} color={sessionType === type ? 'white' : '#CBD5E1'} />
                        </View>
                        <Text className={`font-black uppercase text-[10px] tracking-widest ${sessionType === type ? 'text-zinc-900' : 'text-slate-400'}`}>{SESSION_THEMES[type].label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="mt-16 items-center">
                <View className="flex-row items-center gap-10 mb-8">
                    <TouchableOpacity onPress={() => setSeconds(Math.max(60, seconds - 300))} className="w-14 h-14 rounded-2xl border border-slate-100 bg-white items-center justify-center">
                        <Ionicons name="remove" size={24} color="#18181b" />
                    </TouchableOpacity>
                    <Text className="text-zinc-900 text-6xl font-black tracking-tighter">{Math.floor(seconds / 60)}</Text>
                    <TouchableOpacity onPress={() => setSeconds(seconds + 300)} className="w-14 h-14 rounded-2xl border border-slate-100 bg-white items-center justify-center">
                        <Ionicons name="add" size={24} color="#18181b" />
                    </TouchableOpacity>
                </View>
                <Text className="text-slate-400 uppercase tracking-[4px] text-[10px] font-black">Minutes to Focus</Text>
            </View>

            <TouchableOpacity
                activeOpacity={0.8}
                onPress={startSession}
                className="mt-auto mb-10 overflow-hidden rounded-[24px]"
            >
                <LinearGradient
                    colors={['#22c55e', '#15803d']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    className="py-5 items-center justify-center"
                >
                    <Text className="text-white font-black text-xs uppercase tracking-widest">Plant a Tree</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderActive = () => (
        <View className="flex-1 items-center justify-center px-8">
            <View className="absolute top-16 items-center">
                <Text className="text-zinc-900 font-black uppercase tracking-widest text-xs mb-2">{SESSION_THEMES[sessionType].label} Session</Text>
                <View className="bg-slate-50 px-4 py-1.5 rounded-full border border-slate-200">
                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Lockdown Active</Text>
                </View>
            </View>

            <AnimatedCircularProgress
                size={340}
                width={8}
                fill={((initialSeconds - seconds) / initialSeconds) * 100}
                tintColor={SESSION_THEMES[sessionType].colors[0]}
                backgroundColor="#f1f5f9"
                rotation={0}
                lineCap="round"
            >
                {() => (
                    <View className="items-center">
                        <Text style={{ fontSize: 72, marginBottom: 10 }}>{getTreeStage()}</Text>
                        <Text className="text-zinc-900 text-5xl font-black tracking-tighter">
                            {formatTime(seconds)}
                        </Text>
                        <Animated.Text style={{ opacity: fadeAnim }} className="text-slate-400 text-[10px] font-black uppercase mt-4 text-center px-8 tracking-widest leading-5">
                            "{currentQuote}"
                        </Animated.Text>
                    </View>
                )}
            </AnimatedCircularProgress>

            <View className="mt-16 w-full items-center">
                {seconds <= 0 ? (
                    <TouchableOpacity
                        onPress={() => { setActiveTab('setup'); setSeconds(25 * 60); }}
                        className="bg-zinc-900 px-12 py-5 rounded-[24px]"
                    >
                        <Text className="text-white font-black uppercase tracking-widest text-xs">Claim Tree</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={giveUp}
                        className="bg-red-50 px-8 py-4 rounded-full border border-red-100 mt-4"
                    >
                        <Text className="text-red-500 text-[10px] font-black uppercase tracking-widest">Give Up</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderForest = () => {
        const totalMinutes = forestHistory.reduce((acc, curr) => curr.status === 'success' ? acc + Math.floor(curr.duration / 60) : acc, 0);
        const successfulTrees = forestHistory.filter(h => h.status === 'success').length;
        const witheredTrees = forestHistory.filter(h => h.status === 'failed').length;

        return (
            <View className="flex-1 px-6 pt-6">
                <Text className="text-zinc-900 text-2xl font-black uppercase tracking-tighter mb-6">My Forest</Text>

                <View className="flex-row justify-between mb-8">
                    <View className="bg-green-50 p-4 rounded-3xl flex-1 mr-2 items-center border border-green-100">
                        <Text className="text-3xl mb-1">🌲</Text>
                        <Text className="text-zinc-900 text-xl font-black">{successfulTrees}</Text>
                        <Text className="text-slate-500 text-[9px] uppercase font-black tracking-widest">Trees Grown</Text>
                    </View>
                    <View className="bg-slate-50 p-4 rounded-3xl flex-1 mx-1 items-center border border-slate-100">
                        <Text className="text-3xl mb-1">⏱️</Text>
                        <Text className="text-zinc-900 text-xl font-black">{totalMinutes}</Text>
                        <Text className="text-slate-500 text-[9px] uppercase font-black tracking-widest">Total Mins</Text>
                    </View>
                    <View className="bg-red-50 p-4 rounded-3xl flex-1 ml-2 items-center border border-red-100">
                        <Text className="text-3xl mb-1">🥀</Text>
                        <Text className="text-zinc-900 text-xl font-black">{witheredTrees}</Text>
                        <Text className="text-slate-500 text-[9px] uppercase font-black tracking-widest">Withered</Text>
                    </View>
                </View>

                <Text className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-4">Recent Sessions</Text>

                <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                    {forestHistory.length === 0 ? (
                        <View className="items-center justify-center py-10 opacity-50">
                            <Text className="text-4xl mb-4">🌱</Text>
                            <Text className="text-slate-400 font-bold">Your forest is empty.</Text>
                            <Text className="text-slate-400 text-xs">Complete a focus session to plant a tree.</Text>
                        </View>
                    ) : (
                        forestHistory.map((item) => (
                            <View key={item.id} className="flex-row items-center justify-between bg-white p-4 rounded-2xl mb-3 border border-slate-100">
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${item.status === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                                        <Text className="text-2xl">{item.status === 'success' ? SESSION_THEMES[item.type as SessionType].tree : '🥀'}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-zinc-900 font-black text-sm">{SESSION_THEMES[item.type as SessionType].label}</Text>
                                        <Text className="text-slate-400 text-xs font-medium">{new Date(item.date).toLocaleDateString()} • {Math.floor(item.duration / 60)} mins</Text>
                                    </View>
                                </View>
                                <View className={`px-3 py-1 rounded-full ${item.status === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <Text className={`text-[10px] font-black uppercase tracking-widest ${item.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                        {item.status}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                    <View className="h-10" />
                </ScrollView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            <View className="absolute top-0 w-full h-80 opacity-20">
                <LinearGradient colors={['#22c55e', 'transparent']} className="w-full h-full" />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                {!isAppLocked && (
                    <View className="px-8 py-6 flex-row justify-between items-center">
                        <TouchableOpacity onPress={() => {
                            if (activeTab === 'forest') setActiveTab('setup');
                            else navigation.goBack();
                        }} className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-slate-100">
                            <Ionicons name={activeTab === 'forest' ? "arrow-back" : "close"} size={24} color="#18181b" />
                        </TouchableOpacity>
                        <View className="bg-white px-4 py-2 rounded-full border border-slate-100">
                            <Text className="text-[10px] text-green-500 font-black uppercase tracking-widest">Focus Forest</Text>
                        </View>
                        <View className="w-12 h-12 opacity-0" />
                    </View>
                )}

                <View className="flex-1">
                    {activeTab === 'setup' && renderSetup()}
                    {activeTab === 'session' && renderActive()}
                    {activeTab === 'forest' && renderForest()}
                </View>

                {showConfetti && (
                    <ConfettiCannon
                        count={200}
                        origin={{ x: width / 2, y: height }}
                        fadeOut={true}
                        colors={['#22c55e', '#15803d', '#4ade80']}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({});
