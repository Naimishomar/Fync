import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, Linking, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Button, Empty, Sheet, FormField } from '../ui/kit';
import { ListingCard, type ListingTag } from '../opportunity/OpportunityCard';
import CommentsSheet, { CommentsApi } from '../ui/CommentsSheet';

import FyncRefreshControl from '../ui/FyncRefreshControl';
// Backend: GET /job-openings/comments/:id -> { comments } (getCommentThread, commentor populated);
// POST /job-openings/comment/:id takes `parentCommentId`. No update/delete routes.
const JOB_COMMENTS: CommentsApi = {
    list: (id) => `/job-openings/comments/${id}`,
    add: (id) => `/job-openings/comment/${id}`,
    body: (text, parentId) => ({ text, parentCommentId: parentId }),
    replies: true,
};

const JobCard = memo(({ item, onOpenDiscussion, onMessageAlumni, onDeleteJob, isOwner, navigation }: any) => {
    const posted = item.createdAt && !isNaN(new Date(item.createdAt).getTime())
        ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
        : '';
    const tags: ListingTag[] = [{ icon: 'cash-outline', label: item.salary || 'Competitive' }];
    if (posted) tags.push({ icon: 'time-outline', label: posted });
    return (
        <ListingCard title={item.title} subtitle={item.alumni?.company} tags={tags}>
            <Pressable
                onPress={() => navigation.navigate('PublicProfile', { userId: item.alumni?._id })}
                className="flex-row items-center mt-3 active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={`Posted by ${item.alumni?.name ?? 'alumni'}`}
                hitSlop={8}
            >
                <Image
                    source={{ uri: item.alumni?.avatar || 'https://ui-avatars.com/api/?name=User' }}
                    style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, backgroundColor: C.paper2 }}
                    cachePolicy="memory-disk"
                />
                <Text className="text-ink-3 text-sm font-sans flex-1" numberOfLines={1}>Posted by {item.alumni?.name}</Text>
            </Pressable>

            {item.description ? (
                <Text className="text-ink-2 text-sm font-sans leading-5 mt-3" numberOfLines={3}>{item.description}</Text>
            ) : null}

            <View className="flex-row items-center mt-4" style={{ gap: 8 }}>
                <Button
                    title="Apply"
                    variant="primary"
                    style={{ flex: 1 }}
                    onPress={() => item.applyLink && Linking.openURL(item.applyLink).catch(() => Alert.alert('Error', 'Could not open the apply link.'))}
                />
                <Button
                    title={String(item.comments?.length || 0)}
                    icon="chatbubbles-outline"
                    accessibilityLabel={`Discussion, ${item.comments?.length || 0} comments`}
                    onPress={() => onOpenDiscussion(item)}
                />
                {isOwner ? (
                    <IconBtn name="trash-outline" boxed color={C.danger} accessibilityLabel="Delete posting" onPress={() => onDeleteJob(item._id)} />
                ) : null}
            </View>

            {!isOwner ? (
                <Button
                    title="Message alumni"
                    icon="mail-outline"
                    variant="tertiary"
                    block
                    style={{ marginTop: 8 }}
                    onPress={() => onMessageAlumni(item.alumni)}
                />
            ) : null}
        </ListingCard>
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
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar
                    title="Alumni Jobs"
                    onBack={() => navigation.goBack()}
                    right={isAlumni ? <IconBtn name="add" boxed accessibilityLabel="Post a job" onPress={() => setPostModalVisible(true)} /> : undefined}
                />
                <FlatList keyboardShouldPersistTaps="handled"
                    data={jobs}
                    keyExtractor={(item) => item._id}
                    renderItem={renderJob}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={!loading ? (
                        <Empty icon="briefcase-outline" title="No jobs yet" hint="Check back later for new openings from your alumni network." />
                    ) : <ActivityIndicator size="large" color={C.brand[500]} className="mt-20" />}
                />

                <Sheet
                    visible={isPostModalVisible}
                    onClose={() => setPostModalVisible(false)}
                    title="Post a job"
                    footer={<Button title="Post opening" variant="primary" block loading={posting} onPress={handleCreateJob} />}
                >
                    <View style={{ gap: 12 }}>
                        <FormField label="Role" placeholder="e.g. Software Engineer" value={form.title} onChangeText={t => setForm({ ...form, title: t })} />
                        <FormField label="Description" multiline placeholder="What the role involves" value={form.description} onChangeText={t => setForm({ ...form, description: t })} />
                        <FormField label="Apply link" placeholder="https://" autoCapitalize="none" keyboardType="url" value={form.applyLink} onChangeText={t => setForm({ ...form, applyLink: t })} />
                        <FormField label="Compensation (optional)" placeholder="e.g. ₹12 LPA" value={form.salary} onChangeText={t => setForm({ ...form, salary: t })} />
                    </View>
                </Sheet>

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
