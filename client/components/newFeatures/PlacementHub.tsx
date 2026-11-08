import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, Text, ScrollView, Pressable, FlatList, Animated, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { useBottomInset } from '../../constants/layout';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';
import { Alert } from '../ui/AlertModal';

import {
    AppBar, IconBtn, Button, Card, Empty, FilterChips, FormField, IconTile, Label,
    SearchField, SectionHeader, Sheet, Tag, TagRow,
} from '../ui/kit';
import { Pop } from '../ui-extra/usePop';
import CommentsSheet, { CommentsApi } from '../ui/CommentsSheet';
import { C } from '../../constants/colors';

import FyncRefreshControl from '../ui/FyncRefreshControl';
// Backend: GET /placement/comments/:id -> { comments } (getCommentThread, commentor populated);
// POST /placement/comment/:id takes `parentCommentId`. No update/delete routes.
const PLACEMENT_COMMENTS: CommentsApi = {
    list: (id) => `/placement/comments/${id}`,
    add: (id) => `/placement/comment/${id}`,
    body: (text, parentId) => ({ text, parentCommentId: parentId ?? undefined }),
    replies: true,
};
const COMPANIES = () => ([
    { name: 'Google', icon: 'google', color: '#4285F4' },
    { name: 'Amazon', icon: 'amazon', color: '#FF9900' },
    { name: 'Microsoft', icon: 'microsoft', color: '#00A4EF' },
    { name: 'Meta', icon: 'facebook', color: '#0668E1' },
    { name: 'Apple', icon: 'apple', color: C.ink2 },
    { name: 'Netflix', icon: 'netflix', color: '#E50914' },
    { name: 'Uber', icon: 'car-side', color: C.ink },
]);

const QUESTION_TYPES = ["DSA", "HR", "System Design", "Aptitude", "Core Subject"];

// Outside the screen so a parent re-render doesn't remount it and restart the pulse.
const QuestionSkeleton = () => {
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
        <Animated.View style={{ opacity: pulseAnim }} className="bg-card mx-gutter mb-3 rounded-2xl border border-line p-4">
            <View className="flex-row justify-between mb-6">
                <View className="h-6 bg-paper-2 rounded-full w-24" />
                <View className="h-6 bg-paper-2 rounded-full w-20" />
            </View>
            <View className="h-4 bg-paper-2 rounded w-full mb-3" />
            <View className="h-4 bg-paper-2 rounded w-4/5 mb-8" />
            <View className="flex-row gap-2 mb-8">
                <View className="w-16 h-5 bg-paper-2 rounded-lg" />
                <View className="w-16 h-5 bg-paper-2 rounded-lg" />
            </View>
            <View className="flex-row justify-between items-center pt-6 border-t border-line">
                <View className="flex-row items-center">
                    <View className="w-6 h-6 bg-paper-2 rounded-full" />
                    <View className="w-20 h-4 bg-paper-2 rounded ml-2" />
                </View>
                <View className="flex-row gap-4">
                    <View className="w-6 h-6 bg-paper-2 rounded-full" />
                    <View className="w-6 h-6 bg-paper-2 rounded-full" />
                </View>
            </View>
        </Animated.View>
    );
};

const DIFF_TONE: Record<string, () => string> = { Hard: () => C.danger, Medium: () => C.warning, Easy: () => C.success };
const TYPE_FILTERS = ['All', ...QUESTION_TYPES];

const QuestionCard = memo(function QuestionCard({ item, me, onUpvote, onSave, onDiscuss }: {
    item: any; me?: string; onUpvote: (id: string) => void; onSave: (id: string) => void; onDiscuss: (q: any) => void;
}) {
    const isUpvoted = item.upvotes?.includes(me);
    const isSaved = item.savedBy?.includes(me);
    const ago = item.createdAt && !isNaN(new Date(item.createdAt).getTime()) ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : '';
    return (
        <Card padded style={{ marginHorizontal: 20, marginBottom: 12 }}>
            <View className="flex-row justify-between items-center mb-3">
                <Text className="text-ink font-semibold text-base flex-1 mr-3" numberOfLines={1}>{item.company || 'Company'}</Text>
                {item.difficulty ? (
                    <Tag label={item.difficulty} tone={{ fg: (DIFF_TONE[item.difficulty] ?? (() => C.ink2))() }} />
                ) : null}
            </View>

            <Text className="text-ink text-base font-sans leading-6 mb-3">{item.question}</Text>

            <TagRow style={{ marginBottom: 12 }}>
                {item.type ? <Tag label={item.type} /> : null}
                {item.round ? <Tag label={item.round} /> : null}
            </TagRow>

            <View className="flex-row justify-between items-center pt-2 border-t border-line">
                <View className="flex-row items-center flex-1" style={{ gap: 8 }}>
                    <Image
                        source={{ uri: item.postedBy?.avatar || `https://ui-avatars.com/api/?name=${item.postedBy?.username}` }}
                        style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.paper2 }}
                        cachePolicy="memory-disk"
                    />
                    <View className="flex-1">
                        <Text className="text-ink-2 text-xs font-semibold" numberOfLines={1}>@{item.postedBy?.username}</Text>
                        {ago ? <Text className="text-ink-3 text-xs font-sans">{ago}</Text> : null}
                    </View>
                </View>

                <View className="flex-row items-center">
                    <Pressable
                        onPress={() => onUpvote(item._id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Upvote, ${item.upvotes?.length || 0}`}
                        accessibilityState={{ selected: !!isUpvoted }}
                        className="flex-row items-center px-2 h-11 active:opacity-85"
                    >
                        <Ionicons name={isUpvoted ? "heart" : "heart-outline"} size={18} color={isUpvoted ? C.accentText : C.ink3} />
                        <Text className={`ml-1 text-sm font-semibold ${isUpvoted ? 'text-accent-text' : 'text-ink-3'}`}>{item.upvotes?.length || 0}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => onDiscuss(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Discussion, ${item.comments?.length || 0}`}
                        className="flex-row items-center px-2 h-11 active:opacity-85"
                    >
                        <Ionicons name="chatbubble-outline" size={18} color={C.ink3} />
                        <Text className="ml-1 text-sm font-semibold text-ink-3">{item.comments?.length || 0}</Text>
                    </Pressable>
                    <Pop on={!!isSaved}>
                        <IconBtn
                            name={isSaved ? "bookmark" : "bookmark-outline"}
                            size={18}
                            color={isSaved ? C.accentText : C.ink3}
                            accessibilityLabel={isSaved ? 'Unsave' : 'Save'}
                            onPress={() => onSave(item._id)}
                        />
                    </Pop>
                </View>
            </View>
        </Card>
    );
});

const PlacementHub = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [questions, setQuestions] = useState<any[]>([]);
    const [trending, setTrending] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeType, setActiveType] = useState('All');

    const CURRENT_USER_ID = user?._id || user?.id;
    const bottomInset = useBottomInset();
    const [posting, setPosting] = useState(false);
    const requestId = useRef(0);

    const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
    const [isDiscussionVisible, setDiscussionVisible] = useState(false);

    const [isPostModalVisible, setPostModalVisible] = useState(false);
    const [form, setForm] = useState({
        company: '',
        role: '',
        round: '',
        type: 'DSA',
        difficulty: 'Medium',
        question: '',
        description: ''
    });

    const fetchQuestions = async () => {
        // Ignore a slower earlier response (filter switch, typing) landing last.
        const id = ++requestId.current;
        try {
            // Skeleton only when there's nothing on screen yet, not on every keystroke.
            if (!refreshing && questions.length === 0) setLoading(true);
            const res = await axios.get('/placement/questions', {
                params: {
                    type: activeType === 'All' ? undefined : activeType,
                    search: search || undefined
                }
            });
            if (id !== requestId.current) return;
            if (res.data.success) setQuestions(res.data.data || []);

            const trendingRes = await axios.get('/placement/trending');
            if (id === requestId.current && trendingRes.data.success) setTrending(trendingRes.data.data || []);
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            if (id === requestId.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    // One effect: two (one per dep) fired a duplicate request on mount.
    useEffect(() => {
        const t = setTimeout(fetchQuestions, search ? 500 : 0);
        return () => clearTimeout(t);
    }, [activeType, search]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchQuestions();
    };

    const handleUpvote = async (id: string) => {
        try {
            const res = await axios.post(`/placement/upvote/${id}`);
            if (res.data.success) {
                setQuestions(prev => prev.map(q => {
                    if (q._id === id) {
                        const upvotes = q.upvotes || [];
                        const hasUpvoted = upvotes.includes(CURRENT_USER_ID);
                        const newUpvotes = hasUpvoted
                            ? upvotes.filter((uid: string) => uid !== CURRENT_USER_ID)
                            : [...upvotes, CURRENT_USER_ID];
                        return { ...q, upvotes: newUpvotes };
                    }
                    return q;
                }));
            }
        } catch (error) { console.error(error); }
    };

    const handleSave = async (id: string) => {
        try {
            const res = await axios.post(`/placement/save/${id}`);
            if (res.data.success) {
                setQuestions(prev => prev.map(q => {
                    if (q._id === id) {
                        const savedBy = q.savedBy || [];
                        const isSaved = savedBy.includes(CURRENT_USER_ID);
                        const newSaved = isSaved
                            ? savedBy.filter((uid: string) => uid !== CURRENT_USER_ID)
                            : [...savedBy, CURRENT_USER_ID];
                        return { ...q, savedBy: newSaved };
                    }
                    return q;
                }));
            }
        } catch (error) { console.error(error); }
    };

    const handlePost = async () => {
        if (!form.company || !form.role || !form.question) {
            return Alert.alert("Required", "Please fill essential fields.");
        }
        if (posting) return;
        setPosting(true);
        try {
            const res = await axios.post('/placement/add', form);
            if (res.data.success) {
                setPostModalVisible(false);
                setForm({
                    company: '', role: '', round: '', type: 'DSA',
                    difficulty: 'Medium', question: '', description: ''
                });
                fetchQuestions();
                Alert.alert("Success", "Intelligence shared with HQ.");
            }
        } catch (error) { Alert.alert("Error", "Transmission failed."); }
        finally { setPosting(false); }
    };

    const openDiscussion = useCallback((q: any) => { setSelectedQuestion(q); setDiscussionVisible(true); }, []);

    const renderQuestionCard = ({ item }: { item: any }) => (
        <QuestionCard item={item} me={CURRENT_USER_ID} onUpvote={handleUpvote} onSave={handleSave} onDiscuss={openDiscussion} />
    );

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar
                    onBack={() => navigation.goBack()}
                    title="Career Hub"
                    right={<IconBtn name="add" boxed accessibilityLabel="Share an interview question" onPress={() => setPostModalVisible(true)} />}
                />
                <View className="px-gutter mb-4">
                    <SearchField placeholder="Search interview questions" value={search} onChangeText={setSearch} />
                </View>

                {/* The feed itself is the scroller; it used to be a scrollEnabled={false}
                    FlatList inside a ScrollView, which renders every card up front. */}
                <FlatList keyboardShouldPersistTaps="handled"
                    data={loading && !refreshing ? [] : questions}
                    keyExtractor={(item) => item._id}
                    renderItem={renderQuestionCard}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: bottomInset }}
                    refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />}
                    ListHeaderComponent={<>
                    <View className="px-gutter mb-6 flex-row" style={{ gap: 12 }}>
                        <Pressable
                            onPress={() => navigation.navigate("PlacementPredictor")}
                            accessibilityRole="button"
                            accessibilityLabel="Predictor, AI resume scan"
                            className="flex-1 bg-card border border-line rounded-2xl p-4 active:opacity-85"
                        >
                            <IconTile icon="stats-chart-outline" color={C.recruiter} />
                            <Text className="font-semibold text-base text-ink mt-3">Predictor</Text>
                            <Text className="font-sans text-sm text-ink-3 mt-0.5">AI resume scan</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => navigation.navigate("InterviewSetup")}
                            accessibilityRole="button"
                            accessibilityLabel="Mock interview, real-time simulation"
                            className="flex-1 bg-card border border-line rounded-2xl p-4 active:opacity-85"
                        >
                            <IconTile icon="mic-outline" color={C.accentText} />
                            <Text className="font-semibold text-base text-ink mt-3">Mock interview</Text>
                            <Text className="font-sans text-sm text-ink-3 mt-0.5">Real-time simulation</Text>
                        </Pressable>
                    </View>

                    <SectionHeader title="Top companies" style={{ marginHorizontal: 20, marginBottom: 12 }} />
                    <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }} style={{ marginBottom: 24 }}>
                        {COMPANIES().map((c) => (
                            <Pressable
                                key={c.name}
                                onPress={() => setSearch(c.name)}
                                accessibilityRole="button"
                                accessibilityLabel={`Search ${c.name}`}
                                className="items-center active:opacity-85"
                            >
                                <View className="bg-card w-14 h-14 rounded-full items-center justify-center border border-line">
                                    <FontAwesome5 name={c.icon} size={22} color={c.color} />
                                </View>
                                <Text className="text-ink-2 text-xs mt-2 font-semibold">{c.name}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <FilterChips items={TYPE_FILTERS} value={activeType} onChange={setActiveType} style={{ marginBottom: 24 }} />

                    {trending.length > 0 ? (
                        <View className="mb-6">
                            <SectionHeader title="Trending" style={{ marginHorizontal: 20, marginBottom: 12 }} />
                            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                                {trending.map((item, i) => (
                                    <Pressable
                                        key={item._id || i}
                                        onPress={() => openDiscussion(item)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${item.company}, ${item.type}`}
                                        className="bg-card p-4 rounded-2xl border border-line w-[240px] active:opacity-85"
                                    >
                                        <Text className="font-semibold text-base text-ink" numberOfLines={1}>{item.company}</Text>
                                        <Text className="text-accent-text text-xs font-semibold mt-0.5" numberOfLines={1}>{item.type}</Text>
                                        <Text className="text-ink-3 text-sm font-sans leading-5 mt-2" numberOfLines={2}>{item.question}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    ) : null}

                    <SectionHeader title="Latest questions" style={{ marginHorizontal: 20, marginBottom: 12 }} />
                    {loading && !refreshing ? (
                        <View>{[1, 2, 3].map(i => <QuestionSkeleton key={i} />)}</View>
                    ) : null}
                    </>}
                    ListEmptyComponent={loading && !refreshing ? null : (
                        <Empty icon="document-text-outline" title="No questions yet" hint="Share one from your last interview." action={<Button variant="primary" title="Share a question" onPress={() => setPostModalVisible(true)} />} />
                    )}
                />

                <Sheet
                    visible={isPostModalVisible}
                    onClose={() => setPostModalVisible(false)}
                    title="Share interview"
                    height="92%"
                    footer={<Button title="Share question" variant="primary" block loading={posting} onPress={handlePost} />}
                >
                    <View style={{ gap: 16 }}>
                        <FormField label="Company" placeholder="e.g. Google" value={form.company} onChangeText={t => setForm({ ...form, company: t })} />
                        <FormField label="Role" placeholder="e.g. SDE intern" value={form.role} onChangeText={t => setForm({ ...form, role: t })} />
                        <FormField label="Round" placeholder="e.g. Technical round 1" value={form.round} onChangeText={t => setForm({ ...form, round: t })} />
                        <View style={{ gap: 8 }}>
                            <Label>Type</Label>
                            <FilterChips items={QUESTION_TYPES} value={form.type} onChange={t => setForm({ ...form, type: t })} style={{ marginHorizontal: -20 }} />
                        </View>
                        <FormField label="Question" multiline placeholder="What were you asked?" value={form.question} onChangeText={t => setForm({ ...form, question: t })} />
                        <FormField label="Approach or hints (optional)" multiline placeholder="How you solved it" value={form.description} onChangeText={t => setForm({ ...form, description: t })} />
                    </View>
                </Sheet>

                <CommentsSheet
                    visible={isDiscussionVisible}
                    onClose={() => setDiscussionVisible(false)}
                    resource={PLACEMENT_COMMENTS}
                    title={selectedQuestion?.company || 'Discussion'}
                    targetId={selectedQuestion?._id ?? null}
                    currentUser={user}
                    onCountChange={(id, count) => setQuestions(prev => prev.map(q =>
                        q._id === id ? { ...q, comments: Array.from({ length: count }) } : q
                    ))}
                />
            </View>
        </View>
    );
};

export default PlacementHub;
