import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Modal, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Image, Animated, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';
import { Alert } from '../ui/AlertModal';

const COMPANIES = [
    { name: 'Google', icon: 'google', color: '#4285F4' },
    { name: 'Amazon', icon: 'amazon', color: '#FF9900' },
    { name: 'Microsoft', icon: 'microsoft', color: '#00A4EF' },
    { name: 'Meta', icon: 'facebook', color: '#0668E1' },
    { name: 'Apple', icon: 'apple', color: '#555555' },
    { name: 'Netflix', icon: 'netflix', color: '#E50914' },
    { name: 'Uber', icon: 'car-side', color: '#000000' },
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
            <View className="bg-white mx-8 mb-6 rounded-4xl border border-slate-100 shadow-sm shadow-black/5 overflow-hidden">
                <View className="p-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide ">{item.company || 'Gen-Z Tech'}</Text>
                        </View>
                        <View className={`px-3 py-1.5 rounded-full border ${item.difficulty === 'Hard' ? 'bg-rose-50 border-rose-100' :
                                item.difficulty === 'Medium' ? 'bg-amber-50 border-amber-100' :
                                    'bg-emerald-50 border-emerald-100'
                            }`}>
                            <Text className={`text-2xs font-black uppercase tracking-widest  ${item.difficulty === 'Hard' ? 'text-rose-500' :
                                    item.difficulty === 'Medium' ? 'text-amber-500' :
                                        'text-emerald-500'
                                }`}>{item.difficulty}</Text>
                        </View>
                    </View>

                    <Text className="text-slate-900 text-sm font-black  uppercase leading-6 mb-6">"{item.question}"</Text>

                    <View className="flex-row flex-wrap gap-2 mb-6">
                        <View className="bg-slate-900 px-3 py-1 rounded-lg">
                            <Text className="text-white text-2xs font-black uppercase tracking-wide">{item.type}</Text>
                        </View>
                        <View className="bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">{item.round}</Text>
                        </View>
                    </View>

                    <View className="flex-row justify-between items-center pt-4 border-t border-slate-50">
                        <View className="flex-row items-center">
                            <Image
                                source={{ uri: item.postedBy?.avatar || `https://ui-avatars.com/api/?name=${item.postedBy?.username}` }}
                                className="w-6 h-6 rounded-full border border-slate-200 bg-slate-50"
                            />
                            <View className="ml-2">
                                <Text className="text-slate-900 text-2xs font-black  uppercase tracking-tighter">@{item.postedBy?.username}</Text>
                                <Text className="text-slate-500 text-2xs uppercase font-bold">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</Text>
                            </View>
                        </View>

                        <View className="flex-row gap-4">
                            <TouchableOpacity onPress={() => handleUpvote(item._id)} className="flex-row items-center">
                                <Ionicons name={isUpvoted ? "heart" : "heart-outline"} size={16} color={isUpvoted ? "#ec4899" : "#CBD5E1"} />
                                <Text className={`ml-1 text-2xs font-black ${isUpvoted ? 'text-pink-500' : 'text-slate-500'}`}>{item.upvotes?.length}</Text>
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
                                <Ionicons name="chatbubble-outline" size={14} color="#CBD5E1" />
                                <Text className="ml-1 text-2xs font-black text-slate-500">{item.comments?.length}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleSave(item._id)}>
                                <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={14} color={isSaved ? "#3b82f6" : "#CBD5E1"} />
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
            <Animated.View style={{ opacity: pulseAnim }} className="bg-white mx-8 mb-6 rounded-4xl border border-slate-100 p-8 shadow-sm shadow-black/5">
                <View className="flex-row justify-between mb-6">
                    <View className="h-6 bg-slate-50 rounded-full w-24" />
                    <View className="h-6 bg-slate-50 rounded-full w-20" />
                </View>
                <View className="h-4 bg-slate-50 rounded w-full mb-3" />
                <View className="h-4 bg-slate-50 rounded w-4/5 mb-8" />
                <View className="flex-row gap-2 mb-8">
                    <View className="w-16 h-5 bg-slate-50 rounded-lg" />
                    <View className="w-16 h-5 bg-slate-50 rounded-lg" />
                </View>
                <View className="flex-row justify-between items-center pt-6 border-t border-slate-50">
                    <View className="flex-row items-center">
                        <View className="w-6 h-6 bg-slate-50 rounded-full" />
                        <View className="w-20 h-4 bg-slate-50 rounded ml-2" />
                    </View>
                    <View className="flex-row gap-4">
                        <View className="w-6 h-6 bg-slate-50 rounded-full" />
                        <View className="w-6 h-6 bg-slate-50 rounded-full" />
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
                    className={`${isReply ? 'w-6 h-6' : 'w-10 h-10'} rounded-2xl bg-slate-50 border border-slate-100 shadow-sm`}
                />
                <View className="flex-1 ml-4 bg-white p-5 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-slate-900 font-black  text-2xs uppercase tracking-tight">@{comment.commentor?.username}</Text>
                        <Text className="text-slate-500 text-2xs font-bold uppercase">{comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : ''}</Text>
                    </View>
                    <Text className="text-slate-600 text-xs leading-5 font-medium ">
                        {comment.replyToUser && <Text className="text-pink-500 font-black">@{comment.replyToUser.username} </Text>}
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
                            <Text className="text-pink-500 text-2xs font-black uppercase tracking-wide ">Protocol Reply</Text>
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
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            <View className="absolute top-0 w-full h-80 opacity-10">
                <LinearGradient colors={['#3b82f6', 'transparent']} className="w-full h-full" />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-8 pt-6">
                    <View className="flex-row justify-between items-center mb-8">
                        <View>
                            <Text className="text-slate-900 text-3xl font-black  uppercase tracking-tighter leading-tight">Career <Text className="text-blue-500">Hub</Text></Text>
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Corporate Intelligence Unit</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setPostModalVisible(true)}
                            activeOpacity={0.8}
                            className="w-14 h-14 rounded-2xl bg-slate-900 items-center justify-center shadow-2xl shadow-black/40"
                        >
                            <Ionicons name="add" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="bg-white flex-row items-center p-4 rounded-3xl border border-slate-100 mb-6 shadow-sm overflow-hidden">
                        <Ionicons name="search" size={20} color="#CBD5E1" />
                        <TextInput
                            placeholder="Search Interview Ledgers..."
                            placeholderTextColor="#CBD5E1"
                            value={search}
                            onChangeText={setSearch}
                            className="flex-1 ml-3 text-slate-900 font-black  uppercase text-2xs"
                        />
                    </View>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
                >
                    {/* Feature Cards */}
                    <View className="px-8 mb-8 flex-row gap-4">
                        <TouchableOpacity
                            onPress={() => navigation.navigate("PlacementPredictor")}
                            className="flex-1"
                        >
                            <LinearGradient colors={['#4f46e5', '#3730a3']} className="p-5 rounded-4xl h-40 justify-center">
                                <Ionicons name="stats-chart" size={28} color="white" />
                                <Text className="text-white text-xs font-black  uppercase mt-4 tracking-tighter">Predictor</Text>
                                <Text className="text-white/50 text-2xs font-black uppercase mt-1">AI Resume Scan</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("InterviewSetup")}
                            className="flex-1"
                        >
                            <LinearGradient colors={['#ec4899', '#be185d']} className="p-5 rounded-4xl h-40 justify-center">
                                <Ionicons name="mic" size={28} color="white" />
                                <Text className="text-white text-xs font-black  uppercase mt-4 tracking-tighter">Mock Sync</Text>
                                <Text className="text-white/50 text-2xs font-black uppercase mt-1">Real-time Simulation</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Companies */}
                    <View className="mb-10">
                        <Text className="text-slate-500 font-black text-2xs uppercase ml-8 mb-4 tracking-wide ">Strategic Targets</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                            {COMPANIES.map((c, i) => (
                                <TouchableOpacity key={i} onPress={() => setSearch(c.name)} className="mr-6 items-center">
                                    <View className="bg-white w-16 h-16 rounded-2xl items-center justify-center border border-slate-100 shadow-sm shadow-black/5">
                                        <FontAwesome5 name={c.icon} size={24} color={c.color} />
                                    </View>
                                    <Text className="text-slate-500 text-2xs mt-3 font-black uppercase  tracking-tighter">{c.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Filters */}
                    <View className="px-8 mb-8">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {['All', ...QUESTION_TYPES].map((type, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => setActiveType(type)}
                                    className={`mr-3 px-6 py-3 rounded-2xl border ${activeType === type ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-100 shadow-sm'}`}
                                >
                                    <Text className={`text-2xs font-black  uppercase tracking-widest ${activeType === type ? 'text-white' : 'text-slate-500'}`}>{type}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Trending Header */}
                    {trending.length > 0 && (
                        <View className="mb-10">
                            <Text className="text-slate-900 font-black text-2xs uppercase ml-8 mb-4 tracking-wide ">Trending <Text className="text-blue-500">Signals</Text> 🔥</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
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
                                        className="bg-white mr-4 p-6 rounded-4xl border border-blue-100 w-[240px] shadow-sm shadow-blue-500/5"
                                    >
                                        <Text className="text-slate-900 font-black  text-xs uppercase" numberOfLines={1}>{item.company}</Text>
                                        <Text className="text-blue-500 text-2xs font-black uppercase tracking-wide mt-1 " numberOfLines={1}>{item.type}</Text>
                                        <View className="h-[2px] w-8 bg-blue-500 my-4 rounded-full" />
                                        <Text className="text-slate-500 text-2xs font-medium leading-5 " numberOfLines={2}>"{item.question}"</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Main Feed */}
                    <Text className="text-slate-500 font-black text-2xs uppercase ml-8 mb-4 tracking-wide ">Global Intel Stream</Text>
                    {loading && !refreshing ? (
                        <View>{[1, 2, 3].map(i => <QuestionSkeleton key={i} />)}</View>
                    ) : (
                        <FlatList
                            data={questions}
                            scrollEnabled={false}
                            keyExtractor={(item) => item._id}
                            renderItem={renderQuestionCard}
                            ListEmptyComponent={
                                <View className="items-center py-20 px-8">
                                    <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                                    <Text className="text-slate-500 font-black uppercase text-xs tracking-wide mt-6 text-center ">No Intelligence Found</Text>
                                </View>
                            }
                        />
                    )}
                </ScrollView>

                {/* --- POST MODAL --- */}
                <Modal visible={isPostModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPostModalVisible(false)}>
                    <View className="flex-1 bg-[#F8FAFC]">
                        <StatusBar barStyle="dark-content" />
                        <View className="flex-row justify-between items-center px-8 py-6 border-b border-slate-100 bg-white">
                            <View>
                                <Text className="text-xl font-black text-slate-900  tracking-tighter uppercase leading-tight">Contribution <Text className="text-blue-500">Ledger</Text></Text>
                                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Share Interview Intelligence</Text>
                            </View>
                            <TouchableOpacity onPress={() => setPostModalVisible(false)} className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                <Ionicons name="close" size={20} color="#18181b" />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView behavior="padding" className="flex-1">
                            <ScrollView className="p-8" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-4">Core Context</Text>
                                <View className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm mb-8">
                                    <TextInput
                                        placeholder="Company Name" placeholderTextColor="#CBD5E1"
                                        value={form.company} onChangeText={t => setForm({ ...form, company: t })}
                                        className="text-slate-900 font-black  uppercase text-xs mb-6 border-b border-slate-50 pb-4"
                                    />
                                    <TextInput
                                        placeholder="Role Assigned" placeholderTextColor="#CBD5E1"
                                        value={form.role} onChangeText={t => setForm({ ...form, role: t })}
                                        className="text-slate-900 font-black  uppercase text-xs mb-6 border-b border-slate-50 pb-4"
                                    />
                                    <TextInput
                                        placeholder="Interview Round" placeholderTextColor="#CBD5E1"
                                        value={form.round} onChangeText={t => setForm({ ...form, round: t })}
                                        className="text-slate-900 font-black  uppercase text-2xs"
                                    />
                                </View>

                                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-4">Categorization</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-8">
                                    {QUESTION_TYPES.map(t => (
                                        <TouchableOpacity
                                            key={t} onPress={() => setForm({ ...form, type: t })}
                                            className={`mr-3 px-6 py-3 rounded-2xl border ${form.type === t ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-100'}`}
                                        >
                                            <Text className={`text-2xs font-black  uppercase tracking-widest ${form.type === t ? 'text-white' : 'text-slate-500'}`}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-4">Intelligence Details</Text>
                                <View className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm mb-12">
                                    <TextInput
                                        placeholder="Establish the question..." placeholderTextColor="#CBD5E1"
                                        multiline value={form.question} onChangeText={t => setForm({ ...form, question: t })}
                                        className="text-slate-900 font-black  uppercase text-xs min-h-[120px] mb-4"
                                        textAlignVertical="top"
                                    />
                                    <View className="h-[1px] bg-slate-50 w-full mb-6" />
                                    <TextInput
                                        placeholder="Internal Approach / Hints (Optional)" placeholderTextColor="#CBD5E1"
                                        multiline value={form.description} onChangeText={t => setForm({ ...form, description: t })}
                                        className="text-slate-500 font-medium  text-2xs min-h-[100px]"
                                        textAlignVertical="top"
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handlePost}
                                    className="bg-blue-600 py-6 rounded-2xl items-center shadow-xl shadow-blue-500/20"
                                >
                                    <Text className="text-white font-black  uppercase tracking-wide text-xs">Deploy Intel to Hub</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </View>
                </Modal>

                {/* --- DISCUSSION MODAL --- */}
                <Modal visible={isDiscussionVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiscussionVisible(false)}>
                    <View className="flex-1 bg-[#F8FAFC]">
                        <StatusBar barStyle="dark-content" />
                        <View className="flex-row justify-between items-center px-8 py-6 border-b border-slate-100 bg-white shadow-sm">
                            <View>
                                <Text className="text-xl font-black text-slate-900  tracking-tighter uppercase leading-tight">Intelligence <Text className="text-indigo-500">Sync</Text></Text>
                                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Deep Dive Protocol</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setDiscussionVisible(false); setReplyingTo(null); }} className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                <Ionicons name="close" size={20} color="#18181b" />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView behavior="padding" className="flex-1">
                            <ScrollView className="flex-1 p-8" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                                {selectedQuestion && (
                                    <View className="mb-10 bg-white p-8 rounded-5xl border border-indigo-100 shadow-sm shadow-indigo-500/5">
                                        <View className="bg-indigo-50 self-start px-3 py-1.5 rounded-full border border-indigo-100 mb-6">
                                            <Text className="text-indigo-600 font-black  text-2xs uppercase tracking-wide">{selectedQuestion.company}</Text>
                                        </View>
                                        <Text className="text-slate-900 text-lg leading-7 font-black  uppercase ">"{selectedQuestion.question}"</Text>

                                        {selectedQuestion.description && (
                                            <View className="mt-8 pt-8 border-t border-slate-50">
                                                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-4 ">Intel Input</Text>
                                                <Text className="text-slate-500 text-xs  leading-6 font-medium">"{selectedQuestion.description}"</Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                <View className="flex-row items-center mb-8 px-2">
                                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide ">Response Ledger</Text>
                                    <View className="h-[1px] bg-slate-100 flex-1 ml-4" />
                                </View>

                                {selectedQuestion?.comments?.map((c: any, i: number) => (
                                    <CommentItem key={i} comment={c} />
                                ))}
                            </ScrollView>

                            <View className="p-8 bg-white border-t border-slate-100 shadow-2xl">
                                {replyingTo && (
                                    <View className="flex-row items-center justify-between bg-pink-50 px-4 py-2.5 mb-4 rounded-xl border border-pink-100">
                                        <Text className="text-pink-500 text-2xs font-black  uppercase">Sync: @{replyingTo.commentor?.username}</Text>
                                        <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                            <Ionicons name="close-circle" size={16} color="#ec4899" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <View className="flex-row items-center gap-4">
                                    <View className="flex-1 bg-[#F8FAFC] border border-slate-100 rounded-3xl px-6 h-16 justify-center">
                                        <TextInput
                                            ref={commentInputRef}
                                            placeholder="Establish intelligence..." placeholderTextColor="#CBD5E1"
                                            value={newComment} onChangeText={setNewComment}
                                            className="text-slate-900 font-black  uppercase text-2xs"
                                            multiline
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={handleComment}
                                        className="bg-slate-900 w-16 h-16 rounded-2xl items-center justify-center shadow-2xl shadow-black/40"
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
