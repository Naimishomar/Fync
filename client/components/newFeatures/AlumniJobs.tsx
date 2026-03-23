import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    FlatList, Modal, ActivityIndicator, Alert, RefreshControl,
    KeyboardAvoidingView, Platform, Image, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';

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

    const renderCommentItem = ({ item, isReply = false }: { item: any, isReply?: boolean }) => {
        return (
            <View className={`mb-4 ${isReply ? 'ml-8' : ''}`}>
                <View className="bg-white/5 p-3 rounded-xl">
                    <View className="flex-row items-center justify-between mb-1">
                        <View className="flex-row items-center">
                            <Text className="text-indigo-400 font-bold text-xs">{item.commentor?.username}</Text>
                            <Text className="text-gray-500 text-[10px] ml-2">
                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                            </Text>
                        </View>
                        {!isReply && (
                            <TouchableOpacity onPress={() => setReplyingTo(item)}>
                                <Text className="text-gray-400 text-[10px]">Reply</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text className="text-gray-200 text-sm">
                        {item.replyToUser && <Text className="text-pink-400">@{item.replyToUser.username} </Text>}
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

    const handleMessageAlumni = async (alumni: any) => {
        try {
            const res = await axios.post("/chat/start", {
                userId: alumni._id,
            });
            if (res.data.success) {
                navigation.navigate("Chat", {
                    conversationId: res.data.conversation._id,
                });
            }
        } catch (error) {
            Alert.alert("Error", "Could not start chat with alumni.");
        }
    };

    const renderJobItem = ({ item }: { item: any }) => {
        const isOwner = item.alumni?._id === CURRENT_USER_ID;
        return (
            <View className="bg-[#1a1a1a] rounded-2xl p-5 mb-4 border border-white/5 shadow-xl">
                <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                        <Text className="text-white text-lg font-bold">{item.title}</Text>
                        <TouchableOpacity 
                            onPress={() => navigation.navigate('PublicProfile', { userId: item.alumni?._id })}
                            className="flex-row items-center mt-1"
                        >
                            <Image 
                                source={{ uri: item.alumni?.avatar || 'https://ui-avatars.com/api/?name=User' }} 
                                className="w-5 h-5 rounded-full mr-2"
                            />
                            <Text className="text-gray-400 text-xs">{item.alumni?.name} • {item.alumni?.company}</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="items-end">
                        <Text className="text-indigo-400 font-bold text-xs">{item.salary}</Text>
                        <Text className="text-gray-500 text-[10px] mt-1">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </Text>
                    </View>
                </View>

                <Text className="text-gray-300 text-sm mb-4" numberOfLines={3}>{item.description}</Text>

                <View className="flex-row gap-3">
                    <TouchableOpacity 
                        onPress={() => Linking.openURL(item.applyLink)}
                        className="flex-1 bg-indigo-600 py-3 rounded-xl items-center"
                    >
                        <Text className="text-white font-bold text-sm">Apply Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => handleOpenDiscussion(item)}
                        className="bg-white/10 px-4 py-3 rounded-xl items-center flex-row"
                    >
                        <Ionicons name="chatbubble-outline" size={18} color="white" />
                        <Text className="text-white ml-2 text-xs font-bold">{item.comments?.length || 0}</Text>
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity 
                            onPress={() => handleDeleteJob(item._id)}
                            className="bg-red-500/20 px-4 py-3 rounded-xl items-center"
                        >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                </View>

                {!isOwner && (
                    <TouchableOpacity 
                        onPress={() => handleMessageAlumni(item.alumni)}
                        className="mt-3 flex-row items-center justify-center p-2 border border-white/5 rounded-lg"
                    >
                        <Ionicons name="mail-outline" size={16} color="#9ca3af" />
                        <Text className="text-gray-400 text-xs ml-2">Message Alumni</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-black">
            <LinearGradient colors={['#1e1b4b', '#000000']} className="absolute w-full h-full" />
            <SafeAreaView className="flex-1">
                <View className="px-5 pt-4 pb-2 flex-row justify-between items-center">
                    <View>
                        <Text className="text-white text-3xl font-black">Alumni Jobs</Text>
                        <Text className="text-gray-400 text-xs mt-1">Exclusive openings from your college seniors.</Text>
                    </View>
                    {isAlumni && (
                        <TouchableOpacity 
                            onPress={() => setPostModalVisible(true)}
                            className="bg-indigo-600 w-12 h-12 rounded-full items-center justify-center shadow-lg shadow-indigo-500/30"
                        >
                            <Ionicons name="add" size={28} color="white" />
                        </TouchableOpacity>
                    )}
                </View>

                <FlatList
                    data={jobs}
                    keyExtractor={(item) => item._id}
                    renderItem={renderJobItem}
                    contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />}
                    ListEmptyComponent={!loading ? (
                        <View className="items-center mt-20 opacity-40">
                            <MaterialCommunityIcons name="briefcase-outline" size={80} color="white" />
                            <Text className="text-white mt-4 text-lg font-bold">No active job openings.</Text>
                            <Text className="text-gray-400 text-center px-10">Check back later for new opportunities from your alumni.</Text>
                        </View>
                    ) : <ActivityIndicator size="large" color="#6366f1" className="mt-20" />}
                />

                {/* --- POST JOB MODAL --- */}
                <Modal visible={isPostModalVisible} animationType="slide" transparent>
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end">
                        <TouchableOpacity className="flex-1 bg-black/60" activeOpacity={1} onPress={() => setPostModalVisible(false)} />
                        <View className="bg-[#1a1a1a] rounded-t-3xl p-6 border-t border-white/10">
                            <Text className="text-white text-xl font-bold mb-4">Post Job Opening</Text>
                            <TextInput 
                                placeholder="Job Title (e.g. Software Engineer Intern)" 
                                placeholderTextColor="#555" 
                                className="bg-black/50 text-white p-4 rounded-xl mb-3 border border-white/5"
                                value={form.title}
                                onChangeText={t => setForm({...form, title: t})}
                            />
                            <TextInput 
                                placeholder="Description" 
                                multiline
                                placeholderTextColor="#555" 
                                className="bg-black/50 text-white p-4 rounded-xl mb-3 border border-white/5 min-h-[100px]"
                                value={form.description}
                                onChangeText={t => setForm({...form, description: t})}
                                textAlignVertical="top"
                            />
                            <TextInput 
                                placeholder="Apply Link" 
                                placeholderTextColor="#555" 
                                className="bg-black/50 text-white p-4 rounded-xl mb-3 border border-white/5"
                                value={form.applyLink}
                                onChangeText={t => setForm({...form, applyLink: t})}
                            />
                            <TextInput 
                                placeholder="Stipend/Salary (Optional)" 
                                placeholderTextColor="#555" 
                                className="bg-black/50 text-white p-4 rounded-xl mb-6 border border-white/5"
                                value={form.salary}
                                onChangeText={t => setForm({...form, salary: t})}
                            />
                            <TouchableOpacity 
                                onPress={handleCreateJob}
                                disabled={posting}
                                className="bg-indigo-600 py-4 rounded-2xl items-center"
                            >
                                {posting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Submit Post</Text>}
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* --- DISCUSSION MODAL --- */}
                <Modal visible={isDiscussionVisible} animationType="slide" transparent>
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end">
                        <TouchableOpacity className="flex-1 bg-black/80" activeOpacity={1} onPress={() => setDiscussionVisible(false)} />
                        <View className="bg-[#0f0f0f] h-[80%] rounded-t-3xl border-t border-white/10">
                            <View className="p-4 border-b border-white/5 flex-row justify-between items-center">
                                <Text className="text-white font-bold text-lg">Discussion</Text>
                                <TouchableOpacity onPress={() => setDiscussionVisible(false)}><Ionicons name="close" size={24} color="white" /></TouchableOpacity>
                            </View>

                            <FlatList
                                data={comments}
                                keyExtractor={item => item._id}
                                renderItem={renderCommentItem}
                                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                                ListEmptyComponent={!loadingComments ? <Text className="text-gray-500 text-center mt-10">No comments yet.</Text> : <ActivityIndicator color="#6366f1" />}
                            />

                            <View className="p-4 border-t border-white/5 bg-[#1a1a1a]">
                                {replyingTo && (
                                    <View className="flex-row items-center justify-between mb-2 bg-indigo-500/10 p-2 rounded-lg">
                                        <Text className="text-indigo-400 text-xs text-white">Replying to @{replyingTo.commentor?.username}</Text>
                                        <TouchableOpacity onPress={() => setReplyingTo(null)}><Ionicons name="close-circle" size={18} color="#9ca3af" /></TouchableOpacity>
                                    </View>
                                )}
                                <View className="flex-row items-center">
                                    <TextInput 
                                        placeholder="Type your comment..." 
                                        placeholderTextColor="#555"
                                        className="flex-1 bg-black/50 text-white p-3 rounded-full mr-3 text-sm border border-white/5"
                                        value={newComment}
                                        onChangeText={setNewComment}
                                    />
                                    <TouchableOpacity onPress={handlePostComment} disabled={!newComment.trim()}>
                                        <Ionicons name="send" size={24} color={newComment.trim() ? "#6366f1" : "#333"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

            </SafeAreaView>
        </View>
    );
}
