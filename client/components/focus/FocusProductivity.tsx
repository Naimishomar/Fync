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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
//@ts-ignore
import KeepAwake from 'react-native-keep-awake';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width, height } = Dimensions.get('window');

type SessionType = 'work' | 'study' | 'creative' | 'core';

const SESSION_THEMES = {
    work: { label: 'Working', colors: ['#4f46e5', '#7c3aed'], icon: 'briefcase', quote: 'Deep work produces results.' },
    study: { label: 'Studying', colors: ['#0891b2', '#06b6d4'], icon: 'book', quote: 'Knowledge is power.' },
    creative: { label: 'Creating', colors: ['#db2777', '#ec4899'], icon: 'color-palette', quote: 'Unleash your imagination.' },
    core: { label: 'Core Focus', colors: ['#16a34a', '#22c55e'], icon: 'flash', quote: 'Concentration is the key.' }
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
    const [activeTab, setActiveTab] = useState<'setup' | 'session'>('setup');
    const [sessionType, setSessionType] = useState<SessionType>('work');
    const [seconds, setSeconds] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [isAppLocked, setIsAppLocked] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [currentQuote, setCurrentQuote] = useState(MOTIVATIONAL_QUOTES[0]);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const appState = useRef(AppState.currentState);
    const lastDistractionTime = useRef<number | null>(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

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
            KeepAwake.deactivate();
        };
    }, [isAppLocked]);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
            if (isActive && isAppLocked) {
                lastDistractionTime.current = Date.now();
                Vibration.vibrate([0, 500, 200, 500]);
            }
        } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            if (isActive && isAppLocked && lastDistractionTime.current) {
                // BREACH DETECTED - RESET
                setIsActive(false);
                setIsAppLocked(false);
                setActiveTab('setup');
                setSeconds(25 * 60);
                KeepAwake.deactivate();

                Alert.alert(
                    "🚨 ZONE BREACHED!",
                    "You minimized the app during a Mindful session. Lockdown protocol dictates a total reset. All progress is lost.",
                    [{ text: "I ACCEPT THE CONSEQUENCE.", style: "destructive" }]
                );
                lastDistractionTime.current = null;
            }
        }
        appState.current = nextAppState;
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
        KeepAwake.deactivate();
        setTimeout(() => setShowConfetti(false), 5000);
    };

    const startSession = () => {
        setActiveTab('session');
        setIsActive(true);
        setIsAppLocked(true);
        KeepAwake.activate();
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const renderSetup = () => (
        <View className="flex-1 px-8 pt-10">
            <Text className="text-white text-3xl font-black mb-2">Deep Focus</Text>
            <Text className="text-zinc-500 mb-10">Choose your intention for this session.</Text>

            <View className="flex-row flex-wrap justify-between gap-4">
                {(Object.keys(SESSION_THEMES) as SessionType[]).map((type) => (
                    <TouchableOpacity 
                        key={type}
                        onPress={() => setSessionType(type)}
                        style={{ width: (width - 80) / 2 }}
                        className={`p-6 rounded-[32px] border ${sessionType === type ? 'border-white bg-zinc-900' : 'border-zinc-800 bg-zinc-900/50'}`}
                    >
                        <View className={`w-12 h-12 rounded-2xl items-center justify-center mb-4 bg-zinc-800`}>
                            <Ionicons name={SESSION_THEMES[type].icon as any} size={24} color={sessionType === type ? 'white' : '#555'} />
                        </View>
                        <Text className={`font-bold ${sessionType === type ? 'text-white' : 'text-zinc-500'}`}>{SESSION_THEMES[type].label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="mt-12 items-center">
                <View className="flex-row items-center gap-8 mb-8">
                    <TouchableOpacity onPress={() => setSeconds(Math.max(60, seconds - 300))} className="w-12 h-12 rounded-full border border-zinc-800 items-center justify-center">
                        <Ionicons name="remove" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white text-5xl font-black">{Math.floor(seconds / 60)}</Text>
                    <TouchableOpacity onPress={() => setSeconds(seconds + 300)} className="w-12 h-12 rounded-full border border-zinc-800 items-center justify-center">
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>
                <Text className="text-zinc-500 uppercase tracking-widest text-xs font-bold">Minutes to Focus</Text>
            </View>

            <TouchableOpacity 
                onPress={startSession}
                className="mt-auto mb-10 overflow-hidden rounded-full flex-row justify-center bg-pink-500 py-3"
            >
                <Text className="text-white font-black text-lg uppercase">Initiate Lockdown</Text>
            </TouchableOpacity>
        </View>
    );

    const renderActive = () => (
        <View className="flex-1 items-center justify-center px-8">
            <View className="absolute top-16 items-center">
                <Ionicons name={SESSION_THEMES[sessionType].icon as any} size={32} color={SESSION_THEMES[sessionType].colors[0]} />
                <Text className="text-white font-bold mt-2 uppercase tracking-widest">{SESSION_THEMES[sessionType].label} Mode</Text>
            </View>

            <AnimatedCircularProgress
                size={340}
                width={4}
                fill={(seconds / (seconds + 1)) * 100}
                tintColor={SESSION_THEMES[sessionType].colors[0]}
                backgroundColor="#111"
                rotation={0}
                lineCap="round"
            >
                {() => (
                    <View className="items-center">
                        <Text className="text-white text-8xl font-black tracking-tighter">
                            {formatTime(seconds)}
                        </Text>
                        <Animated.Text style={{ opacity: fadeAnim }} className="text-zinc-500 text-xs mt-4 text-center px-10">
                            "{currentQuote}"
                        </Animated.Text>
                    </View>
                )}
            </AnimatedCircularProgress>

            <View className="mt-20 items-center">
                <Text className="text-zinc-600 text-[10px] uppercase tracking-[4px] mb-8">System Secured • Do not minimize</Text>
                
                {seconds <= 0 ? (
                     <TouchableOpacity 
                        onPress={() => setActiveTab('setup')}
                        className="bg-white px-10 py-4 rounded-full"
                    >
                        <Text className="text-black font-black uppercase">Finish Session</Text>
                    </TouchableOpacity>
                ) : (
                    <Text className="text-white/20 text-xs italic">Exit disabled during focus</Text>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
            <StatusBar barStyle="light-content" />
            
            {!isAppLocked && (
                <View className="px-6 py-4 flex-row justify-between items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    <View className="bg-zinc-900 px-3 py-1 rounded-full border border-white/5">
                        <Text className="text-[10px] text-zinc-400 font-bold uppercase">Mindful Focus</Text>
                    </View>
                    <TouchableOpacity className="p-2 opacity-0">
                        <Ionicons name="settings-outline" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            )}

            <View className="flex-1">
                {activeTab === 'setup' ? renderSetup() : renderActive()}
            </View>

            {showConfetti && (
                <ConfettiCannon 
                    count={200} 
                    origin={{x: width/2, y: height}} 
                    fadeOut={true}
                    colors={['#ec4899', '#7c3aed', '#3b82f6']}
                />
            )}
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({});
