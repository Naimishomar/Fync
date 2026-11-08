import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, ScrollView, Linking, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

import {
    AppBar, Button, Card, Display, Empty, FormField, H1, IconTile, Label, ListRow, Num,
    SearchField, SectionHeader, SegmentedTabs, Sheet, Tag, TagRow,
} from '../ui/kit';
import { C } from '../../constants/colors';
// Mirrors LEETCODE_COOLDOWN_SECONDS on the server.
const COOLDOWN_MS = 15 * 60 * 1000;

const LC_LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png";
const UTC_DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const DIFFICULTY = [
    { key: 'easySolved', label: 'Easy', color: () => C.success },
    { key: 'mediumSolved', label: 'Medium', color: () => C.warning },
    { key: 'hardSolved', label: 'Hard', color: () => C.danger },
];

const RankRow = memo(function RankRow({ item, index, weekly, onOpen }: { item: any; index: number; weekly: boolean; onOpen: (u: any) => void }) {
    const score = weekly ? (item.weeklyStats?.questionsThisWeek || 0) : (item.codingStats?.totalSolved || 0);
    return (
        <ListRow
            onPress={() => onOpen(item)}
            style={{ marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 16, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line }}
            accessibilityLabel={`Rank ${index + 1}, ${item.name || item.username}, ${score} ${weekly ? 'this week' : 'solved'}`}
            leading={
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <View className="w-8 items-center">
                        {index < 3 ? (
                            <MaterialCommunityIcons name="crown" size={20} color={index === 1 ? C.ink3 : C.warning} />
                        ) : (
                            <Text className="text-ink-3 font-semibold text-base">#{index + 1}</Text>
                        )}
                    </View>
                    <Image source={{ uri: item.avatar }} recyclingKey={item._id} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.paper2 }} cachePolicy="memory-disk" />
                </View>
            }
            title={item.name || item.username}
            subtitle={item.college || 'Global'}
            right={
                <View className="items-center">
                    <Num style={{ fontSize: 18, lineHeight: 22 }}>{score}</Num>
                    <Text className="text-ink-3 text-xs font-semibold">{weekly ? '7 days' : 'Solved'}</Text>
                </View>
            }
        />
    );
});

// Outside the screen so a parent re-render doesn't remount it and restart the pulse.
const LeaderboardSkeleton = () => {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    return (
        <Animated.View
            style={{ opacity: pulseAnim }}
            className="flex-row items-center bg-card p-4 mb-3 mx-gutter rounded-2xl border border-line"
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
                // No fetch from here: this closure still sees the pre-link
                // `hasLinkedProfile`, so the call would bail out and leave the
                // board on skeletons. The effect below runs on the flag itself.
                setLoading(true);
            }
        } catch (err: any) {
            Alert.alert("Link Failed", err.response?.data?.message || "Something went wrong");
        } finally {
            setConnecting(false);
        }
    };

    // --- HELPER: Process Calendar Data ---
    const getActivityData = (calendarString: any) => {
        try {
            const calendar = typeof calendarString === 'string' ? JSON.parse(calendarString) : (calendarString || {});
            const last7Days = [];

            // The calendar is keyed by UTC-midnight timestamps, so the days are built
            // in UTC too: local midnight in IST is the previous day in UTC.
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setUTCHours(0, 0, 0, 0);
                d.setUTCDate(d.getUTCDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                let count = 0;
                Object.keys(calendar).forEach(ts => {
                    const submissionDate = new Date(parseInt(ts) * 1000).toISOString().split('T')[0];
                    if (submissionDate === dateStr) count += calendar[ts];
                });
                last7Days.push({ date: d, count, dayName: UTC_DAY_LETTERS[d.getUTCDay()] });
            }
            return last7Days;
        } catch (e) {
            return Array(7).fill({ count: 0, dayName: '-' });
        }
    };

    const requestId = useRef(0);
    const fetchLeaderboard = async () => {
        // Bailing out without clearing `loading` left the board showing its
        // skeleton for good: the flag starts true, and this is the only thing
        // that turns it off.
        if (!hasLinkedProfile) {
            setLoading(false);
            setRefreshing(false);
            return;
        }
        // Ignore a slower earlier response (scope/filter switch, typing) landing last.
        const id = ++requestId.current;
        try {
            // Skeleton only when there's nothing to show yet; otherwise keep the rows
            // up while the new set loads instead of flashing placeholders per keystroke.
            if (!refreshing && users.length === 0) setLoading(true);
            const res = await axios.get(`/leaderboard?scope=${activeScope}&type=${timeFilter}&search=${encodeURIComponent(search)}`);
            if (id === requestId.current && res.data.success) {
                const filtered = (res.data.leaderboard || []).filter((u: any) => u.codingProfiles?.leetcode);
                setUsers(filtered);
            }
        } catch (error) {
            console.error("Leaderboard Error:", error);
        } finally {
            if (id === requestId.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    const handleManualRefresh = async () => {
        setRefreshingStats(true);
        try {
            const res = await axios.post('/leaderboard/refresh');
            if (res.data.success) {
                setUser(res.data.user);
                if (res.data.nextRefreshAt) setNextRefreshAt(new Date(res.data.nextRefreshAt));
                const total = res.data.user?.codingStats?.totalSolved ?? 0;
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

    const profileRequest = useRef<string | null>(null);
    const openUserProfile = useCallback(async (userData: any) => {
        profileRequest.current = userData._id;
        setDbUser(userData);
        setLcData(null);
        setModalVisible(true);
        setProfileLoading(true);
        try {
            const res = await axios.get(`/leaderboard/user/${userData._id}`);
            if (profileRequest.current === userData._id && res.data.success) {
                setLcData(res.data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (profileRequest.current === userData._id) setProfileLoading(false);
        }
    }, []);

    const navigateToAppProfile = () => {
        setModalVisible(false);
        navigation.navigate("PublicProfile", { user: dbUser });
    };

    const openLeetCodeExternal = () => {
        if (dbUser?.codingProfiles?.leetcode) {
            Linking.openURL(`https://leetcode.com/${dbUser.codingProfiles.leetcode}`).catch(() => {});
        }
    };

    // One effect: two (one per dep set) fired a duplicate request on mount.
    useEffect(() => {
        const t = setTimeout(fetchLeaderboard, search ? 500 : 0);
        return () => clearTimeout(t);
    }, [activeScope, timeFilter, hasLinkedProfile, search]);
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

    const renderItem = useCallback(({ item, index }: { item: any, index: number }) => (
        <RankRow item={item} index={index} weekly={timeFilter === 'weekly'} onOpen={openUserProfile} />
    ), [openUserProfile, timeFilter]);

    if (!hasLinkedProfile) {
        return (
            <View className="flex-1 bg-paper">
                <StatusBar barStyle={C.barStyle} />

                <SafeAreaView className="flex-1" edges={['bottom']}>
                    <AppBar title="Coding Rank" onBack={() => navigation.goBack()} />

                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 48 }}>
                        <View className="items-center mb-8">
                            <IconTile icon="code-slash-outline" size={72} iconSize={32} color={C.accentText} style={{ marginBottom: 20 }} />
                            <Display style={{ textAlign: 'center' }}>Join the arena</Display>
                            <Text className="font-sans text-sm text-ink-3 text-center mt-3 px-6">
                                Connect your LeetCode profile to unlock the leaderboard and climb the global ranks.
                            </Text>
                        </View>

                        <Card padded style={{ width: '100%', gap: 16 }}>
                            <View className="flex-row items-center" style={{ gap: 12 }}>
                                <View className="w-10 h-10 rounded-full bg-paper-2 items-center justify-center">
                                    <Image source={{ uri: LC_LOGO }} style={{ width: 20, height: 20 }} contentFit="contain" />
                                </View>
                                <View>
                                    <Text className="font-semibold text-base text-ink">LeetCode username</Text>
                                    <Text className="text-ink-3 text-xs font-sans mt-0.5">We read your public stats only</Text>
                                </View>
                            </View>

                            <FormField
                                placeholder="e.g. naimishomar"
                                accessibilityLabel="LeetCode username"
                                value={lcUsername}
                                onChangeText={setLcUsername}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            <Button title="Link profile" icon="rocket-outline" variant="primary" block loading={connecting} onPress={handleLinkProfile} />
                        </Card>

                        <Text className="font-sans text-sm text-ink-3 mt-8 text-center px-gutter">
                            Your coding stats are fetched directly from LeetCode and shown in the Fync arena.
                        </Text>
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar
                    title="Coding Rank"
                    onBack={() => navigation.goBack()}
                    right={
                    canRefresh ? (
                        <Button small title="Sync" icon="reload" variant="primary" loading={refreshingStats} onPress={handleManualRefresh} accessibilityLabel="Sync LeetCode stats" />
                    ) : (
                        <View className="bg-paper-2 items-center justify-center px-3 py-1 rounded-full" accessibilityLabel={`Next sync in ${syncCountdown}`}>
                            <Text className="text-ink-3 text-xs font-semibold">Next sync</Text>
                            <Text className="text-ink font-semibold text-sm">{syncCountdown}</Text>
                        </View>
                    )
                    }
                />

                <View className="px-gutter mt-2 mb-4" style={{ gap: 12 }}>
                    <SearchField placeholder="Search coders" value={search} onChangeText={setSearch} />
                    <View className="flex-row" style={{ gap: 12 }}>
                        <SegmentedTabs
                            style={{ flex: 1 }}
                            items={['college', 'global'] as const}
                            labels={{ college: 'Campus', global: 'Global' }}
                            value={activeScope}
                            onChange={setActiveScope}
                        />
                        <SegmentedTabs
                            style={{ flex: 1 }}
                            items={['allTime', 'weekly'] as const}
                            labels={{ allTime: 'All time', weekly: '7 days' }}
                            value={timeFilter}
                            onChange={setTimeFilter}
                        />
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View className="mt-2">
                        {[1, 2, 3, 4, 5].map(i => <LeaderboardSkeleton key={i} />)}
                    </View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={users} keyExtractor={(item) => item._id} renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />}
                        ListEmptyComponent={<Empty icon="code-slash-outline" title="No coders yet" hint="The arena is quiet right now." />}
                    />
                )}

                <Sheet
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    height="85%"
                    title={dbUser?.name || 'Coder'}
                    subtitle={dbUser?.codingProfiles?.leetcode ? `@${dbUser.codingProfiles.leetcode}` : undefined}
                >
                    {profileLoading ? (
                        <ActivityIndicator size="large" color={C.brand[500]} style={{ marginTop: 80 }} />
                    ) : !lcData ? (
                        <Text className="text-ink-3 text-center mt-20">{"Couldn't load this profile. Try again."}</Text>
                    ) : (
                        <>
                            <View className="items-center mb-6">
                                <Image source={{ uri: lcData?.profile?.avatar }} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.paper2 }} cachePolicy="memory-disk" />
                                <H1 style={{ marginTop: 12, textAlign: 'center' }}>{lcData.profile?.name || dbUser?.name}</H1>

                                <View className="flex-row mt-4" style={{ gap: 8 }}>
                                    <Button title="Profile" icon="person-outline" variant="primary" onPress={navigateToAppProfile} />
                                    <Button title="LeetCode" icon="open-outline" onPress={openLeetCodeExternal} />
                                </View>

                                <TagRow style={{ marginTop: 16, justifyContent: 'center' }}>
                                    <Tag icon="trophy-outline" label={`Global rank #${lcData.profile?.ranking || 'N/A'}`} />
                                    <Tag icon="earth-outline" label={lcData.profile?.country || 'Earth'} />
                                </TagRow>
                            </View>

                            <View className="flex-row mb-6" style={{ gap: 12 }}>
                                <Card padded style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                    <Num style={{ fontSize: 34, lineHeight: 38 }}>{lcData.solved?.solvedProblem || 0}</Num>
                                    <Label style={{ marginTop: 4 }}>Total solved</Label>
                                </Card>
                                <View className="flex-1" style={{ gap: 8 }}>
                                    {DIFFICULTY.map(d => (
                                        <View key={d.key} className="flex-row justify-between items-center bg-paper-2 px-4 py-3 rounded-2xl">
                                            <View className="flex-row items-center" style={{ gap: 8 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.color() }} />
                                                <Text className="text-ink-2 text-sm font-semibold">{d.label}</Text>
                                            </View>
                                            <Text className="text-ink text-sm font-semibold">{lcData.solved?.[d.key] || 0}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            <Card padded style={{ marginBottom: 24 }}>
                                <SectionHeader title="Last 7 days" style={{ marginBottom: 16 }} />
                                <View className="flex-row justify-between items-end px-2">
                                    {getActivityData(lcData.submissionCalendar).map((day: any, i: number) => (
                                        <View key={i} className="items-center" style={{ gap: 8 }}>
                                            {day.count > 0 ? (
                                                <View className="items-center">
                                                    <Text className="text-success text-xs font-semibold mb-1">{day.count}</Text>
                                                    <View className="w-4 bg-success rounded-full" style={{ height: Math.min(day.count * 10, 40) }} />
                                                </View>
                                            ) : (
                                                <View className="w-4 h-4 bg-paper-2 rounded-full border border-line" />
                                            )}
                                            <Text className="text-ink-3 text-xs font-semibold">{day.dayName}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Card>

                            {lcData.badges && lcData.badges.length > 0 ? (
                                <View className="mb-6">
                                    <SectionHeader title="Badges" count={lcData.badges.length} style={{ marginBottom: 12 }} />
                                    <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                        {lcData.badges.map((badge: any, i: number) => (
                                            <Card key={i} padded style={{ width: 104, alignItems: 'center' }}>
                                                <Image
                                                    source={{ uri: String(badge.icon || '').startsWith("http") ? badge.icon : `https://leetcode.com${badge.icon || ''}` }}
                                                    style={{ width: 56, height: 56, marginBottom: 8 }}
                                                    contentFit="contain"
                                                    cachePolicy="memory-disk"
                                                />
                                                <Text className="text-ink text-xs font-semibold text-center" numberOfLines={2}>{badge.displayName}</Text>
                                            </Card>
                                        ))}
                                    </ScrollView>
                                </View>
                            ) : null}

                            {lcData.contest ? (
                                <Card padded style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text className="text-ink font-semibold text-base">Contest rating</Text>
                                        <Text className="text-ink-3 text-xs font-sans mt-0.5">Top {lcData.contest.contestTopPercentage || 0}% globally</Text>
                                    </View>
                                    <Num style={{ fontSize: 28, lineHeight: 32, color: C.accentText }}>{Math.round(lcData.contest.contestRating || 0)}</Num>
                                </Card>
                            ) : null}

                            <SectionHeader title="Recently solved" style={{ marginBottom: 12 }} />
                            {lcData.recentSubmissions && lcData.recentSubmissions.length > 0 ? (
                                <View style={{ gap: 8 }}>
                                    {lcData.recentSubmissions.slice(0, 5).map((sub: any, i: number) => (
                                        <ListRow
                                            key={i}
                                            title={sub.title}
                                            subtitle={new Date(parseInt(sub.timestamp) * 1000).toLocaleDateString()}
                                            right={
                                                <Tag
                                                    icon={sub.statusDisplay === 'Accepted' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                                                    label={sub.statusDisplay}
                                                    tone={{ fg: sub.statusDisplay === 'Accepted' ? C.success : C.danger }}
                                                />
                                            }
                                        />
                                    ))}
                                </View>
                            ) : (
                                <Text className="text-ink-3 font-sans text-sm">No recent activity.</Text>
                            )}
                        </>
                    )}
                </Sheet>
            </SafeAreaView>
        </View>
    );
};
