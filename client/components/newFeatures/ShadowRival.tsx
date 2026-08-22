import React, { useCallback, useEffect, useRef, useState } from 'react';
import {View, Text, ScrollView, ActivityIndicator, RefreshControl, StatusBar, Image, TouchableOpacity, Switch, Dimensions} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';

import { StampCard } from '../ui/kit';
type Metrics = { solved: number; commits: number; streak: number; total: number };
type HistoryPoint = { d: string; me: number; rival: number };
type Rivalry = {
    status: 'waiting' | 'ineligible' | 'active' | 'revealed' | 'opted_out';
    message?: string;
    season?: string;
    revealAt?: string;
    optOut?: boolean;
    rematchesLeft?: number;
    me?: Metrics;
    rival?: Metrics;
    leading?: boolean | null;
    history?: HistoryPoint[];
    identity?: { name: string; username: string; avatar: string; major: string; year: string; college: string } | null;
};

const METRICS: { key: keyof Metrics; label: string; icon: any }[] = [
    { key: 'solved', label: 'Problems Solved', icon: 'code-slash' },
    { key: 'commits', label: 'Commits Pushed', icon: 'git-commit' },
    { key: 'streak', label: 'Day Streak', icon: 'flame' },
];

const CHART_HEIGHT = 120;

const daysLeft = (iso?: string) => {
    if (!iso) return 0;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
};

// Two bars share the row, scaled against whichever side is ahead. A 0-0 metric
// draws two empty bars rather than dividing by zero.
const Bar = ({ value, max, mine }: { value: number; max: number; mine: boolean }) => (
    <View className="h-3 bg-paper-2 rounded-full overflow-hidden">
        <View
            className={`h-full rounded-full ${mine ? 'bg-brand-500' : 'bg-ink'}`}
            style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
    </View>
);

// The season as two lines. One nightly point each, so the shape is the race:
// where the lead changed hands, and who was still climbing at the end.
const RaceChart = ({ history, width }: { history: HistoryPoint[]; width: number }) => {
    const peak = Math.max(1, ...history.flatMap((p) => [p.me, p.rival]));
    const stepX = history.length > 1 ? width / (history.length - 1) : 0;
    const toPoints = (pick: (p: HistoryPoint) => number) =>
        history.map((p, i) => `${i * stepX},${CHART_HEIGHT - (pick(p) / peak) * CHART_HEIGHT}`).join(' ');

    const last = history[history.length - 1];

    return (
        <Svg width={width} height={CHART_HEIGHT}>
            <Polyline points={toPoints((p) => p.rival)} fill="none" stroke="#12100E" strokeWidth={2} />
            <Polyline points={toPoints((p) => p.me)} fill="none" stroke="#F97316" strokeWidth={2.5} />
            <Circle cx={(history.length - 1) * stepX} cy={CHART_HEIGHT - (last.rival / peak) * CHART_HEIGHT} r={3.5} fill="#12100E" />
            <Circle cx={(history.length - 1) * stepX} cy={CHART_HEIGHT - (last.me / peak) * CHART_HEIGHT} r={4} fill="#F97316" />
        </Svg>
    );
};

export default function ShadowRival() {
  const navigation = useNavigation<any>();
    const [data, setData] = useState<Rivalry | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [celebrate, setCelebrate] = useState(false);
    const chartWidth = useRef(Dimensions.get('window').width - 96).current;

    const fetchRival = useCallback(async () => {
        try {
            const res = await axios.get('/shadow-rival');
            setData(res.data);
        } catch {
            setData({ status: 'ineligible', message: "Couldn't reach the Shadow. Pull to retry." });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchRival(); }, [fetchRival]));

    // Confetti fires once per season, the first time the user opens the screen
    // after reveal. Stored locally: the server has no business tracking whether
    // an animation played.
    useEffect(() => {
        if (data?.status !== 'revealed' || !data.season) return;
        const key = `shadowRival:celebrated:${data.season}`;
        AsyncStorage.getItem(key).then((seen) => {
            if (seen) return;
            setCelebrate(true);
            AsyncStorage.setItem(key, '1');
        });
    }, [data?.status, data?.season]);

    const toggleOptOut = async (next: boolean) => {
        setBusy(true);
        try {
            const res = await axios.post('/shadow-rival/opt-out', { optOut: next });
            Alert.alert(next ? "Opted Out" : "Back In", res.data.message);
            fetchRival();
        } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Could not update.");
        } finally {
            setBusy(false);
        }
    };

    const confirmRematch = () => {
        Alert.alert(
            "Reroll Your Shadow?",
            `This releases your current rival and starts from zero. ${data?.rematchesLeft ?? 0} left this season.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reroll", style: "destructive", onPress: async () => {
                        setBusy(true);
                        try {
                            const res = await axios.post('/shadow-rival/rematch');
                            Alert.alert("Done", res.data.message);
                            fetchRival();
                        } catch (err: any) {
                            Alert.alert("Not Rerolled", err.response?.data?.message || "Could not reroll.");
                        } finally {
                            setBusy(false);
                        }
                    }
                },
            ]
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-paper items-center justify-center">
                <ActivityIndicator size="large" color="#F97316" />
            </View>
        );
    }

    const active = data?.status === 'active' || data?.status === 'revealed';
    const revealed = data?.status === 'revealed';
    const won = revealed && (data?.me?.total ?? 0) >= (data?.rival?.total ?? 0);
    // The brand fill is LIGHT — white on it is 2.1:1. Ink on it is 8.9:1.
    const aheadFill = revealed ? won : !!data?.leading;

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />


            <SafeAreaView className="flex-1" edges={['top']}>
                <ScrollView
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRival(); }} tintColor="#F97316" />
                    }
                >
                    <View className="px-gutter pt-2 mb-6">
                        <TouchableOpacity
                          onPress={() => navigation.goBack()}
                          className="w-11 h-11 items-center justify-center rounded-xl"
                          accessibilityRole="button"
                          accessibilityLabel="Go back"
                          style={{ marginLeft: -11 }}
                        >
                          <Ionicons name="arrow-back" size={24} color="#12100E" />
                        </TouchableOpacity>
                        <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Shadow</Text>
                        <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Rival</Text>
                        <Text className="text-ink-3 text-label font-display uppercase">
                            One anonymous match. Revealed at semester end.
                        </Text>
                    </View>

                    {!active && (
                        <View className="mx-gutter bg-card p-card-pad rounded-xl border border-line shadow-hair items-center">
                            <Ionicons
                                name={data?.status === 'waiting' ? 'hourglass-outline' : data?.status === 'opted_out' ? 'moon-outline' : 'link-outline'}
                                size={40}
                                color="#8B857E"
                            />
                            <Text className="text-ink text-lg font-display mt-4 text-center">
                                {data?.status === 'waiting' ? 'Matching In Progress'
                                    : data?.status === 'opted_out' ? 'You Are Out'
                                        : 'Nothing To Measure Yet'}
                            </Text>
                            <Text className="text-ink-3 text-center mt-2 text-sm">{data?.message}</Text>
                        </View>
                    )}

                    {active && data?.me && data?.rival && (
                        <>
                            {/* Standing */}
                            <StampCard style={{ marginHorizontal: 20 }}>
                                <View
                                    style={{ backgroundColor: revealed
                                        ? (won ? '#F97316' : '#57534E')
                                        : (data.leading ? '#F97316' : '#12100E') }}
                                    className="p-card-pad items-center"
                                >
                                    <Text className={`text-label font-display uppercase ${aheadFill ? 'text-ink/70' : 'text-white/70'}`}>
                                        {revealed
                                            ? (won ? 'Season won' : 'Season lost')
                                            : data.leading === null ? 'Neck and neck' : data.leading ? "You're ahead" : 'Your Shadow is ahead'}
                                    </Text>
                                    <Text className={`text-5xl font-display mt-2 ${aheadFill ? 'text-ink' : 'text-white'}`}>
                                        {data.me.total} <Text className={`text-2xl ${aheadFill ? 'text-ink/50' : 'text-white/50'}`}>vs</Text> {data.rival.total}
                                    </Text>
                                    <Text className={`text-label font-display uppercase mt-2 ${aheadFill ? 'text-ink/70' : 'text-white/70'}`}>
                                        {revealed ? 'Final' : `${daysLeft(data.revealAt)} days to reveal`}
                                    </Text>
                                </View>
                            </StampCard>

                            {/* The race */}
                            {(data.history?.length ?? 0) > 1 && (
                                <View className="mx-gutter mt-6 bg-card p-6 rounded-xl border border-line shadow-hair">
                                    <View className="flex-row items-center justify-between mb-4">
                                        <Text className="text-ink-3 font-display text-label uppercase">The Race</Text>
                                        <View className="flex-row items-center gap-4">
                                            <View className="flex-row items-center">
                                                <View className="w-3 h-1 bg-brand-500 rounded-full mr-1.5" />
                                                <Text className="text-ink-3 font-display text-label uppercase">You</Text>
                                            </View>
                                            <View className="flex-row items-center">
                                                <View className="w-3 h-1 bg-ink rounded-full mr-1.5" />
                                                <Text className="text-ink-3 font-display text-label uppercase">Shadow</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <RaceChart history={data.history!} width={chartWidth} />
                                    <Text className="text-ink-3 font-display text-label uppercase mt-3">
                                        {data.history!.length} days tracked
                                    </Text>
                                </View>
                            )}

                            {/* Metrics */}
                            <View className="mx-gutter mt-6 bg-card p-card-pad rounded-xl border border-line shadow-hair">
                                {METRICS.map(({ key, label, icon }, i) => {
                                    const mine = data.me![key];
                                    const theirs = data.rival![key];
                                    const max = Math.max(mine, theirs);
                                    return (
                                        <View key={key} className={i === METRICS.length - 1 ? '' : 'mb-7'}>
                                            <View className="flex-row items-center mb-3">
                                                <Ionicons name={icon} size={16} color="#F97316" />
                                                <Text className="text-ink-3 font-display text-label uppercase ml-2">{label}</Text>
                                            </View>

                                            <View className="flex-row items-center mb-2">
                                                <Text className="text-ink font-display text-label w-16">YOU</Text>
                                                <View className="flex-1"><Bar value={mine} max={max} mine /></View>
                                                <Text className="text-ink font-display text-sm w-12 text-right">{mine}</Text>
                                            </View>

                                            <View className="flex-row items-center">
                                                <Text className="text-ink-3 font-display text-label w-16">SHADOW</Text>
                                                <View className="flex-1"><Bar value={theirs} max={max} mine={false} /></View>
                                                <Text className="text-ink-3 font-display text-sm w-12 text-right">{theirs}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            {/* Identity */}
                            <View className="mx-gutter mt-6 bg-card p-card-pad rounded-xl border border-line items-center">
                                {data.identity ? (
                                    <>
                                        {!!data.identity.avatar && (
                                            <Image source={{ uri: data.identity.avatar }} className="w-16 h-16 rounded-full mb-3" />
                                        )}
                                        <Text className="text-ink-3 text-label font-display uppercase">Your Shadow was</Text>
                                        <Text className="text-ink text-2xl font-display mt-1">{data.identity.name}</Text>
                                        <Text className="text-ink-3 text-sm text-center">
                                            @{data.identity.username} · {data.identity.major} · Year {data.identity.year}
                                        </Text>
                                        <Text className="text-ink-3 text-label font-display uppercase mt-1">
                                            {data.identity.college}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="eye-off-outline" size={28} color="#8B857E" />
                                        <Text className="font-sans text-sm text-ink-3 mt-3 text-center">
                                            Identity locked until {new Date(data.revealAt!).toDateString()}
                                        </Text>
                                    </>
                                )}
                            </View>
                        </>
                    )}

                    {/* Controls */}
                    <View className="mx-gutter mt-6 bg-card rounded-xl border border-line overflow-hidden">
                        {data?.status === 'active' && (
                            <TouchableOpacity
                                onPress={confirmRematch}
                                disabled={busy || (data.rematchesLeft ?? 0) < 1}
                                className="flex-row items-center px-6 py-5 border-b border-line"
                            >
                                <Ionicons name="shuffle" size={18} color={(data.rematchesLeft ?? 0) < 1 ? '#C4BEB6' : '#F97316'} />
                                <Text className={`font-display uppercase text-label ml-4 flex-1 ${(data.rematchesLeft ?? 0) < 1 ? 'text-ink-4' : 'text-ink'}`}>
                                    Reroll Shadow
                                </Text>
                                <Text className="text-ink-3 font-display text-label uppercase">
                                    {data.rematchesLeft ?? 0} left
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View className="flex-row items-center px-6 py-5">
                            <Ionicons name="moon-outline" size={18} color="#8B857E" />
                            <View className="flex-1 ml-4">
                                <Text className="text-ink font-display uppercase text-label">Opt Out</Text>
                                <Text className="text-ink-3 text-label mt-0.5">No rival, no notifications</Text>
                            </View>
                            <Switch
                                value={!!data?.optOut}
                                onValueChange={toggleOptOut}
                                disabled={busy}
                                trackColor={{ true: '#F97316', false: '#E3DDD3' }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>

            {celebrate && (
                <ConfettiCannon
                    count={120}
                    origin={{ x: Dimensions.get('window').width / 2, y: -20 }}
                    fadeOut
                    autoStart
                    onAnimationEnd={() => setCelebrate(false)}
                />
            )}
        </View>
    );
}
