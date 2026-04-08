import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Dimensions, ScrollView, Alert } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import Skeleton, { ConfessionSkeleton } from '../Skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const ANONYMOUS_AVATAR = 'https://cdn-icons-png.flaticon.com/512/1177/1177568.png';

const CONFESSION_COLORS = [
    '#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#9B59B6', '#E67E22', '#1ABC9C'
];

const maskName = (name: string) => {
    if (!name) return 'User';
    if (name.length <= 2) return name;
    return `${name[0]}***${name[name.length - 1]}`;
};

/* ---------------- GLOBAL CACHE ---------------- */
let globalConfessionsCache: any[] = [];
let globalCurrentPage = 1;
let globalHasMore = true;

const ConfessionFeed = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [confessions, setConfessions] = useState<any[]>(globalConfessionsCache);
    const [loading, setLoading] = useState(globalConfessionsCache.length === 0);
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);
    const [newConfession, setNewConfession] = useState('');
    const [selectedColor, setSelectedColor] = useState(CONFESSION_COLORS[0]);
    const [submitting, setSubmitting] = useState(false);
    
    // Pagination
    const [page, setPage] = useState(globalCurrentPage);
    const [hasMore, setHasMore] = useState(globalHasMore);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // Edit state
    const [editingConfession, setEditingConfession] = useState<any>(null);

    // Tagging states
    const [userSuggestions, setUserSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [taggedUser, setTaggedUser] = useState<any>(null);
    const searchTimeout = useRef<any>(null);

    interface CommentsModalState {
        visible: boolean;
        confessionId: string | null;
        comments: any[];
    }

    // Comments states
    const [commentsModal, setCommentsModal] = useState<CommentsModalState>({ 
        visible: false, 
        confessionId: null, 
        comments: [] 
    });
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<any>(null);

    useEffect(() => {
        if (globalConfessionsCache.length === 0) {
            fetchConfessions(1, true);
        }
    }, []);

    const fetchConfessions = async (pageNum = 1, shouldRefresh = false) => {
        if (!globalHasMore && !shouldRefresh && pageNum !== 1) return;
        
        if (pageNum === 1 && !shouldRefresh) setLoading(true);
        if (pageNum > 1) setLoadingMore(true);

        try {
            const res = await axios.get(`/confessions?page=${pageNum}&limit=15`);
            if (res.data.success) {
                const newConfessions = res.data.confessions;
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
        } finally {
            setLoading(false);
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
        if (!newConfession.trim()) return;
        setSubmitting(true);
        try {
            if (editingConfession) {
                console.log('UPDATING:', editingConfession._id, { content: newConfession, color: selectedColor, taggedUserId: taggedUser?._id });
                const res = await axios.put(`/confessions/${editingConfession._id}`, { 
                    content: newConfession, 
                    color: selectedColor,
                    taggedUserId: taggedUser?._id 
                });
                console.log('UPDATE RES:', res.data);
                if (res.data.success) {
                    setConfessions(confessions.map((c: any) => c._id === editingConfession._id ? res.data.confession : c));
                    Toast.show({ type: 'success', text1: 'Confession updated!' });
                }
            } else {
                console.log('POSTING NEW:', { content: newConfession, color: selectedColor, taggedUserId: taggedUser?._id });
                const res = await axios.post('/confessions', { 
                    content: newConfession, 
                    color: selectedColor,
                    taggedUserId: taggedUser?._id 
                });
                console.log('POST RES:', res.data);
                if (res.data.success) {
                    setConfessions([res.data.confession, ...confessions]);
                    Toast.show({ type: 'success', text1: 'Posted anonymously! 🤫' });
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
        setSelectedColor(CONFESSION_COLORS[0]);
    };

    const openEditModal = (item: any) => {
        setEditingConfession(item);
        setNewConfession(item.content);
        setSelectedColor(item.color);
        if (item.taggedUser) setTaggedUser(item.taggedUser);
        setIsPostModalOpen(true);
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Confession?",
            "This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        const res = await axios.delete(`/confessions/${id}`);
                        if (res.data.success) {
                            setConfessions(confessions.filter((c: any) => c._id !== id));
                            Toast.show({ type: 'success', text1: 'Confession deleted' });
                        }
                    } catch (e) {
                        Toast.show({ type: 'error', text1: 'Delete failed' });
                    }
                }}
            ]
        );
    };

    const handleTextChange = (text: string) => {
        setNewConfession(text);
        if (editingConfession) return; // Disable tagging search while editing existing post to avoid confusion

        const lastWord = text.split(' ').pop();
        if (lastWord?.startsWith('@') && lastWord.length > 1) {
            const query = lastWord.substring(1);
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
            searchTimeout.current = setTimeout(async () => {
                try {
                    const res = await axios.get(`/confessions/search-users?query=${query}`);
                    if (res.data.success) {
                        setUserSuggestions(res.data.users);
                        setShowSuggestions(res.data.users.length > 0);
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

    const renderConfession = ({ item }: any) => (
        <View style={{ backgroundColor: item.color }} className="p-5 rounded-3xl mb-4 shadow-xl">
             <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                    <ExpoImage source={{ uri: ANONYMOUS_AVATAR }} className="w-10 h-10 rounded-full bg-white/20" cachePolicy="disk" />
                    <View className="ml-3">
                        <Text className="text-white font-black text-base">{maskName(item.user?.name || 'User')}</Text>
                        <Text className="text-white/60 text-xs font-bold uppercase tracking-tighter">Anonymous Student</Text>
                    </View>
                </View>

                {/* Manage Menu (Admin/Owner) */}
                {(item.canManage) && (
                    <TouchableOpacity 
                        onPress={() => {
                            console.log('Opening menu for item:', item._id);
                            Alert.alert(
                                "Manage Confession",
                                "Select action",
                                [
                                    { text: "Update / Edit", icon: 'create-outline' as any, onPress: () => openEditModal(item) } as any,
                                    { text: "Delete Post", style: "destructive", onPress: () => handleDelete(item._id) },
                                    { text: "Cancel", style: "cancel" }
                                ]
                            );
                        }} 
                        className="p-3 bg-black/30 rounded-2xl ml-2 border border-white/10"
                    >
                        <Ionicons name="settings-sharp" size={24} color="white" />
                    </TouchableOpacity>
                )}
            </View>

            <Text className="text-white text-lg font-bold leading-7 mb-2">{item.content}</Text>
            
            {item.taggedUser && (
                <TouchableOpacity 
                    onPress={() => {
                        console.log('Navigating to PublicProfile:', item.taggedUser?._id);
                        navigation.navigate('PublicProfile', { userId: item.taggedUser?._id });
                    }}
                    className="flex-row items-center bg-black/20 py-2 px-4 rounded-full self-start mb-4 border border-white/10"
                >
                    <Ionicons name="at-outline" size={12} color="white" />
                    <Text className="text-white font-bold text-sm">{item.taggedUser?.username}</Text>
                </TouchableOpacity>
            )}

            <View className="flex-row items-center justify-between border-t border-white/20 pt-4">
                <Text className="text-white/50 text-[10px] uppercase font-bold">{new Date(item.createdAt).toLocaleDateString()}</Text>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => handleLike(item._id)} className="flex-row items-center mr-4">
                        <Ionicons 
                            name={item.liked_by?.includes(user?._id || user?.id) ? "heart" : "heart-outline"} 
                            size={20} 
                            color="white" 
                        />
                        <Text className="text-white ml-1.5 text-xs font-black">{item.likes || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => fetchComments(item._id)} className="flex-row items-center">
                        <Ionicons name="chatbubbles-outline" size={20} color="white" />
                        <Text className="text-white ml-1.5 text-xs font-black">{item.comments?.length || 0}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const handleLike = async (id: string) => {
        try {
            const res = await axios.post(`/confessions/like/${id}`);
            if (res.data.success) {
                setConfessions(confessions.map((c: any) => c._id === id ? res.data.confession : c));
            }
        } catch (error) {
            console.error('Like error:', error);
        }
    };

    const fetchComments = async (id: string) => {
        try {
            const res = await axios.get(`/confessions/comments/${id}`);
            if (res.data.success) {
                setCommentsModal({ visible: true, confessionId: id, comments: res.data.comments });
            }
        } catch (error) {
            console.error('Fetch comments error:', error);
        }
    };

    const handleComment = async () => {
        if (!newComment.trim() || !commentsModal.confessionId) return;
        try {
            const res = await axios.post(`/confessions/comment/${commentsModal.confessionId}`, { 
                text: newComment,
                parentCommentId: replyTo?._id 
            });
            if (res.data.success) {
                if (replyTo) {
                    setCommentsModal({
                        ...commentsModal,
                        comments: commentsModal.comments.map((c: any) => 
                            c._id === replyTo._id ? { ...c, replies: [...(c.replies || []), res.data.comment] } : c
                        )
                    });
                } else {
                    setCommentsModal({ ...commentsModal, comments: [res.data.comment, ...commentsModal.comments] });
                }
                setNewComment('');
                setReplyTo(null);
            }
        } catch (error) {
            console.error('Comment error:', error);
        }
    };

    const renderComment = (item: any, isReply = false) => (
        <View key={item._id} className={`mb-4 ${isReply ? 'ml-10 border-l-2 border-gray-200 pl-4' : ''}`}>
            <View className="flex-row items-center mb-2">
                <ExpoImage source={{ uri: item.commentor?.avatar || ANONYMOUS_AVATAR }} className="w-8 h-8 rounded-full bg-gray-100" cachePolicy="disk" />
                <View className="ml-2 flex-1">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-zinc-800 text-xs font-bold">@{item.commentor?.username}</Text>
                        <Text className="text-gray-400 text-[10px] font-medium">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <Text className="text-zinc-900 text-sm mt-0.5">{item.text}</Text>
                    
                    {!isReply && (
                        <TouchableOpacity onPress={() => {
                            setReplyTo(item);
                            setNewComment(`@${item.commentor?.username} `);
                        }} className="mt-2">
                            <Text className="text-pink-500 text-xs font-black uppercase tracking-widest">Reply</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {item.replies && item.replies.map((reply: any) => renderComment(reply, true))}
        </View>
    );

    if (loading && confessions.length === 0) {
        return (
            <View className="flex-1 bg-gray-100 p-4 pt-12">
                <View className="flex-row items-center justify-between mb-8">
                    <View>
                        <Text className="text-zinc-900 text-3xl font-black tracking-tighter">Secrets & Feeds</Text>
                        <Skeleton width={150} height={15} style={{ marginTop: 6 }} />
                    </View>
                </View>
                {[1, 2, 3].map(i => <ConfessionSkeleton key={i} />)}
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-100 p-4">
            <View className="flex-row items-center justify-between mb-8">
                <View className='flex-row gap-2 items-center'>
                    <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full bg-gray-100">
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </TouchableOpacity>
                    <View className='flex-col'>
                        <Text className="text-black text-2xl font-black">Confession Feed</Text>
                        <Text className="text-gray-500 text-sm font-medium">{user?.college} Community</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    onPress={() => setIsPostModalOpen(true)}
                    className="bg-pink-500/20 p-3 rounded-full border border-pink-500/30"
                >
                    <Ionicons name="megaphone-outline" size={24} color="#ec4899" />
                </TouchableOpacity>
            </View>

            <FlatList 
                data={confessions}
                keyExtractor={(item: any) => item._id}
                renderItem={renderConfession}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                ListFooterComponent={() => (
                    loadingMore ? <ActivityIndicator color="#ec4899" className="my-4" /> : null
                )}
                ListEmptyComponent={
                    <View className="mt-20 items-center">
                        <Ionicons name="lock-closed-outline" size={60} color="#333" />
                        <Text className="text-gray-500 mt-4 text-center font-medium">No confessions yet. Be the first! 🤫</Text>
                    </View>
                }
            />

            {/* Post/Edit Modal */}
            <Modal visible={isPostModalOpen} animationType="slide" transparent={true}>
                <View className="flex-1 bg-black/60 justify-end">
                    <View className="bg-white rounded-t-[40px] p-8 pb-12 border-t border-gray-200 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-8">
                            <Text className="text-zinc-900 text-2xl font-black">{editingConfession ? 'Edit Secret' : 'Spill the Beans'}</Text>
                            <TouchableOpacity onPress={closePostModal} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                <Ionicons name="close" size={20} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ backgroundColor: selectedColor }} className="p-6 rounded-[32px] mb-6 shadow-lg shadow-black/10">
                            {taggedUser && !editingConfession && (
                                <View className="flex-row items-center bg-transparent border border-white p-2 px-3 rounded-full self-start mb-3">
                                    <View className="flex-row items-center">
                                        <ExpoImage source={{ uri: taggedUser.avatar || ANONYMOUS_AVATAR }} className="w-5 h-5 rounded-full" />
                                        <Text className="text-white font-bold ml-2 text-xs">Tagged: {taggedUser.name}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setTaggedUser(null)} className="ml-2 bg-white/20 rounded-full w-4 h-4 items-center justify-center">
                                        <Ionicons name="close" size={12} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <TextInput 
                                placeholder={editingConfession ? "Update your secret..." : "Type your secret (use @ to tag someone)"}
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                multiline
                                value={newConfession}
                                onChangeText={handleTextChange}
                                className="text-white text-xl font-bold min-h-[150px]"
                                maxLength={500}
                                textAlignVertical="top"
                            />
                        </View>

                        {showSuggestions && (
                            <View className="absolute top-[100px] left-8 right-8 bg-white rounded-2xl shadow-lg z-50 border border-gray-100 max-h-[200px]">
                                <ScrollView keyboardShouldPersistTaps="always">
                                    {userSuggestions.map((u: any) => (
                                        <TouchableOpacity 
                                            key={u._id} 
                                            onPress={() => selectUserToTag(u)}
                                            className="flex-row items-center p-4 border-b border-gray-50"
                                        >
                                            <ExpoImage source={{ uri: u.avatar || ANONYMOUS_AVATAR }} className="w-8 h-8 rounded-full bg-gray-100" />
                                            <View className="ml-3">
                                                <Text className="text-zinc-900 font-bold text-sm">{u.name}</Text>
                                                <Text className="text-gray-500 text-xs">@{u.username}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <Text className="text-gray-500 mb-4 text-[10px] font-black uppercase tracking-widest text-center">Pick Your Mood</Text>
                        <View className="flex-row justify-between mb-10 px-2">
                            {CONFESSION_COLORS.map(color => (
                                <TouchableOpacity 
                                    key={color}
                                    onPress={() => setSelectedColor(color)}
                                    style={{ 
                                        backgroundColor: color, 
                                        borderWidth: selectedColor === color ? 3 : 0, 
                                        borderColor: 'white',
                                        transform: [{ scale: selectedColor === color ? 1.2 : 1 }]
                                    }}
                                    className="w-10 h-10 rounded-full shadow-lg"
                                />
                            ))}
                        </View>

                        <TouchableOpacity 
                            onPress={handlePostConfession}
                            disabled={submitting}
                            className={`py-5 rounded-3xl items-center shadow-md ${submitting ? 'bg-pink-300' : 'bg-pink-500'}`}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-white font-black text-lg tracking-tight">
                                    {editingConfession ? 'UPDATE CONFESSION ✨' : 'POST ANONYMOUSLY 🤫'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Comments Modal */}
            <Modal visible={commentsModal.visible} animationType="slide" transparent={true}>
                <View className="flex-1 bg-black/60 justify-end">
                    <View className="bg-white rounded-t-[40px] p-6 h-[85%] border-t border-gray-200 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-8 px-2">
                            <Text className="text-zinc-900 text-2xl font-black">Comment Thread</Text>
                            <TouchableOpacity onPress={() => {
                                setCommentsModal({ ...commentsModal, visible: false });
                                setReplyTo(null);
                            }} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                <Ionicons name="close" size={20} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>

                        <FlatList 
                            data={commentsModal.comments}
                            keyExtractor={(c: any) => c._id}
                            renderItem={({ item }) => renderComment(item)}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={<Text className="text-gray-500 text-center mt-20 font-medium">Silence is golden. Join in!</Text>}
                        />

                        {replyTo && (
                            <View className="bg-pink-500/10 p-3 rounded-t-2xl border-l-4 border-pink-500 flex-row items-center justify-between">
                                <Text className="text-pink-500 text-xs font-bold">Replying to @{replyTo.commentor?.username}</Text>
                                <TouchableOpacity onPress={() => {
                                    setReplyTo(null);
                                    setNewComment('');
                                }}>
                                    <Ionicons name="close" size={16} color="#ec4899" />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View className="flex-row items-center bg-gray-50 rounded-[24px] p-2 px-3 border border-gray-100 mb-8">
                            <ExpoImage source={{ uri: user?.avatar || ANONYMOUS_AVATAR }} className="w-8 h-8 rounded-full mr-2 bg-gray-200" cachePolicy="disk" />
                            <TextInput 
                                placeholder="Add a comment..."
                                placeholderTextColor="#9ca3af"
                                value={newComment}
                                onChangeText={setNewComment}
                                className="text-zinc-900 flex-1 py-3 font-medium"
                            />
                            <TouchableOpacity onPress={handleComment} disabled={!newComment.trim()}>
                                <Ionicons name="send" size={24} color={newComment.trim() ? "#ec4899" : "#9ca3af"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default ConfessionFeed;
