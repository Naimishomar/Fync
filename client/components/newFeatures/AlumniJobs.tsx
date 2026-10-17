import React, { useState, useEffect, useCallback, memo } from 'react';
import {View, Text, TouchableOpacity, TextInput, FlatList, Modal, ActivityIndicator, KeyboardAvoidingView, Linking, StatusBar} from 'react-native'
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';
import CommentsSheet, { CommentsApi } from '../ui/CommentsSheet';

// Backend: GET /job-openings/comments/:id -> { comments } (getCommentThread, commentor populated);
// POST /job-openings/comment/:id takes `parentCommentId`. No update/delete routes.
const JOB_COMMENTS: CommentsApi = {
    list: (id) => `/job-openings/comments/${id}`,
    add: (id) => `/job-openings/comment/${id}`,
    body: (text, parentId) => ({ text, parentCommentId: parentId }),
    replies: true,
};

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
                                style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, backgroundColor: C.paper2 }}
                                cachePolicy="memory-disk"
                            />
                            <Text className="text-ink-3 text-label font-display uppercase flex-1" numberOfLines={1}>{item.alumni?.name} • {item.alumni?.company}</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="items-end">
                        <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-accent-text font-display text-label uppercase">{item.salary || 'Competitive'}</Text>
                        </View>
                        <Text className="text-ink-3 text-label font-display uppercase mt-2">
                            {item.createdAt && !isNaN(new Date(item.createdAt).getTime())
                                ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                                : ''}
                        </Text>
                    </View>
                </View>

                <Text className="text-ink-2 text-sm leading-6 mb-8" numberOfLines={3}>
                    "{item.description}"
                </Text>

                <View className="flex-row gap-3">
                    <TouchableOpacity
                        onPress={() => item.applyLink && Linking.openURL(item.applyLink).catch(() => Alert.alert('Error', 'Could not open the apply link.'))}
                        className="flex-1 bg-ink py-4 rounded-card items-center shadow-hair"
                    >
                        <Text className="text-white font-display text-label uppercase">Apply Protocol</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onOpenDiscussion(item)}
                        className="bg-paper-2 px-5 py-4 rounded-card items-center flex-row border border-line"
                    >
                        <Ionicons name="chatbubbles-outline" size={18} color={C.ink} />
                        <Text className="text-ink ml-2 text-label font-display uppercase">{item.comments?.length || 0}</Text>
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity
                            onPress={() => onDeleteJob(item._id)}
                            className="bg-danger/10 px-5 py-4 rounded-card items-center border border-danger/15"
                        >
                            <Ionicons name="trash-outline" size={18} color={C.danger} />
                        </TouchableOpacity>
                    )}
                </View>

                {!isOwner && (
                    <TouchableOpacity
                        onPress={() => onMessageAlumni(item.alumni)}
                        className="mt-4 flex-row items-center justify-center py-4 bg-paper-2/50 rounded-card border border-line/50"
                    >
                        <Ionicons name="mail-outline" size={14} color={C.ink3} />
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

    const [form, setForm] = useState({
        title: '',
        description: '',
        applyLink: '',
        salary: ''
    });

    const CURRENT_USER_ID = user?._id || user?.id;
    const isAlumni = user?.user_access === 'alumni';

    const fetchJobs = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get('/job-openings/get');
            if (res.data.success) {
                setJobs(res.data.jobOpenings || []);
            }
        } catch (error) {
            console.error("Fetch Jobs Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

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

    const handleDeleteJob = useCallback((id: string) => {
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
    }, [fetchJobs]);

    const handleOpenDiscussion = useCallback((job: any) => {
        setSelectedJob(job);
        setDiscussionVisible(true);
    }, []);

    const handleMessageAlumni = useCallback(async (alumni: any) => {
        if (!alumni?._id) return;
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
    }, [navigation]);

    const renderJob = useCallback(({ item }: { item: any }) => (
        <JobCard
            item={item}
            onOpenDiscussion={handleOpenDiscussion}
            onMessageAlumni={handleMessageAlumni}
            onDeleteJob={handleDeleteJob}
            isOwner={item.alumni?._id === CURRENT_USER_ID}
            navigation={navigation}
        />
    ), [handleOpenDiscussion, handleMessageAlumni, handleDeleteJob, CURRENT_USER_ID, navigation]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <View className="flex-1">
                <AppBar
                    title="Alumni Jobs"
                    onBack={() => navigation.goBack()}
                    right={isAlumni ? <IconBtn name="add" boxed onPress={() => setPostModalVisible(true)} /> : undefined}
                />
                <FlatList keyboardShouldPersistTaps="handled"
                    data={jobs}
                    keyExtractor={(item) => item._id}
                    renderItem={renderJob}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    ListEmptyComponent={!loading ? (
                        <View className="items-center justify-center mt-20 px-gutter">
                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                <Ionicons name="briefcase-outline" size={48} color={C.ink4} />
                            </View>
                            <Text className="font-semibold text-base text-ink text-center">No Jobs Found</Text>
                            <Text className="font-sans text-sm text-ink-4 mt-2 text-center">Check back later for new opportunities from your alumni network.</Text>
                        </View>
                    ) : <ActivityIndicator size="large" color={C.brand[500]} className="mt-20" />}
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
                                    placeholderTextColor={C.ink3}
                                    className="bg-card px-6 py-5 mb-4 font-display text-ink border-[1.5px] border-ink rounded-md"
                                    value={form.title}
                                    onChangeText={t => setForm({ ...form, title: t })}
                                />
                                <TextInput
                                    placeholder="Opportunity Description"
                                    multiline
                                    placeholderTextColor={C.ink3}
                                    className="bg-card px-6 py-5 mb-4 font-display text-ink border-[1.5px] border-ink h-32 rounded-md"
                                    value={form.description}
                                    onChangeText={t => setForm({ ...form, description: t })}
                                    textAlignVertical="top"
                                />
                                <TextInput
                                    placeholder="Source / Apply Link"
                                    placeholderTextColor={C.ink3}
                                    className="bg-card px-6 py-5 mb-4 font-display text-ink border-[1.5px] border-ink rounded-md"
                                    value={form.applyLink}
                                    onChangeText={t => setForm({ ...form, applyLink: t })}
                                />
                                <TextInput
                                    placeholder="Compensation (Optional)"
                                    placeholderTextColor={C.ink3}
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

                <CommentsSheet
                    visible={isDiscussionVisible}
                    onClose={() => setDiscussionVisible(false)}
                    resource={JOB_COMMENTS}
                    title="Discussion"
                    targetId={selectedJob?._id ?? null}
                    currentUser={user}
                />

            </View>
        </View>
    );
}
