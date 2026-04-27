import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Dimensions, ScrollView, Alert, StatusBar } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import Skeleton, { ConfessionSkeleton } from '../Skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const ANONYMOUS_AVATAR = 'https://cdn-icons-png.flaticon.com/512/1177/1177568.png';

const CONFESSION_COLORS = [
    '#f97316', '#4D96FF', '#6BCB77', '#FFD93D', '#9B59B6', '#E67E22', '#1ABC9C'
];

const maskName = (name: string) => {
    if (!name) return 'User';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        const n = parts[0];
        if (n.length <= 1) return n.toUpperCase();
        return `${n[0]}. ${n[n.length - 1]}.`.toUpperCase();
    }
    const firstInitial = parts[0][0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstInitial}. ${lastInitial}.`.toUpperCase();
};

/* ---------------- GLOBAL CACHE ---------------- */
let globalConfessionsCache: any[] = [];
let globalCurrentPage = 1;
let globalHasMore = true;

const ConfessionItem = ({ item, user, onLike, onComments, onEdit, onDelete, navigation }: any) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_LIMIT = 200;
    const isLongText = (item.content?.length || 0) > MAX_LIMIT;

    return (
        <View style={{ backgroundColor: item.color }} className="p-3 rounded-xl mb-3 shadow-xl shadow-black/10">
            <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center">
                    <ExpoImage source={{ uri: ANONYMOUS_AVATAR }} className="w-11 h-11 rounded-full bg-white/20" cachePolicy="disk" />
                    <View className="ml-4">
                        <Text className="text-white font-black text-[16px] tracking-tighter uppercase italic">{maskName(item.user?.name || 'User')}</Text>
                        <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest">Anonymous Entity</Text>
                    </View>
                </View>

                {/* Manage Menu (Admin/Owner) */}
                {(item.canManage) && (
                    <TouchableOpacity
                        onPress={() => {
                            Alert.alert(
                                "Manage Content",
                                "Select protocol action",
                                [
                                    { text: "Update / Edit", onPress: () => onEdit(item) },
                                    { text: "Delete Post", style: "destructive", onPress: () => onDelete(item._id) },
                                    { text: "Cancel", style: "cancel" }
                                ]
                            );
                        }}
                        className="p-3 bg-black/20 rounded-2xl border border-white/10"
                    >
                        <Ionicons name="settings" size={20} color="white" />
                    </TouchableOpacity>
                )}
            </View>

            <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.9}>
                <Text className="text-white text-[17px] font-bold leading-7 mb-3 tracking-tight">
                    {isExpanded || !isLongText 
                        ? item.content 
                        : `${item.content.substring(0, MAX_LIMIT)}...`}
                    {isLongText && !isExpanded && (
                        <Text className="text-white/70 font-black text-[12px] uppercase"> Read More</Text>
                    )}
                    {isLongText && isExpanded && (
                        <Text className="text-white/70 font-black text-[12px] uppercase"> Show Less</Text>
                    )}
                </Text>
            </TouchableOpacity>

            {item.taggedUser && (
                <TouchableOpacity
                    onPress={() => {
                        navigation.navigate('PublicProfile', { userId: item.taggedUser?._id });
                    }}
                    className="flex-row items-center bg-black/20 py-2.5 px-5 rounded-full self-start mb-5 border border-white/10"
                >
                    <Ionicons name="at" size={14} color="white" />
                    <Text className="text-white font-black text-[11px] tracking-tighter">{item.taggedUser?.username}</Text>
                </TouchableOpacity>
            )}

            <View className="flex-row items-center justify-between border-t border-white/10 pt-5">
                <Text className="text-white/50 text-[9px] uppercase font-black tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</Text>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => onLike(item._id)} className="flex-row items-center mr-6">
                        <Ionicons
                            name={item.liked_by?.includes(user?._id || user?.id) ? "heart" : "heart-outline"}
                            size={20}
                            color="white"
                        />
                        <Text className="text-white ml-2 text-xs font-black">{item.likes || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onComments(item._id)} className="flex-row items-center">
                        <Ionicons name="chatbubbles-outline" size={20} color="white" />
                        <Text className="text-white ml-2 text-xs font-black">{item.comments?.length || 0}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

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
                {
                    text: "Delete", style: "destructive", onPress: async () => {
                        try {
                            const res = await axios.delete(`/confessions/${id}`);
                            if (res.data.success) {
                                setConfessions(confessions.filter((c: any) => c._id !== id));
                                Toast.show({ type: 'success', text1: 'Confession deleted' });
                            }
                        } catch (e) {
                            Toast.show({ type: 'error', text1: 'Delete failed' });
                        }
                    }
                }
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
        <ConfessionItem 
            item={item} 
            user={user} 
            onLike={handleLike} 
            onComments={fetchComments} 
            onEdit={openEditModal} 
            onDelete={handleDelete} 
            navigation={navigation} 
        />
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
        <View key={item._id} className={`mb-5 ${isReply ? 'ml-12 border-l-2 border-slate-100 pl-4' : ''}`}>
            <View className="flex-row items-center mb-3">
                <ExpoImage source={{ uri: item.commentor?.avatar || ANONYMOUS_AVATAR }} className="w-9 h-9 rounded-full bg-slate-50" cachePolicy="disk" />
                <View className="ml-3 flex-1">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-zinc-900 text-[12px] font-black">@{item.commentor?.username}</Text>
                        <Text className="text-slate-400 text-[9px] font-black">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <Text className="text-slate-600 text-[14px] mt-1 font-medium leading-5">{item.text}</Text>

                    {!isReply && (
                        <TouchableOpacity onPress={() => {
                            setReplyTo(item);
                            setNewComment(`@${item.commentor?.username} `);
                        }} className="mt-3">
                            <Text className="text-orange-500 text-[10px] font-black uppercase tracking-widest">Reply</Text>
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
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            
            {/* HEADER DECORATION */}
            <View className="absolute top-0 w-full h-80 opacity-20">
              <LinearGradient 
                colors={['#f97316', 'transparent']} 
                className="w-full h-full"
              />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Arena Header */}
                <View className="px-8 pt-2">
                    <View className="flex-row items-center justify-between mb-8">
                        <View className="flex-1">
                            <View className="flex-row items-center">
                                <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                                    Confessions <Text className="text-orange-500">FEED</Text>
                                </Text>
                            </View>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1px]">{user?.college} Broadcast Registry</Text>
                        </View>
                        
                        <TouchableOpacity
                            onPress={() => setIsPostModalOpen(true)}
                            className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-xl shadow-black/5"
                        >
                            <Ionicons name="megaphone" size={20} color="#f97316" />
                        </TouchableOpacity>
                    </View>
                </View>

            <FlatList
                data={confessions}
                keyExtractor={(item: any) => item._id}
                renderItem={renderConfession}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                ListFooterComponent={() => (
                    loadingMore ? <ActivityIndicator color="#f97316" className="my-8" /> : <View className="h-20" />
                )}
                ListEmptyComponent={
                    <View className="mt-20 items-center px-10">
                        <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6 shadow-inner">
                            <Ionicons name="lock-closed" size={40} color="#CBD5E1" />
                        </View>
                        <Text className="text-zinc-900 font-black italic uppercase text-xl tracking-tighter text-center">Protocol Locked</Text>
                        <Text className="text-slate-400 text-[11px] mt-2 text-center font-bold uppercase tracking-wide leading-5">No signals detected. Be the first to broadcast anonymously. 🤫</Text>
                    </View>
                }
            />

            {/* Post/Edit Modal */}
            <Modal visible={isPostModalOpen} animationType="slide" transparent={true}>
                <View className="flex-1 bg-black/60 justify-end">
                    <View className="bg-white rounded-t-[40px] p-8 pb-12 border-t border-slate-100 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-10">
                            <View>
                                <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                                    {editingConfession ? 'Update' : 'Spill'} <Text className="text-orange-500">Beans</Text>
                                </Text>
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Anonymous Protocol Active</Text>
                            </View>
                            <TouchableOpacity onPress={closePostModal} className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                                <Ionicons name="close" size={20} color="#18181b" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ backgroundColor: selectedColor }} className="p-8 rounded-[32px] mb-8 shadow-xl shadow-black/10 border border-white/20">
                            {taggedUser && !editingConfession && (
                                <View className="flex-row items-center bg-white/20 border border-white/30 p-2 px-4 rounded-full self-start mb-5">
                                    <ExpoImage source={{ uri: taggedUser.avatar || ANONYMOUS_AVATAR }} className="w-5 h-5 rounded-full" />
                                    <Text className="text-white font-black ml-2 text-[10px] uppercase tracking-widest">Tagged: {taggedUser.name}</Text>
                                    <TouchableOpacity onPress={() => setTaggedUser(null)} className="ml-3 bg-white/30 rounded-full w-4 h-4 items-center justify-center">
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
                                className="text-white text-xl font-bold min-h-[160px] tracking-tight"
                                maxLength={500}
                                textAlignVertical="top"
                            />
                        </View>

                        {showSuggestions && (
                            <View className="absolute top-[120px] left-8 right-8 bg-white rounded-2xl shadow-2xl z-50 border border-slate-100 max-h-[250px] overflow-hidden">
                                <ScrollView keyboardShouldPersistTaps="always">
                                    {userSuggestions.map((u: any) => (
                                        <TouchableOpacity
                                            key={u._id}
                                            onPress={() => selectUserToTag(u)}
                                            className="flex-row items-center p-5 border-b border-slate-50"
                                        >
                                            <ExpoImage source={{ uri: u.avatar || ANONYMOUS_AVATAR }} className="w-10 h-10 rounded-full bg-slate-50" />
                                            <View className="ml-4">
                                                <Text className="text-zinc-900 font-black text-sm uppercase tracking-tighter">{u.name}</Text>
                                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">@{u.username}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <Text className="text-slate-400 mb-6 text-[10px] font-black uppercase tracking-[2px] text-center italic">Archive Atmosphere</Text>
                        <View className="flex-row justify-between mb-10 px-2">
                            {CONFESSION_COLORS.map(color => (
                                <TouchableOpacity
                                    key={color}
                                    onPress={() => setSelectedColor(color)}
                                    style={{
                                        backgroundColor: color,
                                        borderWidth: selectedColor === color ? 4 : 0,
                                        borderColor: 'white',
                                        transform: [{ scale: selectedColor === color ? 1.2 : 1 }]
                                    }}
                                    className="w-10 h-10 rounded-full shadow-lg shadow-black/10"
                                />
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={handlePostConfession}
                            disabled={submitting}
                            className={`h-16 rounded-[24px] items-center justify-center shadow-xl ${submitting ? 'bg-slate-200' : 'bg-orange-500 shadow-orange-500/20'}`}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-white font-black italic uppercase tracking-widest text-[13px]">
                                    {editingConfession ? 'Execute Update ✨' : 'Secure Broadcast 🤫'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Comments Modal */}
            <Modal visible={commentsModal.visible} animationType="slide" transparent={true}>
                <View className="flex-1 bg-black/60 justify-end">
                    <View className="bg-white rounded-t-[40px] p-8 h-[85%] border-t border-slate-100 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-10 px-2">
                            <View>
                                <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                                    Signal <Text className="text-orange-500">Thread</Text>
                                </Text>
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Encrypted Commentary Archive</Text>
                            </View>
                            <TouchableOpacity onPress={() => {
                                setCommentsModal({ ...commentsModal, visible: false });
                                setReplyTo(null);
                            }} className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                                <Ionicons name="close" size={20} color="#18181b" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={commentsModal.comments}
                            keyExtractor={(c: any) => c._id}
                            renderItem={({ item }) => renderComment(item)}
                            contentContainerStyle={{ paddingBottom: 150 }}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View className="mt-20 items-center">
                                    <Text className="text-slate-400 text-[11px] font-black uppercase tracking-widest">Silence Detected. Join the frequency.</Text>
                                </View>
                            }
                        />

                        <View className="absolute bottom-10 left-8 right-8">
                            {replyTo && (
                                <View className="bg-orange-50 p-4 rounded-t-2xl border-l-4 border-orange-500 flex-row items-center justify-between border-t border-r border-orange-100">
                                    <Text className="text-orange-600 text-[10px] font-black uppercase tracking-widest">Replying to @{replyTo.commentor?.username}</Text>
                                    <TouchableOpacity onPress={() => {
                                        setReplyTo(null);
                                        setNewComment('');
                                    }}>
                                        <Ionicons name="close-circle" size={16} color="#f97316" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View className={`flex-row items-center bg-white p-3 border border-slate-100 shadow-2xl shadow-black/10 ${replyTo ? 'rounded-b-[24px]' : 'rounded-[24px]'}`}>
                                <ExpoImage source={{ uri: user?.avatar || ANONYMOUS_AVATAR }} className="w-9 h-9 rounded-full mr-4 bg-slate-50 border border-slate-100 shadow-inner" cachePolicy="disk" />
                                <TextInput
                                    placeholder="Broadcast signal..."
                                    placeholderTextColor="#94a3b8"
                                    value={newComment}
                                    onChangeText={setNewComment}
                                    className="text-zinc-900 flex-1 py-3 font-black italic uppercase text-[11px] tracking-tighter"
                                />
                                <TouchableOpacity 
                                    onPress={handleComment} 
                                    disabled={!newComment.trim()}
                                    className={`w-11 h-11 rounded-2xl items-center justify-center ${newComment.trim() ? 'bg-orange-500' : 'bg-slate-50'}`}
                                >
                                    <Ionicons name="send" size={18} color={newComment.trim() ? "white" : "#CBD5E1"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
            </SafeAreaView>
        </View>
    );
};

export default ConfessionFeed;
