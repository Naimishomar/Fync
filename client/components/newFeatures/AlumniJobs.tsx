import React, { useState, useEffect, useCallback, memo } from 'react';
import {View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Modal, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Image, Linking, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';

const JobCard = memo(({ item, onOpenDiscussion, onMessageAlumni, onDeleteJob, isOwner, navigation }: any) => {
    return (
        <View className="bg-card rounded-sheet mb-8 mx-gutter overflow-hidden border border-line shadow-hair">
            <View className="p-card-pad">
                <View className="flex-row justify-between items-start mb-6">
                    <View className="flex-1 mr-4">
                        <Text className="text-ink text-2xl font-display uppercase leading-tight mb-2" numberOfLines={2}>
                            {item.title}
                        </Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('PublicProfile', { userId: item.alumni?._id })}
                            className="flex-row items-center"
                        >
                            <Image
                                source={{ uri: item.alumni?.avatar || 'https://ui-avatars.com/api/?name=User' }}
                                className="w-6 h-6 rounded-xl mr-2 bg-paper-2"
                            />
                            <Text className="text-ink-3 text-label font-display uppercase">{item.alumni?.name} • {item.alumni?.company}</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="items-end">
                        <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-accent-text font-display text-label uppercase">{item.salary || 'Competitive'}</Text>
                        </View>
                        <Text className="text-ink-3 text-label font-display uppercase mt-2">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </Text>
                    </View>
                </View>

                <Text className="text-ink-2 text-sm leading-6 mb-8" numberOfLines={3}>
                    "{item.description}"
                </Text>

                <View className="flex-row gap-3">
                    <TouchableOpacity
                        onPress={() => Linking.openURL(item.applyLink)}
                        className="flex-1 bg-ink py-4 rounded-card items-center shadow-hair"
                    >
                        <Text className="text-white font-display text-label uppercase">Apply Protocol</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onOpenDiscussion(item)}
                        className="bg-paper-2 px-5 py-4 rounded-card items-center flex-row border border-line"
                    >
                        <Ionicons name="chatbubbles-outline" size={18} color="#12100E" />
                        <Text className="text-ink ml-2 text-label font-display uppercase">{item.comments?.length || 0}</Text>
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity
                            onPress={() => onDeleteJob(item._id)}
                            className="bg-danger/10 px-5 py-4 rounded-card items-center border border-danger/15"
                        >
                            <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </TouchableOpacity>
                    )}
                </View>

                {!isOwner && (
                    <TouchableOpacity
                        onPress={() => onMessageAlumni(item.alumni)}
                        className="mt-4 flex-row items-center justify-center py-4 bg-paper-2/50 rounded-card border border-line/50"
                    >
                        <Ionicons name="mail-outline" size={14} color="#8B857E" />
                        <Text className="text-ink-3 font-display text-label uppercase ml-2">Message Personnel</Text>
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
                <View className="bg-paper-2 p-5 rounded-card border border-line">
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center">
                            <Text className="text-ink font-display uppercase text-label">{item.commentor?.username}</Text>
                            <Text className="text-ink-3 text-label font-display uppercase ml-3">
                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                            </Text>
                        </View>
                        {!isReply && (
                            <TouchableOpacity onPress={() => setReplyingTo(item)} className="bg-card border border-line px-2.5 py-1 rounded-full">
                                <Text className="text-ink font-display text-label uppercase">Reply</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text className="text-ink-2 text-xs leading-5">
                        {item.replyToUser && <Text className="text-accent-text font-display">@{item.replyToUser.username} </Text>}
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
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* Background Protocol Gradient */}

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
                        <View className="px-gutter pt-6 mb-10">
                            <View className="flex-row justify-between items-center">
                                <View>
                                    <Text className="text-3xl font-display text-ink uppercase leading-tight">
                                        Alumni <Text className="text-accent-text">Jobs</Text> 
                                    </Text>
                                    <Text className="text-ink-3 text-label font-display uppercase">Exclusive Senior Intel</Text>
                                </View>
                                {isAlumni && (
                                    <TouchableOpacity
                                        onPress={() => setPostModalVisible(true)}
                                        className="w-14 h-14 bg-ink rounded-card items-center justify-center shadow-hair"
                                    >
                                        <Ionicons name="add" size={28} color="white" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    }
                    ListEmptyComponent={!loading ? (
                        <View className="items-center justify-center mt-20 px-gutter">
                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                <Ionicons name="briefcase-outline" size={48} color="#C4BEB6" />
                            </View>
                            <Text className="font-semibold text-base text-ink text-center">No Jobs Found</Text>
                            <Text className="font-sans text-sm text-ink-4 mt-2 text-center">Check back later for new opportunities from your alumni network.</Text>
                        </View>
                    ) : <ActivityIndicator size="large" color="#F97316" className="mt-20" />}
                />

                {/* --- POST JOB MODAL --- */}
                <Modal visible={isPostModalVisible} animationType="slide" transparent onRequestClose={() => setPostModalVisible(false)}>
                    <View className="flex-1 bg-black/50 justify-end">
                        <KeyboardAvoidingView behavior="padding">
                            <View className="bg-paper rounded-t-sheet p-card-pad">
                                <View className="flex-row justify-between items-center mb-10">
                                    <Text className="text-ink font-display uppercase text-h1">Initialize Post</Text>
                                    <TouchableOpacity onPress={() => setPostModalVisible(false)} className="w-12 h-12 bg-paper-2 rounded-card items-center justify-center border border-line">
                                        <Ionicons name="close" size={24} color="black" />
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    placeholder="Position Intel (e.g. Software Engineer)"
                                    placeholderTextColor="#8B857E"
                                    className="bg-card px-6 py-5 mb-4 font-display text-ink border-[1.5px] border-ink rounded-md"
                                    value={form.title}
                                    onChangeText={t => setForm({ ...form, title: t })}
                                />
                                <TextInput
                                    placeholder="Opportunity Description"
                                    multiline
                                    placeholderTextColor="#8B857E"
                                    className="bg-card px-6 py-5 mb-4 font-display text-ink border-[1.5px] border-ink h-32 rounded-md"
                                    value={form.description}
                                    onChangeText={t => setForm({ ...form, description: t })}
                                    textAlignVertical="top"
                                />
                                <TextInput
                                    placeholder="Source / Apply Link"
                                    placeholderTextColor="#8B857E"
                                    className="bg-card px-6 py-5 mb-4 font-display text-ink border-[1.5px] border-ink rounded-md"
                                    value={form.applyLink}
                                    onChangeText={t => setForm({ ...form, applyLink: t })}
                                />
                                <TextInput
                                    placeholder="Compensation (Optional)"
                                    placeholderTextColor="#8B857E"
                                    className="bg-card px-6 py-5 mb-10 font-display text-ink border-[1.5px] border-ink rounded-md"
                                    value={form.salary}
                                    onChangeText={t => setForm({ ...form, salary: t })}
                                />
                                <TouchableOpacity
                                    onPress={handleCreateJob}
                                    disabled={posting}
                                    className="bg-ink py-6 items-center border-2 border-ink rounded-md"
                                >
                                    {posting ? <ActivityIndicator color="white" /> : <Text className="text-white font-display uppercase">Commit Opening</Text>}
                                </TouchableOpacity>
                                <View className="h-10" />
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </Modal>

                {/* --- DISCUSSION MODAL --- */}
                <Modal visible={isDiscussionVisible} animationType="slide" transparent onRequestClose={() => setDiscussionVisible(false)}>
                    <View className="flex-1 bg-black/50 justify-end">
                        <View className="bg-paper h-[85%] rounded-t-sheet overflow-hidden">
                            <View className="p-card-pad pb-6 flex-row justify-between items-center border-b border-line">
                                <View>
                                    <Text className="text-ink font-display uppercase text-h1">Discussion</Text>
                                    <Text className="text-ink-3 text-label font-display uppercase mt-1">Intelligence Network</Text>
                                </View>
                                <TouchableOpacity onPress={() => setDiscussionVisible(false)} className="w-12 h-12 bg-paper-2 rounded-card items-center justify-center border border-line">
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
                                        <Ionicons name="chatbubble-ellipses-outline" size={48} color="#C4BEB6" />
                                        <Text className="text-ink-3 font-display uppercase text-label mt-4">No active discussion</Text>
                                    </View>
                                ) : <ActivityIndicator color="#F97316" />}
                            />

                            <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
                                <View className="p-card-pad pb-12 border-t border-line bg-card">
                                    {replyingTo && (
                                        <View className="flex-row items-center justify-between mb-4 bg-paper-2 p-4 rounded-card border border-line">
                                            <Text className="text-accent-text font-display uppercase text-label">Replying to @{replyingTo.commentor?.username}</Text>
                                            <TouchableOpacity onPress={() => setReplyingTo(null)}><Ionicons name="close-circle" size={18} color="#F97316" /></TouchableOpacity>
                                        </View>
                                    )}
                                    <View className="flex-row items-center">
                                        <TextInput
                                            placeholder="Transmit intelligence..."
                                            placeholderTextColor="#8B857E"
                                            className="flex-1 bg-paper text-ink p-5 mr-4 font-display text-xs border-[1.5px] border-ink rounded-md"
                                            value={newComment}
                                            onChangeText={setNewComment}
                                        />
                                        <TouchableOpacity
                                            onPress={handlePostComment}
                                            disabled={!newComment.trim()}
                                            className={`w-14 h-14 rounded-card items-center justify-center ${newComment.trim() ? 'bg-brand-600 shadow-hair ' : 'bg-paper-2'}`}
                                        >
                                            <Ionicons name="send" size={20} color={newComment.trim() ? "white" : "#C4BEB6"} />
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
