import React, { useState, useEffect, useRef } from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Dimensions, Vibration, BackHandler, AppState, AppStateStatus, StatusBar, Animated, ScrollView} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import { Alert } from '../ui/AlertModal';

const { width, height } = Dimensions.get('window');

type SessionType = 'work' | 'study' | 'creative' | 'core';

const SESSION_THEMES = {
    work: { label: 'Working', colors: ['#4F46E5', '#7C3AED'], icon: 'briefcase', quote: 'Deep work produces results.' },
    study: { label: 'Studying', colors: ['#0891B2', '#0891B2'], icon: 'book', quote: 'Knowledge is power.' },
    creative: { label: 'Creating', colors: ['#DB2777', '#F97316'], icon: 'color-palette', quote: 'Unleash your imagination.' },
    core: { label: 'Core Focus', colors: ['#047857', '#047857'], icon: 'flash', quote: 'Concentration is the key.' }
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
                    text1: 'ZONE LOCKED',
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
        Alert.alert("ZONE BREACHED!", reason, [{ text: "I Accept", style: "destructive", onPress: () => setActiveTab('setup') }]);
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

    // The tree that grows through the session. Was three emoji, which render at a
    // different size and style on every OS version and cannot take a token —
    // on the one element this screen is built around.
    const getTreeStage = (): { name: any; size: number; color: string } => {
        const progress = seconds <= 0 ? 1 : 1 - (seconds / initialSeconds);
        if (progress < 0.25) return { name: 'leaf-outline', size: 44, color: '#C4BEB6' };
        if (progress < 0.5)  return { name: 'leaf-outline', size: 58, color: '#8B857E' };
        if (progress < 0.75) return { name: 'leaf', size: 68, color: '#34A853' };
        return { name: 'leaf', size: 76, color: '#047857' };
    };

    const renderSetup = () => (
        <View className="flex-1 px-gutter pt-10">
            <View className="flex-row justify-between items-center mb-10">
                <View>
                    <Text className="text-ink text-3xl font-display uppercase leading-tight">Focus <Text className="text-success">Forest</Text></Text>
                    <Text className="text-ink-3 text-label font-display uppercase mt-1">Grow your productivity</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveTab('forest')} className="bg-success/10 w-12 h-12 rounded-card items-center justify-center border border-success/15">
                    <Ionicons name="leaf" size={24} color="#047857" />
                </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap justify-between gap-4">
                {(Object.keys(SESSION_THEMES) as SessionType[]).map((type) => (
                    <TouchableOpacity
                        key={type}
                        onPress={() => setSessionType(type)}
                        style={{ width: (width - 80) / 2 }}
                        className={`p-6 rounded-sheet border ${sessionType === type ? 'border-success bg-card' : 'border-line bg-card'}`}
                    >
                        <View className={`w-12 h-12 rounded-card items-center justify-center mb-4 ${sessionType === type ? 'bg-success' : 'bg-paper-2'}`}>
                            <Ionicons name={SESSION_THEMES[type].icon as any} size={24} color={sessionType === type ? 'white' : '#C4BEB6'} />
                        </View>
                        <Text className={`font-display text-label uppercasest ${sessionType === type ? 'text-ink' : 'text-ink-3'}`}>{SESSION_THEMES[type].label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="mt-16 items-center">
                <View className="flex-row items-center gap-10 mb-8">
                    <TouchableOpacity onPress={() => setSeconds(Math.max(60, seconds - 300))} className="w-14 h-14 rounded-card border border-line bg-card items-center justify-center">
                        <Ionicons name="remove" size={24} color="#12100E" />
                    </TouchableOpacity>
                    <Text className="text-ink text-6xl font-display">{Math.floor(seconds / 60)}</Text>
                    <TouchableOpacity onPress={() => setSeconds(seconds + 300)} className="w-14 h-14 rounded-card border border-line bg-card items-center justify-center">
                        <Ionicons name="add" size={24} color="#12100E" />
                    </TouchableOpacity>
                </View>
                <Text className="text-ink-3 uppercase text-label font-display">Minutes to Focus</Text>
            </View>

            {/* The screen's one stamped element. A primary action outside a card
                carries the stamp itself; inside a card it drops it, so the
                device stays unique per screen. Brand fill takes ink text —
                white on #F97316 is 2.1:1 and fails AA. */}
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={startSession}
                accessibilityRole="button"
                className="mt-auto mb-10 rounded-card border-2 border-ink bg-brand-500"
                style={{
                    shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0,
                    shadowOffset: { width: 4, height: 4 }, elevation: 0,
                }}
            >
                <View className="py-5 items-center justify-center">
                    <Text className="font-display text-ink uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Plant a Tree</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderActive = () => (
        <View className="flex-1 items-center justify-center px-gutter">
            <View className="absolute top-16 items-center">
                <Text className="font-semibold text-base text-ink mb-2">{SESSION_THEMES[sessionType].label} Session</Text>
                <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                    <Text className="text-ink-3 text-label font-display uppercase">Lockdown Active</Text>
                </View>
            </View>

            <AnimatedCircularProgress
                size={340}
                width={8}
                fill={((initialSeconds - seconds) / initialSeconds) * 100}
                tintColor={SESSION_THEMES[sessionType].colors[0]}
                backgroundColor="#EDE8E0"
                rotation={0}
                lineCap="round"
            >
                {() => (
                    <View className="items-center">
                        <Ionicons {...(() => { const t = getTreeStage(); return { name: t.name, size: t.size, color: t.color }; })()} style={{ marginBottom: 10 }} />
                        <Text className="text-ink text-5xl font-display">
                            {formatTime(seconds)}
                        </Text>
                        <Animated.Text style={{ opacity: fadeAnim }} className="font-sans text-sm text-ink-3 mt-4 text-center px-gutter">
                            "{currentQuote}"
                        </Animated.Text>
                    </View>
                )}
            </AnimatedCircularProgress>

            <View className="mt-16 w-full items-center">
                {seconds <= 0 ? (
                    <TouchableOpacity
                        onPress={() => { setActiveTab('setup'); setSeconds(25 * 60); }}
                        className="bg-ink px-gutter py-5 rounded-card"
                    >
                        <Text className="text-white font-display uppercase text-xs">Claim Tree</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={giveUp}
                        className="bg-danger/10 px-gutter py-4 rounded-full border border-danger/15 mt-4"
                    >
                        <Text className="text-danger text-label font-display uppercase">Give Up</Text>
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
                <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}><Text className="font-display text-label text-ink uppercase" style={{ letterSpacing: 1.4 }}>My Forest</Text><View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} /></View>

                <View className="flex-row justify-between mb-8">
                    <View className="bg-success/10 p-4 rounded-card flex-1 mr-2 items-center border border-success/15">
                        <Ionicons name="leaf" size={26} color="#047857" style={{ marginBottom: 4 }} />
                        <Text className="font-display text-h1 text-ink">{successfulTrees}</Text>
                        <Text className="text-ink-3 text-label font-display uppercase">Trees Grown</Text>
                    </View>
                    <View className="bg-paper-2 p-4 flex-1 mx-1 items-center border border-line rounded-md">
                        <Ionicons name="timer-outline" size={26} color="#57534E" style={{ marginBottom: 4 }} />
                        <Text className="font-display text-h1 text-ink">{totalMinutes}</Text>
                        <Text className="text-ink-3 text-label font-display uppercase">Total Mins</Text>
                    </View>
                    <View className="bg-danger/10 p-4 rounded-card flex-1 ml-2 items-center border border-danger/15">
                        <Ionicons name="leaf-outline" size={26} color="#DC2626" style={{ marginBottom: 4 }} />
                        <Text className="font-display text-h1 text-ink">{witheredTrees}</Text>
                        <Text className="text-ink-3 text-label font-display uppercase">Withered</Text>
                    </View>
                </View>

                <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}><Text className="font-display text-label text-ink uppercase" style={{ letterSpacing: 1.4 }}>Recent Sessions</Text><View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} /></View>

                <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                    {forestHistory.length === 0 ? (
                        <View className="items-center justify-center py-10 opacity-50">
                            <Ionicons name="leaf-outline" size={32} color="#C4BEB6" style={{ marginBottom: 12 }} />
                            <Text className="font-display text-label text-ink-3 uppercase">Your forest is empty</Text>
                            <Text className="font-sans text-sm text-ink-3 mt-2">Complete a focus session to plant a tree.</Text>
                        </View>
                    ) : (
                        forestHistory.map((item) => (
                            <View key={item.id} className="flex-row items-center justify-between bg-card p-4 rounded-card mb-3 border border-line">
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${item.status === 'success' ? 'bg-success/10' : 'bg-danger/10'}`}>
                                        <Ionicons name={item.status === 'success' ? 'leaf' : 'leaf-outline'} size={22} color={item.status === 'success' ? '#047857' : '#DC2626'} />
                                    </View>
                                    <View>
                                        <Text className="text-ink font-display text-sm">{SESSION_THEMES[item.type as SessionType].label}</Text>
                                        <Text className="text-ink-3 text-xs font-medium">{new Date(item.date).toLocaleDateString()} • {Math.floor(item.duration / 60)} mins</Text>
                                    </View>
                                </View>
                                <View className={`px-3 py-1 rounded-full ${item.status === 'success' ? 'bg-success/15' : 'bg-danger/15'}`}>
                                    <Text className={`text-label font-display uppercasest ${item.status === 'success' ? 'text-success' : 'text-danger'}`}>
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
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1" edges={['top']}>
                {!isAppLocked && (
                    <View className="px-gutter py-6 flex-row justify-between items-center">
                        <TouchableOpacity onPress={() => {
                            if (activeTab === 'forest') setActiveTab('setup');
                            else navigation.goBack();
                        }} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                            <Ionicons name={activeTab === 'forest' ? "arrow-back" : "close"} size={24} color="#12100E" />
                        </TouchableOpacity>
                        <View className="bg-card border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-label text-success font-display uppercase">Focus Forest</Text>
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
                        colors={['#F97316', '#F5B700', '#047857', '#7C3AED']}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({});
