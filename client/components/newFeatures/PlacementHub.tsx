import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Modal, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Image, Animated, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';
import { Alert } from '../ui/AlertModal';

import { StampCard } from '../ui/kit';
const COMPANIES = [
    { name: 'Google', icon: 'google', color: '#4285F4' },
    { name: 'Amazon', icon: 'amazon', color: '#FF9900' },
    { name: 'Microsoft', icon: 'microsoft', color: '#00A4EF' },
    { name: 'Meta', icon: 'facebook', color: '#0668E1' },
    { name: 'Apple', icon: 'apple', color: '#57534E' },
    { name: 'Netflix', icon: 'netflix', color: '#E50914' },
    { name: 'Uber', icon: 'car-side', color: '#12100E' },
];

const QUESTION_TYPES = ["DSA", "HR", "System Design", "Aptitude", "Core Subject"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

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

    const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
    const [isDiscussionVisible, setDiscussionVisible] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const commentInputRef = useRef<TextInput>(null);

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
        try {
            if (!refreshing) setLoading(true);
            const res = await axios.get('/placement/questions', {
                params: {
                    type: activeType === 'All' ? undefined : activeType,
                    search: search || undefined
                }
            });
            if (res.data.success) setQuestions(res.data.data);

            const trendingRes = await axios.get('/placement/trending');
            if (trendingRes.data.success) setTrending(trendingRes.data.data);
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, [activeType]);

    useEffect(() => {
        const t = setTimeout(fetchQuestions, 500);
        return () => clearTimeout(t);
    }, [search]);

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
                        const hasUpvoted = q.upvotes.includes(CURRENT_USER_ID);
                        const newUpvotes = hasUpvoted
                            ? q.upvotes.filter((uid: string) => uid !== CURRENT_USER_ID)
                            : [...q.upvotes, CURRENT_USER_ID];
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
                        const isSaved = q.savedBy.includes(CURRENT_USER_ID);
                        const newSaved = isSaved
                            ? q.savedBy.filter((uid: string) => uid !== CURRENT_USER_ID)
                            : [...q.savedBy, CURRENT_USER_ID];
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
    };

    const handleComment = async () => {
        if (!newComment.trim() || !selectedQuestion) return;
        try {
            const res = await axios.post(`/placement/comment/${selectedQuestion._id}`, {
                text: newComment,
                parentCommentId: replyingTo?._id
            });
            if (res.data.success) {
                const commentsRes = await axios.get(`/placement/comments/${selectedQuestion._id}`);
                if (commentsRes.data.success) {
                    setSelectedQuestion({ ...selectedQuestion, comments: commentsRes.data.comments });
                }
                setNewComment('');
                setReplyingTo(null);
                fetchQuestions();
            }
        } catch (error) { Alert.alert("Error", "Failed to communicate."); }
    };

    const renderQuestionCard = ({ item }: { item: any }) => {
        const isUpvoted = item.upvotes?.includes(CURRENT_USER_ID);
        const isSaved = item.savedBy?.includes(CURRENT_USER_ID);

        return (
            <View className="bg-card mx-gutter mb-6 rounded-sheet border border-line shadow-hair overflow-hidden">
                <View className="p-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-ink-3 text-label font-display uppercase">{item.company || 'Gen-Z Tech'}</Text>
                        </View>
                        <View className={`px-3 py-1.5 rounded-full border ${item.difficulty === 'Hard' ? 'bg-danger/10 border-danger/15' : item.difficulty === 'Medium' ? 'bg-warning/10 border-warning/15' : 'bg-success/10 border-success/15' }`}>
                            <Text className={`text-label font-display uppercase ${item.difficulty === 'Hard' ? 'text-danger' : item.difficulty === 'Medium' ? 'text-warning' : 'text-success' }`}>{item.difficulty}</Text>
                        </View>
                    </View>

                    <Text className="text-ink text-sm font-display uppercase leading-6 mb-6">"{item.question}"</Text>

                    <View className="flex-row flex-wrap gap-2 mb-6">
                        <View className="bg-ink px-2.5 py-1 rounded-full">
                            <Text className="text-white text-label font-display uppercase">{item.type}</Text>
                        </View>
                        <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-ink-3 text-label font-display uppercase">{item.round}</Text>
                        </View>
                    </View>

                    <View className="flex-row justify-between items-center pt-4 border-t border-line">
                        <View className="flex-row items-center">
                            <Image
                                source={{ uri: item.postedBy?.avatar || `https://ui-avatars.com/api/?name=${item.postedBy?.username}` }}
                                className="w-6 h-6 rounded-full border border-line bg-paper-2"
                            />
                            <View className="ml-2">
                                <Text className="text-ink text-label font-display uppercase">@{item.postedBy?.username}</Text>
                                <Text className="text-ink-3 text-label uppercase font-semibold">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</Text>
                            </View>
                        </View>

                        <View className="flex-row gap-4">
                            <TouchableOpacity onPress={() => handleUpvote(item._id)} className="flex-row items-center">
                                <Ionicons name={isUpvoted ? "heart" : "heart-outline"} size={16} color={isUpvoted ? "#F97316" : "#C4BEB6"} />
                                <Text className={`ml-1 text-label font-display ${isUpvoted ? 'text-accent-text' : 'text-ink-3'}`}>{item.upvotes?.length}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        const res = await axios.get(`/placement/comments/${item._id}`);
                                        if (res.data.success) {
                                            setSelectedQuestion({ ...item, comments: res.data.comments });
                                            setDiscussionVisible(true);
                                        }
                                    } catch (e) { }
                                }}
                                className="flex-row items-center"
                            >
                                <Ionicons name="chatbubble-outline" size={14} color="#C4BEB6" />
                                <Text className="ml-1 text-label font-display text-ink-3">{item.comments?.length}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleSave(item._id)}>
                                <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={14} color={isSaved ? "#2563EB" : "#C4BEB6"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const QuestionSkeleton = () => {
        const pulseAnim = useRef(new Animated.Value(0.3)).current;
        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <Animated.View style={{ opacity: pulseAnim }} className="bg-card mx-gutter mb-6 rounded-sheet border border-line p-card-pad shadow-hair">
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

    const CommentItem = ({ comment, isReply = false }: { comment: any, isReply?: boolean }) => (
        <View className={`${isReply ? 'ml-10 mt-4' : 'mb-6'}`}>
            <View className="flex-row">
                <Image
                    source={{ uri: comment.commentor?.avatar || `https://ui-avatars.com/api/?name=${comment.commentor?.username}` }}
                    className={`${isReply ? 'w-6 h-6' : 'w-10 h-10'} rounded-card bg-paper-2 border border-line shadow-hair`}
                />
                <View className="flex-1 ml-4 bg-card p-5 rounded-card rounded-tl-none border border-line shadow-hair">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-ink font-display text-label uppercase">@{comment.commentor?.username}</Text>
                        <Text className="text-ink-3 text-label font-semibold uppercase">{comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : ''}</Text>
                    </View>
                    <Text className="text-ink-2 text-xs leading-5 font-medium">
                        {comment.replyToUser && <Text className="text-accent-text font-display">@{comment.replyToUser.username} </Text>}
                        {comment.text}
                    </Text>
                    {!isReply && (
                        <TouchableOpacity
                            onPress={() => {
                                setReplyingTo(comment);
                                setNewComment(`@${comment.commentor?.username} `);
                                commentInputRef.current?.focus();
                            }}
                            className="mt-3"
                        >
                            <Text className="text-accent-text text-label font-display uppercase">Protocol Reply</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {comment.replies && comment.replies.map((reply: any) => (
                <CommentItem key={reply._id} comment={reply} isReply={true} />
            ))}
        </View>
    );

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-gutter pt-6">
                    <View className="flex-row justify-between items-center mb-8">
                        <View>
                            <Text className="text-ink text-3xl font-display uppercase leading-tight">Career <Text className="text-fam-career">Hub</Text></Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Corporate Intelligence Unit</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setPostModalVisible(true)}
                            activeOpacity={0.8}
                            className="w-14 h-14 rounded-card bg-ink items-center justify-center shadow-hair"
                        >
                            <Ionicons name="add" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="bg-card flex-row items-center p-4 border-2 border-ink mb-6 shadow-hair overflow-hidden rounded-md">
                        <Ionicons name="search" size={20} color="#C4BEB6" />
                        <TextInput
                            placeholder="Search Interview Ledgers..."
                            placeholderTextColor="#C4BEB6"
                            value={search}
                            onChangeText={setSearch}
                            className="flex-1 ml-3 text-ink font-display uppercase text-label"
                        />
                    </View>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
                >
                    {/* Feature Cards */}
                    <View className="px-gutter mb-8 flex-row gap-4">
                        <TouchableOpacity
                            onPress={() => navigation.navigate("PlacementPredictor")}
                            accessibilityRole="button"
                            className="flex-1 bg-card border border-line rounded-card p-card-pad justify-center"
                            style={{ height: 160 }}
                        >
                            <Ionicons name="stats-chart" size={26} color="#4F46E5" />
                            <Text className="font-semibold text-base text-ink mt-4">Predictor</Text>
                            <Text className="font-sans text-sm text-ink-3 mt-1">AI Resume Scan</Text>
                        </TouchableOpacity>
                        {/* The screen's one stamp: Mock Sync is the tool this hub
                            pushes, and it is the only paid one. */}
                        <StampCard style={{ flex: 1 }}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("InterviewSetup")}
                                accessibilityRole="button"
                                className="p-card-pad justify-center"
                                style={{ height: 160 }}
                            >
                                <Ionicons name="mic" size={26} color="#EA580C" />
                                <Text className="font-semibold text-base text-ink mt-4">Mock Sync</Text>
                                <Text className="font-sans text-sm text-ink-3 mt-1">Real-time Simulation</Text>
                            </TouchableOpacity>
                        </StampCard>
                    </View>

                    {/* Companies */}
                    <View className="mb-10">
                        <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                          <Text className="text-ink-3 font-display text-label uppercase">Strategic Targets</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                            {COMPANIES.map((c, i) => (
                                <TouchableOpacity key={i} onPress={() => setSearch(c.name)} className="mr-6 items-center">
                                    <View className="bg-card w-16 h-16 rounded-card items-center justify-center border border-line shadow-hair">
                                        <FontAwesome5 name={c.icon} size={24} color={c.color} />
                                    </View>
                                    <Text className="text-ink-3 text-label mt-3 font-display uppercase">{c.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Filters */}
                    <View className="px-gutter mb-8">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {['All', ...QUESTION_TYPES].map((type, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => setActiveType(type)}
                                    className={`mr-3 px-6 py-3 rounded-card border ${activeType === type ? 'bg-ink border-ink' : 'bg-card border-line shadow-hair'}`}
                                >
                                    <Text className={`text-label font-display uppercase ${activeType === type ? 'text-white' : 'text-ink-3'}`}>{type}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Trending Header */}
                    {trending.length > 0 && (
                        <View className="mb-10">
                            <Text className="font-display text-label text-ink uppercase ml-gutter mb-4">Trending <Text className="text-fam-career">Signals</Text></Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                                {trending.map((item, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={async () => {
                                            try {
                                                const res = await axios.get(`/placement/comments/${item._id}`);
                                                if (res.data.success) {
                                                    setSelectedQuestion({ ...item, comments: res.data.comments });
                                                    setDiscussionVisible(true);
                                                }
                                            } catch (e) { }
                                        }}
                                        className="bg-card mr-4 p-6 rounded-sheet border border-fam-career/15 w-[240px] shadow-hair"
                                    >
                                        <Text className="font-semibold text-base text-ink" numberOfLines={1}>{item.company}</Text>
                                        <Text className="text-fam-career text-label font-display uppercase mt-1" numberOfLines={1}>{item.type}</Text>
                                        <View className="h-[2px] w-8 bg-fam-career my-4 rounded-full" />
                                        <Text className="text-ink-3 text-label font-medium leading-5" numberOfLines={2}>"{item.question}"</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Main Feed */}
                    <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                      <Text className="text-ink-3 font-display text-label uppercase">Global Intel Stream</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>
                    {loading && !refreshing ? (
                        <View>{[1, 2, 3].map(i => <QuestionSkeleton key={i} />)}</View>
                    ) : (
                        <FlatList
                            data={questions}
                            scrollEnabled={false}
                            keyExtractor={(item) => item._id}
                            renderItem={renderQuestionCard}
                            ListEmptyComponent={
                                <View className="items-center py-20 px-gutter">
                                    <Ionicons name="document-text-outline" size={48} color="#C4BEB6" />
                                    <Text className="font-semibold text-base text-ink mt-6 text-center">No Intelligence Found</Text>
                                </View>
                            }
                        />
                    )}
                </ScrollView>

                {/* --- POST MODAL --- */}
                <Modal visible={isPostModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPostModalVisible(false)}>
                    <View className="flex-1 bg-paper">
                        <StatusBar barStyle="dark-content" />
                        <View className="flex-row justify-between items-center px-gutter py-6 border-b border-line bg-card">
                            <View>
                                <Text className="text-xl font-display text-ink uppercase leading-tight">Contribution <Text className="text-fam-career">Ledger</Text></Text>
                                <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Share Interview Intelligence</Text>
                            </View>
                            <TouchableOpacity onPress={() => setPostModalVisible(false)} className="bg-paper-2 p-2 rounded-card border border-line">
                                <Ionicons name="close" size={20} color="#12100E" />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView behavior="padding" className="flex-1">
                            <ScrollView className="p-card-pad" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                                <Text className="text-ink-3 text-label font-display uppercase mb-4">Core Context</Text>
                                <View className="bg-card rounded-sheet p-6 border border-line shadow-hair mb-8">
                                    <TextInput
                                        placeholder="Company Name" placeholderTextColor="#C4BEB6"
                                        value={form.company} onChangeText={t => setForm({ ...form, company: t })}
                                        className="font-semibold text-base text-ink mb-6 border-b border-line pb-4"
                                    />
                                    <TextInput
                                        placeholder="Role Assigned" placeholderTextColor="#C4BEB6"
                                        value={form.role} onChangeText={t => setForm({ ...form, role: t })}
                                        className="font-semibold text-base text-ink mb-6 border-b border-line pb-4"
                                    />
                                    <TextInput
                                        placeholder="Interview Round" placeholderTextColor="#C4BEB6"
                                        value={form.round} onChangeText={t => setForm({ ...form, round: t })}
                                        className="text-ink font-display uppercase text-label"
                                    />
                                </View>

                                <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                                  <Text className="text-ink-3 text-label font-display uppercase">Categorization</Text>
                                  <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-8">
                                    {QUESTION_TYPES.map(t => (
                                        <TouchableOpacity
                                            key={t} onPress={() => setForm({ ...form, type: t })}
                                            className={`mr-3 px-6 py-3 rounded-card border ${form.type === t ? 'bg-ink border-ink' : 'bg-card border-line'}`}
                                        >
                                            <Text className={`text-label font-display uppercase ${form.type === t ? 'text-white' : 'text-ink-3'}`}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <Text className="text-ink-3 text-label font-display uppercase mb-4">Intelligence Details</Text>
                                <View className="bg-card rounded-sheet p-6 border border-line shadow-hair mb-12">
                                    <TextInput
                                        placeholder="Establish the question..." placeholderTextColor="#C4BEB6"
                                        multiline value={form.question} onChangeText={t => setForm({ ...form, question: t })}
                                        className="font-semibold text-base text-ink min-h-[120px] mb-4"
                                        textAlignVertical="top"
                                    />
                                    <View className="h-[1px] bg-paper-2 w-full mb-6" />
                                    <TextInput
                                        placeholder="Internal Approach / Hints (Optional)" placeholderTextColor="#C4BEB6"
                                        multiline value={form.description} onChangeText={t => setForm({ ...form, description: t })}
                                        className="text-ink-3 font-medium text-label min-h-[100px]"
                                        textAlignVertical="top"
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handlePost}
                                    className="bg-fam-career py-6 rounded-card items-center shadow-hair"
                                >
                                    <Text className="text-white font-display uppercase text-xs">Deploy Intel to Hub</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </View>
                </Modal>

                {/* --- DISCUSSION MODAL --- */}
                <Modal visible={isDiscussionVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiscussionVisible(false)}>
                    <View className="flex-1 bg-paper">
                        <StatusBar barStyle="dark-content" />
                        <View className="flex-row justify-between items-center px-gutter py-6 border-b border-line bg-card shadow-hair">
                            <View>
                                <Text className="text-xl font-display text-ink uppercase leading-tight">Intelligence <Text className="text-recruiter">Sync</Text></Text>
                                <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Deep Dive Protocol</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setDiscussionVisible(false); setReplyingTo(null); }} className="bg-paper-2 p-2 rounded-card border border-line">
                                <Ionicons name="close" size={20} color="#12100E" />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView behavior="padding" className="flex-1">
                            <ScrollView className="flex-1 p-card-pad" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                                {selectedQuestion && (
                                    <View className="mb-10 bg-card p-card-pad rounded-sheet border border-recruiter/15 shadow-hair">
                                        <View className="bg-recruiter/10 self-start px-3 py-1.5 rounded-full border border-recruiter/15 mb-6">
                                            <Text className="text-recruiter font-display text-label uppercase">{selectedQuestion.company}</Text>
                                        </View>
                                        <Text className="text-ink text-lg leading-7 font-display uppercase">"{selectedQuestion.question}"</Text>

                                        {selectedQuestion.description && (
                                            <View className="mt-8 pt-8 border-t border-line">
                                                <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                                                  <Text className="text-ink-3 text-label font-display uppercase">Intel Input</Text>
                                                  <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                                                </View>
                                                <Text className="text-ink-3 text-xs leading-6 font-medium">"{selectedQuestion.description}"</Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                <View className="flex-row items-center mb-8 px-2">
                                    <Text className="text-ink-3 text-label font-display uppercase">Response Ledger</Text>
                                    <View className="h-[1px] bg-paper-2 flex-1 ml-4" />
                                </View>

                                {selectedQuestion?.comments?.map((c: any, i: number) => (
                                    <CommentItem key={i} comment={c} />
                                ))}
                            </ScrollView>

                            <View className="p-card-pad bg-card border-t border-line shadow-hair">
                                {replyingTo && (
                                    <View className="flex-row items-center justify-between bg-paper-2 px-4 py-2.5 mb-4 rounded-xl border border-line">
                                        <Text className="text-accent-text text-label font-display uppercase">Sync: @{replyingTo.commentor?.username}</Text>
                                        <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                            <Ionicons name="close-circle" size={16} color="#F97316" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <View className="flex-row items-center gap-4">
                                    <View className="flex-1 bg-paper border border-line rounded-card px-6 h-16 justify-center">
                                        <TextInput
                                            ref={commentInputRef}
                                            placeholder="Establish intelligence..." placeholderTextColor="#C4BEB6"
                                            value={newComment} onChangeText={setNewComment}
                                            className="text-ink font-display uppercase text-label"
                                            multiline
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={handleComment}
                                        className="bg-ink w-16 h-16 items-center justify-center border-2 border-ink rounded-md"
                                    >
                                        <Ionicons name="paper-plane" size={20} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </Modal>
            </SafeAreaView>
        </View >
    );
};

export default PlacementHub;
