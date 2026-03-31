import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    FlatList, Modal, ActivityIndicator, Alert, RefreshControl,
    KeyboardAvoidingView, Platform, Image, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';

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

    // Auth User IDs
    const CURRENT_USER_ID = user?._id || user?.id;

    // View Discussion State
    const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
    const [isDiscussionVisible, setDiscussionVisible] = useState(false);
    const [newComment, setNewComment] = useState('');

    // Post Modal State
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
            setLoading(true);
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
            return Alert.alert("Error", "Please fill required fields");
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
                Alert.alert("Success", "Question shared with the community!");
            }
        } catch (error) { Alert.alert("Error", "Failed to post."); }
    };

    const [replyingTo, setReplyingTo] = useState<any>(null);
    const commentInputRef = React.useRef<TextInput>(null);

    const handleComment = async () => {
        if (!newComment.trim() || !selectedQuestion) return;
        try {
            const res = await axios.post(`/placement/comment/${selectedQuestion._id}`, { 
                text: newComment,
                parentCommentId: replyingTo?._id 
            });
            if (res.data.success) {
                // Fetch all comments again to get updated structure
                const commentsRes = await axios.get(`/placement/comments/${selectedQuestion._id}`);
                if (commentsRes.data.success) {
                    setSelectedQuestion({ ...selectedQuestion, comments: commentsRes.data.comments });
                }
                setNewComment('');
                setReplyingTo(null);
                fetchQuestions(); // Refresh counts in the main list
            }
        } catch (error) { Alert.alert("Error", "Failed to comment."); }
    };

    const CommentItem = ({ comment, isReply = false }: { comment: any, isReply?: boolean }) => (
        <View className={`${isReply ? 'ml-10 mt-4' : 'mb-8'}`}>
            <View className="flex-row">
                <Image source={{ uri: comment.commentor?.avatar || `https://ui-avatars.com/api/?name=${comment.commentor?.username}` }} className={`${isReply ? 'w-7 h-7' : 'w-9 h-9'} rounded-2xl bg-gray-900 border border-white/10`} />
                <View className="flex-1 ml-4 bg-[#0a0a0a] p-5 rounded-[24px] rounded-tl-none border border-white/5 shadow-2xl">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-indigo-400 font-black text-[10px] uppercase tracking-wider">@{comment.commentor?.username}</Text>
                        <Text className="text-gray-700 text-[8px] font-bold">{comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : ''}</Text>
                    </View>
                    <Text className="text-gray-300 text-xs leading-5 font-medium">
                        {comment.replyToUser && <Text className="text-pink-500">@{comment.replyToUser.username} </Text>}
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
                            <Text className="text-indigo-400/80 text-[9px] font-black uppercase tracking-widest">Reply</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {comment.replies && comment.replies.map((reply: any) => (
                <CommentItem key={reply._id} comment={reply} isReply={true} />
            ))}
        </View>
    );

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
            <Animated.View 
                style={{ opacity: pulseAnim }}
                className="bg-[#1e1e1e]/50 p-6 rounded-[32px] mb-4 mx-5 border border-white/5"
            >
                <View className="flex-row items-center mb-5">
                    <View className="w-10 h-10 bg-zinc-800 rounded-2xl" />
                    <View className="ml-4 flex-1">
                        <View className="h-4 bg-zinc-800 rounded w-2/3 mb-2" />
                        <View className="h-3 bg-zinc-800 rounded w-1/3" />
                    </View>
                    <View className="w-12 h-5 bg-zinc-800 rounded-full" />
                </View>
                <View className="h-4 bg-zinc-800 rounded w-full mb-3" />
                <View className="h-4 bg-zinc-800 rounded w-4/5 mb-6" />
                
                <View className="flex-row gap-2 mb-6">
                    <View className="w-16 h-4 bg-zinc-800 rounded-lg" />
                    <View className="w-16 h-4 bg-zinc-800 rounded-lg" />
                </View>

                <View className="flex-row justify-between items-center pt-4 border-t border-white/5">
                    <View className="flex-row items-center">
                        <View className="w-5 h-5 bg-zinc-800 rounded-full" />
                        <View className="w-20 h-3 bg-zinc-800 rounded ml-2" />
                    </View>
                    <View className="flex-row gap-4">
                        <View className="w-6 h-6 bg-zinc-800 rounded-full" />
                        <View className="w-6 h-6 bg-zinc-800 rounded-full" />
                        <View className="w-6 h-6 bg-zinc-800 rounded-full" />
                    </View>
                </View>
            </Animated.View>
        );
    };

    const renderQuestionCard = ({ item }: { item: any }) => {
        const isUpvoted = item.upvotes.includes(CURRENT_USER_ID);
        const isSaved = item.savedBy.includes(CURRENT_USER_ID);

        return (
            <View className="bg-[#1e1e1e]/90 p-5 rounded-3xl mb-4 mx-5 border border-white/10 shadow-xl">
                <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-row items-center">
                        <View className="bg-gray-800 w-10 h-10 rounded-2xl items-center justify-center border border-white/5">
                            <MaterialCommunityIcons name="office-building" size={20} color="#6366f1" />
                        </View>
                        <View className="ml-3">
                            <Text className="text-white font-black text-sm tracking-tight">{item.company}</Text>
                            <Text className="text-gray-500 text-[10px] uppercase font-bold">{item.role}</Text>
                        </View>
                    </View>
                    <View className={`px-3 py-1 rounded-full border ${item.difficulty === 'Hard' ? 'bg-red-500/10 border-red-500/30' :
                        item.difficulty === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                            'bg-green-500/10 border-green-500/30'
                        }`}>
                        <Text className={`text-[8px] font-black uppercase ${item.difficulty === 'Hard' ? 'text-red-500' :
                            item.difficulty === 'Medium' ? 'text-yellow-500' :
                                'text-green-500'
                            }`}>{item.difficulty}</Text>
                    </View>
                </View>

                <Text className="text-gray-200 text-sm font-medium leading-5 mb-4" numberOfLines={3}>
                    {item.question}
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-4">
                    <View className="bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                        <Text className="text-indigo-400 text-[8px] font-bold uppercase">{item.type}</Text>
                    </View>
                    <View className="bg-gray-800/50 px-2 py-1 rounded-lg border border-white/5">
                        <Text className="text-gray-400 text-[8px] font-bold uppercase font-mono">{item.round}</Text>
                    </View>
                </View>

                <View className="flex-row justify-between items-center pt-3 border-t border-white/5">
                    <View className="flex-row items-center">
                        <Image source={{ uri: item.postedBy?.avatar }} className="w-5 h-5 rounded-full border border-white/10" />
                        <Text className="text-gray-500 text-[10px] ml-2 font-medium">@{item.postedBy?.username}</Text>
                        <Text className="text-gray-700 text-[10px] mx-1">•</Text>
                        <Text className="text-gray-600 text-[9px]">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</Text>
                    </View>

                    <View className="flex-row gap-3">
                        <TouchableOpacity onPress={() => handleUpvote(item._id)} className="flex-row items-center">
                            <Ionicons name={isUpvoted ? "caret-up-circle" : "caret-up-circle-outline"} size={20} color={isUpvoted ? "#ec4899" : "#666"} />
                            <Text className={`ml-1 text-[10px] font-bold ${isUpvoted ? 'text-pink-500' : 'text-gray-600'}`}>{item.upvotes.length}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={async () => { 
                                try {
                                    const res = await axios.get(`/placement/comments/${item._id}`);
                                    if(res.data.success) {
                                        setSelectedQuestion({ ...item, comments: res.data.comments });
                                        setDiscussionVisible(true);
                                    }
                                } catch(e) {}
                            }} 
                            className="flex-row items-center"
                        >
                            <Ionicons name="chatbubble-outline" size={18} color="#666" />
                            <Text className="ml-1 text-[10px] text-gray-600 font-bold">{item.comments.length}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleSave(item._id)}>
                            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={18} color={isSaved ? "#6366f1" : "#666"} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-black">
            <LinearGradient colors={['rgba(99, 102, 241, 0.25)', 'rgba(0,0,0,0.9)', '#000000']} className="absolute w-full h-full" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 pt-2 pb-4 flex-row justify-between items-center">
                    <View>
                        <Text className="text-white text-3xl font-black italic tracking-tighter">PLACEMENT<Text className="text-indigo-500">HUB</Text></Text>
                        <Text className="text-gray-500 text-xs font-medium">Real questions. Real interviews.</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setPostModalVisible(true)}
                        className="bg-indigo-600 w-12 h-12 rounded-2xl items-center justify-center shadow-lg shadow-indigo-500/40"
                    >
                        <Ionicons name="add" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
                >
                    {/* ... (Previous predictive/predictor section same) */}
                    <View className="px-5 mb-8">
                        <TouchableOpacity 
                            onPress={() => navigation.navigate("PlacementPredictor")}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#4f46e5', '#7c3aed']}
                                start={{x: 0, y: 0}}
                                end={{x: 1, y: 0}}
                                className="p-6 rounded-[32px] overflow-hidden flex-row items-center border border-white/10 shadow-lg shadow-indigo-500/30"
                            >
                                <View className="flex-1">
                                    <View className="bg-white/20 self-start px-3 py-1 rounded-full mb-3">
                                        <Text className="text-white text-[8px] font-black uppercase tracking-[2px]">New Feature ✨</Text>
                                    </View>
                                    <Text className="text-white text-xl font-black uppercase">Placement <Text className="text-pink-400">Predictor</Text></Text>
                                    <Text className="text-white/70 text-[10px] font-bold mt-1 leading-4">AI-powered resume & GPA analysis to predict your dream company match.</Text>
                                </View>
                                <View className="bg-white/10 w-16 h-16 rounded-3xl items-center justify-center border border-white/20">
                                    <Ionicons name="stats-chart" size={30} color="white" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Top Companies Section */}
                    <View className="mb-8">
                        <Text className="text-gray-400 font-black text-[10px] uppercase ml-6 mb-4 tracking-widest">Target Top Companies</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                            {COMPANIES.map((c, i) => (
                                <TouchableOpacity key={i} onPress={() => setSearch(c.name)} className="mr-4 items-center">
                                    <View className="bg-gray-900 w-16 h-16 rounded-3xl items-center justify-center border border-white/5 shadow-2xl">
                                        <FontAwesome5 name={c.icon} size={24} color={c.color} />
                                    </View>
                                    <Text className="text-gray-500 text-[10px] mt-2 font-bold">{c.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Search & Global Filters */}
                    <View className="px-5 mb-6">
                        <View className="bg-white/5 flex-row items-center p-4 rounded-3xl border border-white/5 mb-4 shadow-sm">
                            <Ionicons name="search" size={20} color="#666" />
                            <TextInput
                                placeholder="Search: 'Amazon SDE', 'Dynamic Programming'..."
                                placeholderTextColor="#444"
                                value={search}
                                onChangeText={setSearch}
                                className="flex-1 ml-3 text-white font-medium"
                            />
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {['All', ...QUESTION_TYPES].map((type, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => setActiveType(type)}
                                    className={`mr-2 px-6 py-2 rounded-full border ${activeType === type ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-900 border-white/5'}`}
                                >
                                    <Text className={`text-[10px] font-black uppercase tracking-widest ${activeType === type ? 'text-white' : 'text-gray-500'}`}>{type}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Trending Section */}
                    {trending.length > 0 && (
                        <View className="mb-8">
                            <View className="flex-row justify-between items-center px-6 mb-4">
                                <Text className="text-indigo-400 font-black text-[10px] uppercase tracking-widest">Trending Now 🔥</Text>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                                {trending.map((item, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={async () => { 
                                            /* same discussion logic */ 
                                            try {
                                                const res = await axios.get(`/placement/comments/${item._id}`);
                                                if(res.data.success) {
                                                    setSelectedQuestion({ ...item, comments: res.data.comments });
                                                    setDiscussionVisible(true);
                                                }
                                            } catch(e) {}
                                        }}
                                        className="bg-zinc-900/50 mr-4 p-5 rounded-[32px] border border-white/5 w-[220px]"
                                    >
                                        <Text className="text-white font-black text-xs" numberOfLines={1}>{item.company}</Text>
                                        <Text className="text-gray-500 text-[10px] font-bold mt-1 uppercase" numberOfLines={1}>{item.role}</Text>
                                        <View className="h-[2px] w-8 bg-indigo-500 my-4 rounded-full" />
                                        <Text className="text-gray-400 text-[10px] italic leading-4" numberOfLines={2}>"{item.question}"</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Main Feed */}
                    <Text className="text-gray-400 font-black text-[10px] uppercase ml-6 mb-4 tracking-widest">Recent Questions</Text>
                    {loading && !refreshing ? (
                        <View>
                            {[1, 2, 3].map(i => <QuestionSkeleton key={i} />)}
                        </View>
                    ) : (
                        <FlatList
                            data={questions}
                            scrollEnabled={false}
                            keyExtractor={(item) => item._id}
                            renderItem={renderQuestionCard}
                            ListEmptyComponent={
                                <View className="items-center py-20 opacity-20">
                                    <Ionicons name="documents-outline" size={64} color="white" />
                                    <Text className="text-white font-bold mt-4 uppercase text-[10px] tracking-widest">No matching questions found</Text>
                                </View>
                            }
                        />
                    )}
                </ScrollView>

                {/* --- POST MODAL --- */}
                <Modal visible={isPostModalVisible} animationType="slide" transparent={true}>
                    <View className="flex-1 bg-black">
                        <SafeAreaView className="flex-1">
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                                {/* Enhanced Header */}
                                <View className="flex-row justify-between items-center px-6 py-5 border-b border-white/5">
                                    <TouchableOpacity
                                        onPress={() => setPostModalVisible(false)}
                                        className="bg-white/5 w-10 h-10 rounded-full items-center justify-center border border-white/10"
                                    >
                                        <Ionicons name="close" size={24} color="#9ca3af" />
                                    </TouchableOpacity>
                                    <View className="items-center">
                                        <Text className="text-white font-black uppercase tracking-[3px] text-xs">Share Insight</Text>
                                        <Text className="text-indigo-400 text-[8px] font-bold uppercase mt-1">Helping the community grow</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={handlePost}
                                        className="bg-indigo-600 px-6 py-2 rounded-2xl shadow-lg shadow-indigo-500/40"
                                    >
                                        <Text className="text-white font-black text-[10px] uppercase">Submit</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView className="px-6 pt-8" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

                                    {/* Section 1: Experience Context */}
                                    <View className="mb-10">
                                        <View className="flex-row items-center mb-4">
                                            <View className="w-1 h-4 bg-indigo-500 rounded-full mr-3" />
                                            <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Experience Details</Text>
                                        </View>
                                        <View className="bg-black/90 rounded-[24px] p-4 border border-white/10">
                                            <View className="flex-row items-center mb-2 border-b border-white/5 pb-0.5">
                                                <MaterialCommunityIcons name="office-building" size={16} color="#444" />
                                                <TextInput
                                                    placeholder="Target Company"
                                                    placeholderTextColor="#333"
                                                    value={form.company}
                                                    onChangeText={t => setForm({ ...form, company: t })}
                                                    className="flex-1 ml-2 text-white font-black text-sm"
                                                />
                                            </View>
                                            <View className="flex-row items-center mb-2 border-b border-white/5 pb-0.5">
                                                <MaterialCommunityIcons name="account-tie" size={16} color="#444" />
                                                <TextInput
                                                    placeholder="Job Role (e.g. Frontend Associate)"
                                                    placeholderTextColor="#333"
                                                    value={form.role}
                                                    onChangeText={t => setForm({ ...form, role: t })}
                                                    className="flex-1 ml-2 text-white font-bold text-xs"
                                                />
                                            </View>
                                            <View className="flex-row items-center border-b border-white/5 pb-0.5">
                                                <MaterialCommunityIcons name="clock-outline" size={16} color="#444" />
                                                <TextInput
                                                    placeholder="Interview Round"
                                                    placeholderTextColor="#333"
                                                    value={form.round}
                                                    onChangeText={t => setForm({ ...form, round: t })}
                                                    className="flex-1 ml-2 text-white font-medium text-[10px]"
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    {/* Section 2: Classification */}
                                    <View className="mb-10">
                                        <View className="flex-row items-center mb-4">
                                            <View className="w-1 h-4 bg-pink-500 rounded-full mr-3" />
                                            <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Classification</Text>
                                        </View>

                                        <View className="mb-6">
                                            <Text className="text-gray-600 text-[8px] font-black uppercase mb-3 ml-1">Question Category</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                                {QUESTION_TYPES.map(t => (
                                                    <TouchableOpacity
                                                        key={t}
                                                        onPress={() => setForm({ ...form, type: t })}
                                                        className={`mr-2 px-5 py-2.5 rounded-xl border ${form.type === t ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/5'}`}
                                                    >
                                                        <Text className={`text-[9px] font-black uppercase ${form.type === t ? 'text-white' : 'text-gray-500'}`}>{t}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>

                                        <View>
                                            <Text className="text-gray-600 text-[8px] font-black uppercase mb-3 ml-1">Expected Difficulty</Text>
                                            <View className="flex-row gap-2.5">
                                                {DIFFICULTIES.map(d => (
                                                    <TouchableOpacity
                                                        key={d}
                                                        onPress={() => setForm({ ...form, difficulty: d })}
                                                        className={`flex-1 items-center py-3.5 rounded-xl border ${form.difficulty === d
                                                            ? (d === 'Hard' ? 'bg-red-600 border-red-400' : d === 'Medium' ? 'bg-yellow-600 border-yellow-400' : 'bg-green-600 border-green-400')
                                                            : 'bg-white/5 border-white/5'
                                                            }`}
                                                    >
                                                        <Text className={`text-[9px] font-black uppercase ${form.difficulty === d ? 'text-white' : 'text-gray-500'}`}>{d}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </View>

                                    {/* Section 3: The Content */}
                                    <View className="mb-24">
                                        <View className="flex-row items-center mb-4">
                                            <View className="w-1 h-4 bg-emerald-500 rounded-full mr-3" />
                                            <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Question & Context</Text>
                                        </View>

                                        <View className="bg-black/80 rounded-[28px] p-5 border border-white/10 shadow-2xl">
                                            <TextInput
                                                placeholder="What was the question exactly?"
                                                placeholderTextColor="#222"
                                                multiline
                                                value={form.question}
                                                onChangeText={t => setForm({ ...form, question: t })}
                                                className="text-white font-bold text-sm min-h-[120px]"
                                                textAlignVertical="top"
                                            />
                                            <View className="h-[1px] bg-white/5 w-full my-4" />
                                            <View className="flex-row mb-3">
                                                <MaterialCommunityIcons name="lightbulb-on" size={14} color="#333" />
                                                <Text className="text-gray-600 text-[8px] font-black uppercase ml-2">Approach / Hints (Optional)</Text>
                                            </View>
                                            <TextInput
                                                placeholder="Help others with a hint or initial approach..."
                                                placeholderTextColor="#1a1a1a"
                                                multiline
                                                value={form.description}
                                                onChangeText={t => setForm({ ...form, description: t })}
                                                className="text-gray-400 font-medium text-[11px] min-h-[100px]"
                                                textAlignVertical="top"
                                            />
                                        </View>
                                    </View>
                                </ScrollView>
                            </KeyboardAvoidingView>
                        </SafeAreaView>
                    </View>
                </Modal>

                {/* --- DISCUSSION MODAL --- */}
                <Modal visible={isDiscussionVisible} animationType="slide" transparent={true}>
                    <View className="flex-1 bg-black">
                        <SafeAreaView className="flex-1">
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                                <View className="p-6 border-b border-white/5 flex-row justify-between items-center bg-black">
                                    <View>
                                        <Text className="text-white font-black uppercase tracking-[3px] text-xs">Discussion Hub</Text>
                                        <Text className="text-indigo-400 text-[8px] font-bold uppercase mt-1">Deep Dive into solutions</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => { setDiscussionVisible(false); setReplyingTo(null); }}
                                        className="bg-white/5 w-10 h-10 rounded-full items-center justify-center border border-white/10"
                                    >
                                        <Ionicons name="close" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                                    {selectedQuestion && (
                                        <View className="mb-10 bg-white/5 p-6 rounded-[32px] border border-white/10">
                                            <View className="flex-row items-center mb-3">
                                                <View className="w-1 h-4 bg-indigo-500 rounded-full mr-3" />
                                                <Text className="text-indigo-400 font-black text-xs uppercase tracking-widest">{selectedQuestion.company}</Text>
                                            </View>
                                            <Text className="text-white text-lg leading-7 font-black mb-4">{selectedQuestion.question}</Text>

                                            {selectedQuestion.description && (
                                                <View className="bg-indigo-600/10 p-5 rounded-2xl border border-indigo-500/20">
                                                    <View className="flex-row items-center mb-2">
                                                        <MaterialCommunityIcons name="lightbulb-on" size={14} color="#6366f1" />
                                                        <Text className="text-indigo-300 text-[10px] font-black uppercase ml-2 tracking-widest">Initial Insight</Text>
                                                    </View>
                                                    <Text className="text-gray-400 text-xs italic leading-5">{selectedQuestion.description}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    <View className="flex-row items-center mb-6 px-1">
                                        <Text className="text-gray-600 text-[9px] uppercase font-black tracking-[2px]">Community Feedback</Text>
                                        <View className="h-[1px] bg-white/5 flex-1 ml-4" />
                                        <Text className="text-gray-600 text-[9px] ml-4 font-black">{selectedQuestion?.comments?.length || 0} TOTAL</Text>
                                    </View>

                                    {selectedQuestion?.comments?.map((c: any, i: number) => (
                                        <CommentItem key={i} comment={c} />
                                    ))}
                                </ScrollView>

                                <View className="p-6 bg-black border-t border-white/5">
                                    {replyingTo && (
                                        <View className="flex-row items-center justify-between bg-white/5 px-3 py-2 mb-2 rounded-lg">
                                            <Text className="text-gray-400 text-xs text-white">Replying to <Text className="font-bold">@{replyingTo.commentor?.username}</Text></Text>
                                            <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                                <Ionicons name="close-circle" size={18} color="#9ca3af" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    <View className="flex-row items-center">
                                        <View className="flex-1 flex-row items-center bg-[#080808] border border-white/10 rounded-2xl px-4 mr-3 h-14">
                                            <MaterialCommunityIcons name="comment-text-outline" size={18} color="#444" />
                                            <TextInput
                                                ref={commentInputRef}
                                                placeholder={replyingTo ? "Add a reply..." : "Write a response..."}
                                                placeholderTextColor="#222"
                                                value={newComment}
                                                onChangeText={setNewComment}
                                                className="flex-1 text-white ml-3 font-bold text-sm"
                                                multiline
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleComment}
                                            className="bg-indigo-600 w-14 h-14 rounded-2xl items-center justify-center shadow-lg shadow-indigo-500/40"
                                        >
                                            <Ionicons name="send" size={20} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </KeyboardAvoidingView>
                        </SafeAreaView>
                    </View>
                </Modal>
            </SafeAreaView>
        </View >
    );
};

export default PlacementHub;
