import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    FlatList, Modal, ActivityIndicator, RefreshControl,
    KeyboardAvoidingView, Platform, Image, Linking, StatusBar,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';

const JobCard = memo(({ item, onOpenDiscussion, onMessageAlumni, onDeleteJob, isOwner, navigation }: any) => {
    return (
        <View className="bg-white rounded-[32px] mb-8 mx-8 overflow-hidden border border-slate-100 shadow-sm shadow-black/5">
            <View className="p-8">
                <View className="flex-row justify-between items-start mb-6">
                    <View className="flex-1 mr-4">
                        <Text className="text-zinc-900 text-2xl font-black  uppercase tracking-tighter leading-tight mb-2" numberOfLines={2}>
                            {item.title}
                        </Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('PublicProfile', { userId: item.alumni?._id })}
                            className="flex-row items-center"
                        >
                            <Image
                                source={{ uri: item.alumni?.avatar || 'https://ui-avatars.com/api/?name=User' }}
                                className="w-6 h-6 rounded-xl mr-2 bg-slate-100"
                            />
                            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest ">{item.alumni?.name} • {item.alumni?.company}</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="items-end">
                        <View className="bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                            <Text className="text-orange-600 font-black  text-[10px] uppercase">{item.salary || 'Competitive'}</Text>
                        </View>
                        <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-2">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </Text>
                    </View>
                </View>

                <Text className="text-slate-600 text-sm  leading-6 mb-8" numberOfLines={3}>
                    "{item.description}"
                </Text>

                <View className="flex-row gap-3">
                    <TouchableOpacity
                        onPress={() => Linking.openURL(item.applyLink)}
                        className="flex-1 bg-zinc-900 py-4 rounded-2xl items-center shadow-lg shadow-black/20"
                    >
                        <Text className="text-white font-black  text-[10px] uppercase tracking-widest">Apply Protocol</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onOpenDiscussion(item)}
                        className="bg-slate-50 px-5 py-4 rounded-2xl items-center flex-row border border-slate-100"
                    >
                        <Ionicons name="chatbubbles-outline" size={18} color="#18181b" />
                        <Text className="text-zinc-900 ml-2 text-[10px] font-black  uppercase">{item.comments?.length || 0}</Text>
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity
                            onPress={() => onDeleteJob(item._id)}
                            className="bg-red-50 px-5 py-4 rounded-2xl items-center border border-red-100"
                        >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                </View>

                {!isOwner && (
                    <TouchableOpacity
                        onPress={() => onMessageAlumni(item.alumni)}
                        className="mt-4 flex-row items-center justify-center py-4 bg-slate-50/50 rounded-2xl border border-slate-100/50"
                    >
                        <Ionicons name="mail-outline" size={14} color="#94a3b8" />
                        <Text className="text-slate-400 font-black  text-[10px] uppercase tracking-widest ml-2">Message Personnel</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
});

export default function AlumniJobs() {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isPostModalVisible, setPostModalVisible] = useState(false);
    const [posting, setPosting] = useState(false);

    // Discussion/Comment State
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [isDiscussionVisible, setDiscussionVisible] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);
    const [replyingTo, setReplyingTo] = useState<any>(null);

    const [form, setForm] = useState({
        title: '',
        description: '',
        applyLink: '',
        salary: ''
    });

    const CURRENT_USER_ID = user?._id || user?.id;
    const isAlumni = user?.user_access === 'alumni';

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/job-openings/get');
            if (res.data.success) {
                setJobs(res.data.jobOpenings);
            }
        } catch (error) {
            console.error("Fetch Jobs Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchJobs();
    };

    const handleCreateJob = async () => {
        if (!form.title || !form.description || !form.applyLink) {
            Alert.alert("Error", "Please fill required fields (Title, Description, Apply Link)");
            return;
        }
        setPosting(true);
        try {
            const res = await axios.post('/job-openings/create', form);
            if (res.data.success) {
                setPostModalVisible(false);
                setForm({ title: '', description: '', applyLink: '', salary: '' });
                fetchJobs();
                Alert.alert("Success", "Job opening posted successfully!");
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Failed to post job");
        } finally {
            setPosting(false);
        }
    };

    const handleDeleteJob = (id: string) => {
        Alert.alert("Delete Job", "Are you sure you want to delete this posting?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        const res = await axios.delete(`/job-openings/delete/${id}`);
                        if (res.data.success) {
                            fetchJobs();
                        }
                    } catch (error) {
                        Alert.alert("Error", "Failed to delete");
                    }
                }
            }
        ]);
    };

    const handleOpenDiscussion = async (job: any) => {
        setSelectedJob(job);
        setDiscussionVisible(true);
        fetchComments(job._id);
    };

    const fetchComments = async (jobId: string) => {
        setLoadingComments(true);
        try {
            const res = await axios.get(`/job-openings/comments/${jobId}`);
            if (res.data.success) {
                setComments(res.data.comments);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim()) return;
        try {
            const res = await axios.post(`/job-openings/comment/${selectedJob._id}`, {
                text: newComment,
                parentCommentId: replyingTo?._id || null
            });
            if (res.data.success) {
                setNewComment('');
                setReplyingTo(null);
                fetchComments(selectedJob._id);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to post comment");
        }
    };

    const handleMessageAlumni = async (alumni: any) => {
        try {
            const res = await axios.post("/chat/start", {
                userId: alumni._id,
            });
            if (res.data.success) {
                navigation.navigate("Chat", {
                    conversationId: res.data.conversation._id,
                    otherUser: alumni
                });
            }
        } catch (error) {
            Alert.alert("Error", "Could not start chat with alumni.");
        }
    };

    const renderCommentItem = ({ item, isReply = false }: { item: any, isReply?: boolean }) => {
        return (
            <View className={`mb-6 ${isReply ? 'ml-10' : ''}`}>
                <View className="bg-slate-50 p-5 rounded-[24px] border border-slate-100">
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center">
                            <Text className="text-zinc-900 font-black  uppercase text-[10px] tracking-tight">{item.commentor?.username}</Text>
                            <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest ml-3">
                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                            </Text>
                        </View>
                        {!isReply && (
                            <TouchableOpacity onPress={() => setReplyingTo(item)} className="bg-white px-3 py-1 rounded-lg border border-slate-100">
                                <Text className="text-zinc-900 font-black  text-[8px] uppercase">Reply</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text className="text-slate-600 text-xs  leading-5">
                        {item.replyToUser && <Text className="text-orange-500 font-black">@{item.replyToUser.username} </Text>}
                        {item.text}
                    </Text>
                </View>
                {item.replies && item.replies.map((reply: any) => (
                    <View key={reply._id}>
                        {renderCommentItem({ item: reply, isReply: true })}
                    </View>
                ))}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-[#FDFDFF]">
            <StatusBar barStyle="dark-content" />

            {/* Background Protocol Gradient */}
            <View className="absolute top-0 w-full h-80 opacity-20">
                <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                <FlatList
                    data={jobs}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <JobCard
                            item={item}
                            onOpenDiscussion={handleOpenDiscussion}
                            onMessageAlumni={handleMessageAlumni}
                            onDeleteJob={handleDeleteJob}
                            isOwner={item.alumni?._id === CURRENT_USER_ID}
                            navigation={navigation}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    ListHeaderComponent={
                        <View className="px-8 pt-6 mb-10">
                            <View className="flex-row justify-between items-center">
                                <View>
                                    <Text className="text-3xl font-black  text-zinc-900 tracking-tighter uppercase leading-tight">
                                        Alumni <Text className="text-orange-500">Jobs</Text> 
                                    </Text>
                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px]">Exclusive Senior Intel</Text>
                                </View>
                                {isAlumni && (
                                    <TouchableOpacity
                                        onPress={() => setPostModalVisible(true)}
                                        className="w-14 h-14 bg-zinc-900 rounded-[20px] items-center justify-center shadow-lg shadow-black/20"
                                    >
                                        <Ionicons name="add" size={28} color="white" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    }
                    ListEmptyComponent={!loading ? (
                        <View className="items-center justify-center mt-20 px-10">
                            <View className="w-24 h-24 bg-white rounded-[32px] items-center justify-center mb-6 border border-slate-100 shadow-sm">
                                <Ionicons name="briefcase-outline" size={48} color="#cbd5e1" />
                            </View>
                            <Text className="text-zinc-400 font-black uppercase text-xs tracking-widest text-center">No Jobs Found</Text>
                            <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center">Check back later for new opportunities from your alumni network.</Text>
                        </View>
                    ) : <ActivityIndicator size="large" color="#f97316" className="mt-20" />}
                />

                {/* --- POST JOB MODAL --- */}
                <Modal visible={isPostModalVisible} animationType="slide" transparent onRequestClose={() => setPostModalVisible(false)}>
                    <View className="flex-1 bg-black/50 justify-end">
                        <KeyboardAvoidingView behavior="padding">
                            <View className="bg-white rounded-t-[50px] p-10">
                                <View className="flex-row justify-between items-center mb-10">
                                    <Text className="text-zinc-900 text-2xl font-black  tracking-tighter uppercase">Initialize Post</Text>
                                    <TouchableOpacity onPress={() => setPostModalVisible(false)} className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                                        <Ionicons name="close" size={24} color="black" />
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    placeholder="Position Intel (e.g. Software Engineer)"
                                    placeholderTextColor="#94a3b8"
                                    className="bg-slate-50 rounded-2xl px-6 py-5 mb-4 font-black  text-zinc-900 border border-slate-100"
                                    value={form.title}
                                    onChangeText={t => setForm({ ...form, title: t })}
                                />
                                <TextInput
                                    placeholder="Opportunity Description"
                                    multiline
                                    placeholderTextColor="#94a3b8"
                                    className="bg-slate-50 rounded-2xl px-6 py-5 mb-4 font-black  text-zinc-900 border border-slate-100 h-32"
                                    value={form.description}
                                    onChangeText={t => setForm({ ...form, description: t })}
                                    textAlignVertical="top"
                                />
                                <TextInput
                                    placeholder="Source / Apply Link"
                                    placeholderTextColor="#94a3b8"
                                    className="bg-slate-50 rounded-2xl px-6 py-5 mb-4 font-black  text-zinc-900 border border-slate-100"
                                    value={form.applyLink}
                                    onChangeText={t => setForm({ ...form, applyLink: t })}
                                />
                                <TextInput
                                    placeholder="Compensation (Optional)"
                                    placeholderTextColor="#94a3b8"
                                    className="bg-slate-50 rounded-2xl px-6 py-5 mb-10 font-black  text-zinc-900 border border-slate-100"
                                    value={form.salary}
                                    onChangeText={t => setForm({ ...form, salary: t })}
                                />
                                <TouchableOpacity
                                    onPress={handleCreateJob}
                                    disabled={posting}
                                    className="bg-zinc-900 py-6 rounded-[32px] items-center shadow-xl shadow-black/20"
                                >
                                    {posting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black  uppercase tracking-widest">Commit Opening</Text>}
                                </TouchableOpacity>
                                <View className="h-10" />
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </Modal>

                {/* --- DISCUSSION MODAL --- */}
                <Modal visible={isDiscussionVisible} animationType="slide" transparent onRequestClose={() => setDiscussionVisible(false)}>
                    <View className="flex-1 bg-black/50 justify-end">
                        <View className="bg-white h-[85%] rounded-t-[50px] overflow-hidden">
                            <View className="p-10 pb-6 flex-row justify-between items-center border-b border-slate-50">
                                <View>
                                    <Text className="text-zinc-900 text-2xl font-black  tracking-tighter uppercase leading-tight">Discussion</Text>
                                    <Text className="text-slate-400 text-[8px] font-black uppercase tracking-[2px] mt-1">Intelligence Network</Text>
                                </View>
                                <TouchableOpacity onPress={() => setDiscussionVisible(false)} className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                                    <Ionicons name="close" size={24} color="black" />
                                </TouchableOpacity>
                            </View>

                            <FlatList
                                data={comments}
                                keyExtractor={item => item._id}
                                renderItem={renderCommentItem}
                                contentContainerStyle={{ padding: 32, paddingBottom: 150 }}
                                showsVerticalScrollIndicator={false}
                                ListEmptyComponent={!loadingComments ? (
                                    <View className="items-center mt-20">
                                        <Ionicons name="chatbubble-ellipses-outline" size={48} color="#cbd5e1" />
                                        <Text className="text-slate-400 font-black  uppercase text-[10px] mt-4 tracking-widest">No active discussion</Text>
                                    </View>
                                ) : <ActivityIndicator color="#f97316" />}
                            />

                            <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
                                <View className="p-8 pb-12 border-t border-slate-50 bg-white">
                                    {replyingTo && (
                                        <View className="flex-row items-center justify-between mb-4 bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                            <Text className="text-orange-600 font-black  uppercase text-[8px]">Replying to @{replyingTo.commentor?.username}</Text>
                                            <TouchableOpacity onPress={() => setReplyingTo(null)}><Ionicons name="close-circle" size={18} color="#f97316" /></TouchableOpacity>
                                        </View>
                                    )}
                                    <View className="flex-row items-center">
                                        <TextInput
                                            placeholder="Transmit intelligence..."
                                            placeholderTextColor="#94a3b8"
                                            className="flex-1 bg-slate-50 text-zinc-900 p-5 rounded-[24px] mr-4 font-black  text-xs border border-slate-100"
                                            value={newComment}
                                            onChangeText={setNewComment}
                                        />
                                        <TouchableOpacity
                                            onPress={handlePostComment}
                                            disabled={!newComment.trim()}
                                            className={`w-14 h-14 rounded-2xl items-center justify-center ${newComment.trim() ? 'bg-orange-600 shadow-lg shadow-orange-600/30' : 'bg-slate-100'}`}
                                        >
                                            <Ionicons name="send" size={20} color={newComment.trim() ? "white" : "#cbd5e1"} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    </View>
                </Modal>

            </SafeAreaView>
        </View>
    );
}
