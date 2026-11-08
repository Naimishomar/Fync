import React, { useState, useEffect, useRef } from 'react';
import {View, Text, Pressable, Dimensions, Vibration, BackHandler, AppState, AppStateStatus, StatusBar, Animated, FlatList} from 'react-native'
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
import { C } from '../../constants/colors';
import { AppBar, Button, Card, Empty, IconBtn, IconTile, Label, ListRow, Num, SectionHeader, Tag } from '../ui/kit';
import { useBottomInset } from '../../constants/layout';

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
    const bottomInset = useBottomInset();

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
        // Functional update: this runs from AppState/back handlers whose closure
        // may predate the latest history.
        setForestHistory((prev) => {
            const updatedHistory = [newSession, ...prev];
            AsyncStorage.setItem('@focus_forest_history', JSON.stringify(updatedHistory))
                .catch((e) => console.error("Failed to save session", e));
            return updatedHistory;
        });
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
        return () => backHandler.remove();
    }, [isAppLocked]);

    // Registered once and routed through a ref so it always sees the current
    // session. Re-subscribing on state changes used to run the cleanup below
    // right after startSession — turning keep-awake off the moment it went on.
    const appStateHandler = useRef<(s: AppStateStatus) => void>(() => {});
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (s) => appStateHandler.current(s));
        return () => {
            subscription.remove();
            if (timerRef.current) clearInterval(timerRef.current);
            safeDeactivate();
        };
    }, []);

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
    appStateHandler.current = handleAppStateChange;

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
        if (progress < 0.25) return { name: 'leaf-outline', size: 44, color: C.ink4 };
        if (progress < 0.5)  return { name: 'leaf-outline', size: 58, color: C.ink3 };
        if (progress < 0.75) return { name: 'leaf', size: 68, color: '#34A853' };
        return { name: 'leaf', size: 76, color: C.success };
    };

    const renderSetup = () => (
        <View className="flex-1 px-gutter pt-4">

            <View className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
                {(Object.keys(SESSION_THEMES) as SessionType[]).map((type) => (
                    <Pressable
                        key={type}
                        onPress={() => setSessionType(type)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: sessionType === type }}
                        style={{ width: (width - 52) / 2 }}
                        className={`p-4 rounded-2xl border bg-card active:opacity-70 ${sessionType === type ? 'border-success' : 'border-line'}`}
                    >
                        <View className="flex-row items-center justify-between mb-4">
                            <IconTile
                                icon={SESSION_THEMES[type].icon as any}
                                size={48}
                                bg={sessionType === type ? C.success : undefined}
                                color={sessionType === type ? C.paper : C.ink3}
                            />
                            {sessionType === type && <Ionicons name="checkmark-circle" size={20} color={C.success} />}
                        </View>
                        <Text className={`font-semibold text-sm ${sessionType === type ? 'text-ink' : 'text-ink-3'}`}>{SESSION_THEMES[type].label}</Text>
                    </Pressable>
                ))}
            </View>

            <View className="mt-16 items-center">
                <View className="flex-row items-center gap-10 mb-8">
                    <IconBtn name="remove" boxed size={24} accessibilityLabel="Five minutes less" onPress={() => setSeconds(Math.max(60, seconds - 300))} />
                    <Text className="text-ink text-6xl font-display">{Math.floor(seconds / 60)}</Text>
                    <IconBtn name="add" boxed size={24} accessibilityLabel="Five minutes more" onPress={() => setSeconds(seconds + 300)} />
                </View>
                <Label>Minutes to focus</Label>
            </View>

            {/* Clears a 3-button nav bar / gesture pill, not a fixed 40. */}
            <Button
                variant="primary"
                block
                icon="leaf"
                title="Plant a tree"
                onPress={startSession}
                style={{ marginTop: 'auto', marginBottom: Math.max(40, bottomInset + 16) }}
            />
        </View>
    );

    const renderActive = () => (
        <View className="flex-1 items-center justify-center px-gutter">
            <View className="absolute top-16 items-center">
                <Text className="font-semibold text-base text-ink mb-2">{SESSION_THEMES[sessionType].label} Session</Text>
                <Tag label="Lockdown active" icon="lock-closed" />
            </View>

            <AnimatedCircularProgress
                size={Math.min(340, width - 40)}
                width={8}
                fill={((initialSeconds - seconds) / initialSeconds) * 100}
                tintColor={SESSION_THEMES[sessionType].colors[0]}
                backgroundColor={C.paper2}
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
                            &ldquo;{currentQuote}&rdquo;
                        </Animated.Text>
                    </View>
                )}
            </AnimatedCircularProgress>

            <View className="mt-16 w-full items-center">
                {seconds <= 0 ? (
                    <Button variant="solid" icon="leaf" title="Claim tree" onPress={() => { setActiveTab('setup'); setSeconds(25 * 60); }} />
                ) : (
                    <Button variant="tertiary" title="Give up" onPress={giveUp} style={{ marginTop: 16 }} />
                )}
            </View>
        </View>
    );

    const renderForest = () => {
        const totalMinutes = forestHistory.reduce((acc, curr) => curr.status === 'success' ? acc + Math.floor(curr.duration / 60) : acc, 0);
        const successfulTrees = forestHistory.filter(h => h.status === 'success').length;
        const witheredTrees = forestHistory.filter(h => h.status === 'failed').length;

        return (
            <View className="flex-1 px-gutter pt-6">
                <SectionHeader title="My forest" style={{ marginTop: 0 }} />

                <View className="flex-row mb-4" style={{ gap: 12 }}>
                    <Card padded style={{ flex: 1, alignItems: 'center' }}>
                        <Ionicons name="leaf" size={24} color={C.success} style={{ marginBottom: 4 }} />
                        <Num style={{ fontSize: 24 }}>{successfulTrees}</Num>
                        <Label>Trees grown</Label>
                    </Card>
                    <Card padded style={{ flex: 1, alignItems: 'center' }}>
                        <Ionicons name="timer-outline" size={24} color={C.ink2} style={{ marginBottom: 4 }} />
                        <Num style={{ fontSize: 24 }}>{totalMinutes}</Num>
                        <Label>Total mins</Label>
                    </Card>
                    <Card padded style={{ flex: 1, alignItems: 'center' }}>
                        <Ionicons name="leaf-outline" size={24} color={C.danger} style={{ marginBottom: 4 }} />
                        <Num style={{ fontSize: 24 }}>{witheredTrees}</Num>
                        <Label>Withered</Label>
                    </Card>
                </View>

                <SectionHeader title="Recent sessions" />

                <FlatList keyboardShouldPersistTaps="handled"
                    data={forestHistory}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    style={{ flex: 1 }}
                    ListEmptyComponent={
                        <Empty icon="leaf-outline" title="Your forest is empty" hint="Complete a focus session to plant a tree." />
                    }
                    ListFooterComponent={<View style={{ height: 40 + bottomInset }} />}
                    renderItem={renderSession}
                />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            {/* Locked session has no bar, so it still needs the status-bar inset itself. */}
            <SafeAreaView className="flex-1" edges={isAppLocked ? ['top'] : []}>
                {!isAppLocked && (
                    <AppBar title="Focus Forest"
                        onBack={() => {
                            if (activeTab === 'forest') setActiveTab('setup');
                            else navigation.goBack();
                        }}
                        right={activeTab === 'setup'
                            ? <IconBtn name="leaf" boxed color={C.success} accessibilityLabel="My forest" onPress={() => setActiveTab('forest')} />
                            : undefined} />
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
                        colors={[C.brand[500], '#F5B700', C.success, '#7C3AED']}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

// Module scope so FlatList rows are not redefined on every timer tick.
const SessionRow = React.memo(function SessionRow({ item }: { item: any }) {
    const ok = item.status === 'success';
    return (
        <Card style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <ListRow
                leading={<IconTile icon={ok ? 'leaf' : 'leaf-outline'} bg={ok ? C.success + '1A' : C.danger + '1A'} color={ok ? C.success : C.danger} />}
                title={SESSION_THEMES[item.type as SessionType].label}
                subtitle={`${new Date(item.date).toLocaleDateString()} • ${Math.floor(item.duration / 60)} mins`}
                right={<Tag label={ok ? 'Success' : 'Failed'} tone={{ fg: ok ? C.success : C.danger }} />}
            />
        </Card>
    );
});
const renderSession = ({ item }: { item: any }) => <SessionRow item={item} />;
