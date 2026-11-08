import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StatusBar } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import { ConfessionSkeleton } from '../Skeleton';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Meta, Empty, Button, Card, IconTile, ListRow, Sheet, FormField } from '../ui/kit';
import CommentsSheet, { CommentsApi, CommentModel } from '../ui/CommentsSheet';
import { report } from '../../utils/safety';

import FyncRefreshControl from '../ui/FyncRefreshControl';
const CONFESSION_COMMENTS: CommentsApi = {
    list: (id) => `/confessions/comments/${id}`,
    add: (id) => `/confessions/comment/${id}`,
    body: (text, parentId) => ({ text, parentCommentId: parentId ?? undefined }),
    replies: true,
};

// Fixed color for all confessions
const CONFESSION_COLOR = '#FFFFFF';

/* ---------------- GLOBAL CACHE ---------------- */
let globalConfessionsCache: any[] = [];
let globalCurrentPage = 1;
let globalHasMore = true;

const ConfessionItem = memo(({ item, user, onLike, onComments, onEdit, onDelete, onReport, navigation }: any) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_LIMIT = 200;
    const isLongText = (item.content?.length || 0) > MAX_LIMIT;
    const liked = item.liked_by?.includes(user?._id || user?.id);

    return (
        <Card padded style={{ marginBottom: 12 }}>
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <IconTile icon="person-outline" size={40} color={C.ink3} />
                    <View>
                        <Text className="text-ink font-semibold text-base">Anonymous</Text>
                        <Text className="text-ink-3 text-xs font-sans">{new Date(item.createdAt).toLocaleDateString()}</Text>
                    </View>
                </View>

                {/* Owner gets edit/delete; everyone else can report. */}
                <IconBtn
                    name="ellipsis-horizontal"
                    color={C.ink2}
                    accessibilityLabel="Confession options"
                    onPress={() => {
                        Alert.alert(
                            "Confession",
                            undefined,
                            item.canManage
                                ? [
                                    { text: "Update / Edit", onPress: () => onEdit(item) },
                                    { text: "Delete Post", style: "destructive", onPress: () => onDelete(item._id) },
                                    { text: "Cancel", style: "cancel" }
                                ]
                                : [
                                    { text: "Report", style: "destructive", onPress: () => onReport(item._id) },
                                    { text: "Cancel", style: "cancel" }
                                ]
                        );
                    }}
                />
            </View>

            <Pressable
                onPress={() => setIsExpanded(!isExpanded)}
                disabled={!isLongText}
                accessibilityRole={isLongText ? 'button' : undefined}
                accessibilityHint={isLongText ? (isExpanded ? 'Show less' : 'Read more') : undefined}
                className="active:opacity-85"
            >
                <Text className="text-ink text-base font-sans leading-6 mb-3">
                    {isExpanded || !isLongText
                        ? item.content
                        : `${item.content.substring(0, MAX_LIMIT)}...`}
                    {isLongText ? (
                        <Text className="text-accent-text font-semibold text-sm">{isExpanded ? ' Show less' : ' Read more'}</Text>
                    ) : null}
                </Text>
            </Pressable>

            {item.taggedUser ? (
                <Pressable
                    onPress={() => navigation.navigate('PublicProfile', { userId: item.taggedUser?._id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Tagged @${item.taggedUser?.username}`}
                    className="flex-row items-center bg-paper-2 py-2 px-3 rounded-full self-start mb-3 active:opacity-85"
                >
                    <Ionicons name="at" size={14} color={C.accentText} />
                    <Text className="text-accent-text font-semibold text-sm ml-1">{item.taggedUser?.username}</Text>
                </Pressable>
            ) : null}

            <View className="flex-row items-center border-t border-line pt-2" style={{ gap: 16 }}>
                <Pressable
                    onPress={() => onLike(item._id)}
                    accessibilityRole="button"
                    accessibilityLabel={liked ? 'Unlike' : 'Like'}
                    accessibilityState={{ selected: !!liked }}
                    hitSlop={8}
                    className="flex-row items-center py-2 active:opacity-85"
                >
                    <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? C.danger : C.ink3} />
                    <Text className="text-ink-2 ml-2 text-sm font-semibold">{item.likes || 0}</Text>
                </Pressable>
                <Pressable
                    onPress={() => onComments(item._id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Comments, ${item.comments?.length || 0}`}
                    hitSlop={8}
                    className="flex-row items-center py-2 active:opacity-85"
                >
                    <Ionicons name="chatbubbles-outline" size={20} color={C.ink3} />
                    <Text className="text-ink-2 ml-2 text-sm font-semibold">{item.comments?.length || 0}</Text>
                </Pressable>
            </View>
        </Card>
    );
});

const ConfessionFeed = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [confessions, setConfessions] = useState<any[]>(globalConfessionsCache);
    const [loading, setLoading] = useState(globalConfessionsCache.length === 0);
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);
    const [newConfession, setNewConfession] = useState('');
    const [selectedColor, setSelectedColor] = useState(CONFESSION_COLOR);
    const [submitting, setSubmitting] = useState(false);

    // Pagination
    const [page, setPage] = useState(globalCurrentPage);
    const [hasMore, setHasMore] = useState(globalHasMore);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);

    // Edit state
    const [editingConfession, setEditingConfession] = useState<any>(null);

    // Tagging states
    const [userSuggestions, setUserSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [taggedUser, setTaggedUser] = useState<any>(null);
    const searchTimeout = useRef<any>(null);

    const [activeConfessionId, setActiveConfessionId] = useState<string | null>(null);

    const loadingMoreRef = useRef(false);

    useEffect(() => {
        // With a warm cache, show it instantly and refresh quietly underneath;
        // before, a cached feed was never refetched for the rest of the session.
        fetchConfessions(1, true);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, []);

    // Keep the module cache in step with local edits (post/edit/delete/like), so
    // coming back doesn't resurrect a deleted confession or an old like count.
    useEffect(() => { globalConfessionsCache = confessions; }, [confessions]);

    const fetchConfessions = async (pageNum = 1, shouldRefresh = false) => {
        if (!globalHasMore && !shouldRefresh && pageNum !== 1) return;

        if (pageNum === 1 && !shouldRefresh) setLoading(true);
        if (pageNum > 1) {
            // onEndReached can fire several times before `loadingMore` re-renders.
            if (loadingMoreRef.current) return;
            loadingMoreRef.current = true;
            setLoadingMore(true);
        }

        try {
            const res = await axios.get(`/confessions?page=${pageNum}&limit=15`);
            if (pageNum === 1) setLoadError(false);
            if (res.data?.success) {
                const newConfessions = res.data.confessions || [];
                if (shouldRefresh || pageNum === 1) {
                    globalConfessionsCache = newConfessions;
                    setConfessions(newConfessions);
                } else {
                    globalConfessionsCache = [...globalConfessionsCache, ...newConfessions];
                    setConfessions(globalConfessionsCache);
                }
                globalCurrentPage = pageNum;
                globalHasMore = res.data.hasMore;

                setPage(globalCurrentPage);
                setHasMore(globalHasMore);
            }
        } catch (error) {
            console.error('Fetch confessions error:', error);
            if (pageNum === 1) setLoadError(true);
        } finally {
            setLoading(false);
            if (pageNum > 1) loadingMoreRef.current = false;
            setLoadingMore(false);
            setRefreshing(false);
        }
    };

    const loadMore = () => {
        if (!loadingMore && hasMore) {
            fetchConfessions(page + 1);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchConfessions(1, true);
    };

    const handlePostConfession = async () => {
        if (!newConfession.trim() || submitting) return;
        setSubmitting(true);
        try {
            if (editingConfession) {
                const res = await axios.put(`/confessions/${editingConfession._id}`, {
                    content: newConfession,
                    color: selectedColor,
                    taggedUserId: taggedUser?._id
                });
                if (res.data.success) {
                    setConfessions(prev => prev.map((c: any) => c._id === editingConfession._id ? res.data.confession : c));
                    Toast.show({ type: 'success', text1: 'Confession updated!' });
                }
            } else {
                const res = await axios.post('/confessions', {
                    content: newConfession,
                    color: selectedColor,
                    taggedUserId: taggedUser?._id
                });
                if (res.data.success) {
                    setConfessions(prev => [res.data.confession, ...prev]);
                    Toast.show({ type: 'success', text1: 'Posted anonymously!' });
                }
            }
            closePostModal();
        } catch (error: any) {
            console.error('Confession Opt Error:', error.response?.data || error.message);
            Toast.show({ type: 'error', text1: error.response?.data?.message || 'Operation failed' });
        } finally {
            setSubmitting(false);
        }
    };

    const closePostModal = () => {
        setIsPostModalOpen(false);
        setEditingConfession(null);
        setNewConfession('');
        setTaggedUser(null);
        setSelectedColor(CONFESSION_COLOR);
    };

    const openEditModal = useCallback((item: any) => {
        setEditingConfession(item);
        setNewConfession(item.content);
        setSelectedColor(item.color);
        if (item.taggedUser) setTaggedUser(item.taggedUser);
        setIsPostModalOpen(true);
    }, []);

    const handleDelete = useCallback((id: string) => {
        Alert.alert(
            "Delete Confession?",
            "This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive", onPress: async () => {
                        try {
                            const res = await axios.delete(`/confessions/${id}`);
                            if (res.data.success) {
                                setConfessions(prev => prev.filter((c: any) => c._id !== id));
                                Toast.show({ type: 'success', text1: 'Confession deleted' });
                            }
                        } catch (e) {
                            Toast.show({ type: 'error', text1: 'Delete failed' });
                        }
                    }
                }
            ]
        );
    }, []);

    const handleTextChange = (text: string) => {
        setNewConfession(text);
        if (editingConfession) return; // Disable tagging search while editing existing post to avoid confusion

        const lastWord = text.split(' ').pop();
        if (lastWord?.startsWith('@') && lastWord.length > 1) {
            const query = lastWord.substring(1);
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
            searchTimeout.current = setTimeout(async () => {
                try {
                    const res = await axios.get(`/confessions/search-users?query=${encodeURIComponent(query)}`);
                    if (res.data.success) {
                        setUserSuggestions(res.data.users || []);
                        setShowSuggestions((res.data.users?.length || 0) > 0);
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 1000);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectUserToTag = (u: any) => {
        setTaggedUser(u);
        const parts = newConfession.split(' ');
        parts.pop();
        setNewConfession(parts.join(' ') + (parts.length > 0 ? ' ' : ''));
        setShowSuggestions(false);
    };

    const handleLike = useCallback(async (id: string) => {
        try {
            const res = await axios.post(`/confessions/like/${id}`);
            if (res.data.success) {
                setConfessions(prev => prev.map((c: any) => c._id === id ? res.data.confession : c));
            }
        } catch (error) {
            console.error('Like error:', error);
        }
    }, []);

    // Reported confessions vanish at once; the server hides them on next fetch.
    const handleReport = useCallback((id: string) => {
        report({ targetType: 'confession', targetId: id }, () => setConfessions(prev => prev.filter((c: any) => c._id !== id)));
    }, []);

    const renderConfession = useCallback(({ item }: any) => (
        <ConfessionItem
            item={item}
            user={user}
            onLike={handleLike}
            onComments={setActiveConfessionId}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onReport={handleReport}
            navigation={navigation}
        />
    ), [user, handleLike, openEditModal, handleDelete, handleReport, navigation]);

    // `comments` is only ever read for its length.
    const onCommentCount = (id: string, count: number) => {
        setConfessions(prev => prev.map((c: any) => (c._id === id ? { ...c, comments: Array(count).fill('') } : c)));
    };

    if (loading && confessions.length === 0) {
        return (
            <View className="flex-1 bg-paper">
                <AppBar title="Confessions Feed" onBack={() => navigation.goBack()} />
                <View className="px-gutter pb-4 pt-2">
                    {[1, 2, 3].map(i => <ConfessionSkeleton key={i} />)}
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar
                    onBack={() => navigation.goBack()}
                    title="Confessions Feed"
                    right={<IconBtn name="add" boxed accessibilityLabel="Post a confession" onPress={() => setIsPostModalOpen(true)} />}
                />

                <FlatList keyboardShouldPersistTaps="handled"
                    data={confessions}
                    keyExtractor={(item: any) => item._id}
                    renderItem={renderConfession}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 }}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    ListHeaderComponent={<Meta style={{ marginBottom: 12 }}>{user?.college || 'Campus'}</Meta>}
                    ListFooterComponent={() => (
                        loadingMore ? <ActivityIndicator color={C.brand[500]} className="my-8" /> : <View className="h-20" />
                    )}
                    ListEmptyComponent={loadError ? (
                        <View className="mt-20">
                            <Empty
                                icon="cloud-offline-outline"
                                title="Couldn't load confessions"
                                action={<Button title="Try again" onPress={() => fetchConfessions(1)} />}
                            />
                        </View>
                    ) : (
                        <View className="mt-20">
                            <Empty icon="lock-closed-outline" title="No confessions yet" hint="Be the first to post anonymously." action={<Button variant="primary" title="Post a confession" onPress={() => setIsPostModalOpen(true)} />} />
                        </View>
                    )}
                />

                <Sheet
                    visible={isPostModalOpen}
                    onClose={closePostModal}
                    title={editingConfession ? 'Edit confession' : 'Post a confession'}
                    subtitle="Posted anonymously"
                    footer={<Button title={editingConfession ? 'Save changes' : 'Post anonymously'} variant="primary" block loading={submitting} onPress={handlePostConfession} />}
                >
                    {taggedUser && !editingConfession ? (
                        <View className="flex-row items-center bg-paper-2 py-1 pl-3 rounded-full self-start mb-3">
                            {taggedUser.avatar ? (
                                <ExpoImage source={{ uri: taggedUser.avatar }} style={{ width: 20, height: 20, borderRadius: 10 }} cachePolicy="memory-disk" />
                            ) : (
                                <Ionicons name="person-outline" size={14} color={C.ink3} />
                            )}
                            <Text className="text-ink-2 font-semibold ml-2 text-sm">Tagged {taggedUser.name}</Text>
                            <IconBtn name="close" size={16} color={C.ink3} accessibilityLabel="Remove tag" onPress={() => setTaggedUser(null)} />
                        </View>
                    ) : null}

                    <FormField
                        accessibilityLabel="Confession"
                        placeholder={editingConfession ? "Update your secret..." : "Type your secret (use @ to tag someone)"}
                        multiline
                        value={newConfession}
                        onChangeText={handleTextChange}
                        maxLength={500}
                        hint={`${newConfession.length}/500`}
                        style={{ minHeight: 160 }}
                    />

                    {showSuggestions ? (
                        <Card style={{ marginTop: 8, overflow: 'hidden' }}>
                            {userSuggestions.map((u: any) => (
                                <ListRow
                                    key={u._id}
                                    onPress={() => selectUserToTag(u)}
                                    chevron={false}
                                    style={{ paddingHorizontal: 16 }}
                                    leading={u.avatar ? (
                                        <ExpoImage source={{ uri: u.avatar }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.paper2 }} cachePolicy="memory-disk" />
                                    ) : (
                                        <IconTile icon="person-outline" size={40} color={C.ink3} />
                                    )}
                                    title={u.name}
                                    subtitle={`@${u.username}`}
                                />
                            ))}
                        </Card>
                    ) : null}
                </Sheet>

                <CommentsSheet
                    visible={!!activeConfessionId}
                    onClose={() => setActiveConfessionId(null)}
                    resource={CONFESSION_COMMENTS}
                    targetId={activeConfessionId}
                    currentUser={user}
                    onCountChange={onCommentCount}
                    onReport={(c, hide) => report({ targetType: 'confession_comment', targetId: c._id }, hide)}
                />
            </View>
        </View>
    );
};

export default ConfessionFeed;
