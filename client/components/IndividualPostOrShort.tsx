import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {View, Text, ActivityIndicator, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, Pressable, Dimensions, ScrollView, Share, Image as RNImage} from 'react-native'
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import axios from "../context/axiosConfig";
import { useAuth } from '../context/auth.context';
import { useIsFocused } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import Avatar from './Avatar';
import { getFullUrl } from '../utils/imageUtils';
import { Alert } from './ui/AlertModal';

const { width, height } = Dimensions.get('window');
const SCREEN_WIDTH = Dimensions.get('screen').width;
const SCREEN_HEIGHT = Dimensions.get('screen').height;

// --- HELPER TO GET ENDPOINTS DYNAMICALLY ---
const getEndpoints = (isShort: boolean, id: string) => ({
    get: isShort ? `/shorts/individual/${id}` : `/post/individual/${id}`,
    like: isShort ? `/shorts/like/${id}` : `/post/like/${id}`,
    view: isShort ? `/shorts/views/${id}` : null,
    getComments: isShort ? `/shorts/comments/${id}` : `/post/comment/${id}`,
    addComment: isShort ? `/shorts/comment/${id}` : `/post/comment/${id}`,
    updateComment: isShort ? `/shorts/comment/update` : `/post/comment/update`,
    deleteComment: isShort ? `/shorts/comment/delete` : `/post/comment`,
});

// --- 0. COMMENT ITEM SUB-COMPONENT (Recursive) ---
const CommentItem = memo(({ 
    comment, 
    currentUser, 
    onReply, 
    onDelete, 
    onEdit, 
    editingId, 
    editingText, 
    setEditingText, 
    handleUpdate, 
    actionLoadingId, 
    isReply = false 
}: any) => (
    <View className={`${isReply ? 'ml-10 mt-3' : 'mb-5'}`}>
        <View className="flex-row">
            <ExpoImage 
                source={{ uri: getFullUrl(comment.commentor?.avatar) || 'https://ui-avatars.com/api/?name=User' }} 
                className={`${isReply ? 'h-7 w-7' : 'h-9 w-9'} rounded-full mr-3 bg-slate-200`} 
                cachePolicy="disk"
            />
            <View className="flex-1">
                <View className="flex flex-row items-center gap-1">
                    <Text className="text-black font-bold text-xs">{comment.commentor?.name}</Text>
                    <Text className="text-slate-500 text-2xs">@{comment.commentor?.username}</Text>
                </View>

                {editingId === comment._id ? (
                    <TextInput
                        value={editingText}
                        onChangeText={setEditingText}
                        className="text-black border-b border-slate-300 pb-1 mt-1 text-xs"
                        autoFocus
                    />
                ) : (
                    <Text className="text-slate-800 mt-0.5 text-xs leading-5">
                        {comment.replyToUser && <Text className="text-pink-500">@{comment.replyToUser.username} </Text>}
                        {comment.text}
                    </Text>
                )}

                {/* Actions */}
                <View className="flex-row mt-2 gap-4">
                    {!isReply && (
                        <Pressable onPress={() => onReply(comment)}>
                            <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wider">Reply</Text>
                        </Pressable>
                    )}
                    
                    {comment.commentor?._id === currentUser?._id && (
                        <>
                            {editingId === comment._id ? (
                                <Pressable onPress={() => handleUpdate(comment._id)}>
                                    {actionLoadingId === comment._id ? <ActivityIndicator size="small" color="#000" /> : <Text className="text-blue-500 text-2xs font-bold uppercase tracking-wider">Save</Text>}
                                </Pressable>
                            ) : (
                                <Pressable onPress={() => onEdit(comment)}>
                                    <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wider">Edit</Text>
                                </Pressable>
                            )}
                            <Pressable onPress={() => onDelete(comment._id)}>
                                {actionLoadingId === comment._id ? <ActivityIndicator size="small" color="red" /> : <Text className="text-red-400/80 text-2xs font-bold uppercase tracking-wider">Delete</Text>}
                            </Pressable>
                        </>
                    )}
                </View>
            </View>
        </View>
        
        {/* Render Replies Recursively */}
        {comment.replies && comment.replies.map((reply: any) => (
            <CommentItem 
                key={reply._id}
                comment={reply}
                currentUser={currentUser}
                onReply={onReply}
                onDelete={onDelete}
                onEdit={onEdit}
                editingId={editingId}
                editingText={editingText}
                setEditingText={setEditingText}
                handleUpdate={handleUpdate}
                actionLoadingId={actionLoadingId}
                isReply={true}
            />
        ))}
    </View>
));

// --- 1. UNIFIED COMMENTS MODAL ---
const UnifiedCommentsModal = ({ isVisible, id, isShort, onClose, currentUser, onCommentAdded }: any) => {
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const commentInputRef = useRef<TextInput>(null);

    const endpoints = useMemo(() => getEndpoints(isShort, id), [isShort, id]);

    const fetchComments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(endpoints.getComments);
            if (res.data.success) {
                setComments(res.data.comments);
            }
        } catch (error) {
            console.log("Error loading comments", error);
        } finally {
            setLoading(false);
        }
    }, [endpoints.getComments]);

    useEffect(() => {
        if (isVisible && id) fetchComments();
    }, [isVisible, id]);

    const handlePostComment = async () => {
        if (!newComment.trim()) return;
        setPosting(true);
        try {
            const res = await axios.post(endpoints.addComment, { 
                text: newComment,
                parentCommentId: replyingTo?._id || null
            });
            if (res.data.success) {
                fetchComments(); 
                setNewComment('');
                setReplyingTo(null);
                if (onCommentAdded) onCommentAdded();
            }
        } catch (error) {
            Alert.alert("Error", "Could not post comment");
        } finally {
            setPosting(false);
        }
    };

    const handleUpdateComment = async (commentId: string) => {
        if (!editingText.trim()) return;
        setActionLoadingId(commentId);
        try {
            const url = `${endpoints.updateComment}/${commentId}`;
            await axios.post(url, { text: editingText });
            fetchComments();
            setEditingId(null);
            setEditingText("");
        } catch (error) {
            Alert.alert("Error", "Update failed");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        setActionLoadingId(commentId);
        try {
            const url = `${endpoints.deleteComment}/${commentId}`;
            await axios.post(url).catch(() => axios.delete(url));
            fetchComments();
        } catch (error) {
            Alert.alert("Error", "Delete failed");
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1 justify-end bg-black/60"
            >
                <Pressable className="flex-1" onPress={onClose} />

                <View className="bg-white rounded-t-3xl h-[75%] pt-4 border-t border-slate-100 shadow-2xl">
                    {/* Header */}
                    <View className="items-center mb-3">
                        <View className="h-1.5 w-12 bg-slate-300 rounded-full mb-3" />
                        <Text className="text-black font-bold text-lg">Comments</Text>
                    </View>

                    {/* List */}
                    {loading ? (
                        <ActivityIndicator size="large" color="#f97316" className="mt-10" />
                    ) : (
                        <FlatList
                            data={comments}
                            keyExtractor={(item) => item._id}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
                            initialNumToRender={10}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            removeClippedSubviews={Platform.OS === 'android'}
                            ListEmptyComponent={
                                <Text className="text-slate-500 text-center mt-10">No comments yet</Text>
                            }
                            renderItem={({ item }) => (
                                <CommentItem 
                                    comment={item}
                                    currentUser={currentUser}
                                    onReply={(c: any) => {
                                        setReplyingTo(c);
                                        setNewComment(`@${c.commentor.username} `);
                                        commentInputRef.current?.focus();
                                    }}
                                    onDelete={handleDeleteComment}
                                    onEdit={(c: any) => {
                                        setEditingId(c._id);
                                        setEditingText(c.text);
                                    }}
                                    editingId={editingId}
                                    editingText={editingText}
                                    setEditingText={setEditingText}
                                    handleUpdate={handleUpdateComment}
                                    actionLoadingId={actionLoadingId}
                                />
                            )}
                        />
                    )}

                    {/* Input */}
                    <View className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white px-3 py-2 shadow-2xl">
                        {replyingTo && (
                            <View className="flex-row items-center justify-between bg-slate-100 px-3 py-2 mb-2 rounded-lg mx-2 border border-slate-200">
                                <Text className="text-slate-500 text-xs">Replying to <Text className="font-bold text-black">@{replyingTo.commentor?.username}</Text></Text>
                                <Pressable onPress={() => setReplyingTo(null)}>
                                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                                </Pressable>
                            </View>
                        )}
                        <View className="flex-row items-center px-2">
                            <TextInput
                                ref={commentInputRef}
                                value={newComment}
                                onChangeText={setNewComment}
                                placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
                                placeholderTextColor="#9ca3af"
                                className="flex-1 text-black bg-slate-100 border border-slate-200 rounded-full px-4 py-3 mr-2 font-medium"
                                multiline
                            />
                            <Pressable onPress={handlePostComment} disabled={posting || !newComment.trim()}>
                                {posting ? <ActivityIndicator size="small" color="#f97316" /> : <Text className={`font-bold px-2 ${!newComment.trim() ? 'text-slate-500' : 'text-blue-500'}`}>Post</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// --- 2. MAIN COMPONENT ---
const IndividualPostOrShort = ({ route, navigation }: any) => {
    const { postId, shortId } = route.params;
    const isShort = !!shortId;
    const id = shortId || postId;
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const { user: currentUser } = useAuth();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Interaction States
    const [commentCount, setCommentCount] = useState(0);
    const [isCommentModalVisible, setCommentModalVisible] = useState(false);
    
    // Post Voting State
    const [vote, setVote] = useState<'up' | 'down' | null>(null);
    const [score, setScore] = useState(0);

    // Shorts Like State (Shorts still use Likes)
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    // UI State
    const [resizeMode, setResizeMode] = useState(false);
    const [showFullText, setShowFullText] = useState(false);
    const isFocused = useIsFocused();
    const videoRef = useRef<Video>(null);

    useEffect(() => {
        if (!id) {
            Alert.alert("Error", "No ID provided.");
            navigation.goBack();
            return;
        }
        loadData();
    }, [id]);

    const formatTime = (dateString: string) => {
        if (!dateString) return "Just now";
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return "Just now";
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const [menuVisible, setMenuVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editDescription, setEditDescription] = useState('');
    const [inlineComments, setInlineComments] = useState<any[]>([]);
    const [inlineCommentsLoading, setInlineCommentsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showIcon, setShowIcon] = useState<"play" | "pause" | null>(null);

    const togglePlay = useCallback(() => {
        if (isPlaying) {
            setIsPlaying(false);
            setShowIcon("pause");
            setTimeout(() => setShowIcon(null), 1000);
        } else {
            setIsPlaying(true);
            setShowIcon("play");
            setTimeout(() => setShowIcon(null), 1000);
        }
    }, [isPlaying]);

    // --- NEW MEDIA STATE ---
    const [newImages, setNewImages] = useState<any[]>([]); // for posts
    const [newVideo, setNewVideo] = useState<any>(null);  // for shorts

    const pickMedia = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: isShort ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: !isShort,
            quality: 0.7,
        });

        if (!result.canceled) {
            if (isShort) {
                setNewVideo(result.assets[0]);
            } else {
                setNewImages(result.assets);
            }
        }
    };

    const endpoints = useMemo(() => getEndpoints(isShort, id), [isShort, id]);

    const fetchInlineComments = useCallback(async () => {
        if (isShort || !endpoints.getComments) return;
        setInlineCommentsLoading(true);
        try {
            const res = await axios.get(endpoints.getComments);
            if (res.data.success) {
                setInlineComments(res.data.comments);
            }
        } catch (error) {
            console.log("Error loading inline comments", error);
        } finally {
            setInlineCommentsLoading(false);
        }
    }, [endpoints.getComments, isShort]);

    useEffect(() => {
        fetchInlineComments();
    }, [fetchInlineComments]);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(endpoints.get);

            if (res.data.success) {
                const fetchedData = isShort ? res.data.short : res.data.post;
                setData(fetchedData);
                
                if (!isShort) {
                    setScore(fetchedData.score || fetchedData.likes || 0);
                    setVote(
                        fetchedData.upvoted_by?.includes(currentUser?._id) ? 'up' : 
                        fetchedData.downvoted_by?.includes(currentUser?._id) ? 'down' : null
                    );
                } else {
                    setLikeCount(fetchedData.likes || 0);
                    setIsLiked(fetchedData.liked_by?.some((id: any) => String(id) === String(currentUser?._id)));
                }

                setCommentCount(fetchedData.comments?.length || 0);
                if (isShort && endpoints.view) axios.post(endpoints.view);
            }
        } catch (error: any) {
            console.error("Error loading data:", error);
            Alert.alert("Error", "Failed to load content.");
        } finally {
            setLoading(false);
        }
    }, [id, isShort, currentUser?._id, endpoints.get, endpoints.view]);

    const handleVote = useCallback(async (type: 'up' | 'down') => {
        const prevVote = vote;
        const prevScore = score;
        let newVote: 'up' | 'down' | null = type;
        let scoreDelta = 0;

        if (prevVote === type) {
            newVote = null;
            scoreDelta = type === 'up' ? -1 : 1;
        } else {
            if (prevVote === null) scoreDelta = type === 'up' ? 1 : -1;
            else scoreDelta = type === 'up' ? 2 : -2;
        }

        setVote(newVote);
        setScore(prevScore + scoreDelta);

        try {
            await axios.post(`/post/vote/${id}`, { type: newVote });
        } catch (error) {
            setVote(prevVote);
            setScore(prevScore);
        }
    }, [vote, score, id]);

    const handleLike = useCallback(async () => {
        const previousLiked = isLiked;
        const previousCount = likeCount;

        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);

        try {
            await axios.post(endpoints.like);
        } catch (error) {
            setIsLiked(previousLiked);
            setLikeCount(previousCount);
        }
    }, [isLiked, likeCount, endpoints.like]);

    const handleCommentAdded = useCallback(() => {
        setCommentCount(prev => prev + 1);
    }, []);

    const handleShare = async () => {
        try {
            const id = data._id;
            const idParam = isShort ? `shortId=${id}` : `postId=${id}`;
            const shareUrl = `https://fync-api.duckdns.org/view?${idParam}`;
            const playStoreUrl = "https://play.google.com/store/apps/details?id=com.fync.app";

            await Share.share({
                message: isShort 
                    ? `Check out this short "${data.title}" on Fync!\n\nWatch here: ${shareUrl}\n\nDon't have Fync? Download: ${playStoreUrl}`
                    : `Check out this post by ${data.user?.username} on Fync!\n\n${data.description || ''}\n\nView post: ${shareUrl}\n\nDon't have Fync? Download: ${playStoreUrl}`,
            });
        } catch (error: any) {
            console.log('Share error:', error.message);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-black justify-center items-center">
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    if (!data) return null;

    // --- RENDER SHORT (Same UI as your Shorts.tsx) ---    // --- FINAL RENDER ---
    return (
        <>
            {isShort ? (
                /* --- SHORTS VIEW --- */
                <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH, backgroundColor: 'black' }}>
                    <Pressable onPress={() => setMenuVisible(true)} className="absolute top-12 right-4 z-50 bg-black/20 p-2 rounded-full">
                        <Ionicons name="ellipsis-horizontal" size={24} color="white" />
                    </Pressable>

                    <Pressable style={{ flex: 1 }} onPress={togglePlay}>
                        <Video
                            ref={videoRef}
                            source={{ uri: getFullUrl(data.video) || '' }}
                            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: 'black' }}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={isFocused && isPlaying}
                            isLooping
                        />
                    </Pressable>

                    {showIcon && (
                        <View className="absolute inset-0 items-center justify-center pointer-events-none z-10" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}>
                            <Ionicons
                                name={showIcon === "play" ? "play" : "pause"}
                                size={72}
                                color="white"
                            />
                        </View>
                    )}

                    {/* VIGNETTE EFFECT */}
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        className="absolute bottom-0 left-0 right-0 h-64"
                        pointerEvents="none"
                    />

                    <View className="absolute bottom-12 left-4 right-4 flex-row justify-between items-end">
                        <View className="flex-1 pr-6">
                            <Pressable onPress={() => navigation.navigate("PublicProfile", { user: data.user })} className="flex-row items-center mb-3">
                                <Avatar user={data.user as any} size={40} />
                                <View className="ml-2">
                                    <Text className="text-white font-bold text-base shadow-md">{data.user?.name || data.user?.username}</Text>
                                    <Text className="text-slate-300 text-xs shadow-md">@{data.user?.username}</Text>
                                </View>
                            </Pressable>
                            {/* Truncated Title & Description */}
                            <View className="mb-1">
                                <Text className="text-white text-sm font-bold shadow-md">
                                    {(!showFullText && data.title.length > 50) 
                                        ? data.title.substring(0, 50) + "..." 
                                        : data.title}
                                </Text>
                                <Text className="text-slate-300 text-xs shadow-md mt-1">
                                    {(!showFullText && data.description.length > 50) 
                                        ? data.description.substring(0, 50) + "..." 
                                        : data.description}
                                </Text>

                                {(data.title.length > 50 || data.description.length > 50) && (
                                    <Pressable onPress={() => setShowFullText(!showFullText)} className="mt-1">
                                        <Text className="text-orange-400 font-bold text-2xs">
                                            {showFullText ? "SHOW LESS" : "SHOW MORE"}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                            <Text className="text-white/60 text-2xs mt-2 uppercase tracking-wide font-bold">{formatTime(data.createdAt)}</Text>
                        </View>

                        <View className="items-center gap-4">
                            <TouchableOpacity onPress={handleLike} className="items-center">
                                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={34} color={isLiked ? "red" : "white"} />
                                <Text className="text-white text-xs font-bold">{likeCount}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setCommentModalVisible(true)} className="items-center">
                                <Ionicons name="chatbubble-outline" size={32} color="white" />
                                <Text className="text-white text-xs font-bold">{commentCount}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="items-center">
                                <Ionicons name="eye-outline" size={32} color="white" />
                                <Text className="text-white text-xs font-bold">{data.views || 0}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleShare}>
                                <Ionicons name="paper-plane-outline" size={32} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            ) : (
                /* --- POST VIEW --- */
                <SafeAreaView className="bg-white flex-1">
                    <View className="flex-row items-center justify-between px-4 py-3">
                        <View className="flex-row items-center gap-3">
                            <Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="black" /></Pressable>
                            <Pressable onPress={() => navigation.navigate("PublicProfile", { user: data?.user })} className="flex-row items-center">
                                <Avatar user={data.user as any} size={36} />
                                <View className="ml-3">
                                    <Text className="text-black font-bold text-sm">{data.user?.username}</Text>
                                    {data.college && <Text className="text-slate-500 text-2xs uppercase tracking-wide">{data.college}</Text>}
                                </View>
                            </Pressable>
                        </View>
                        <Pressable onPress={() => {
                            const isOwner = data.user?._id === currentUser?._id;
                            if (isOwner) {
                                setMenuVisible(true);
                            } else {
                                Alert.alert("Post Options", undefined, [
                                    { text: "Cancel", style: "cancel" },
                                    { 
                                        text: "Report Post", 
                                        style: "destructive", 
                                        onPress: () => {
                                            Alert.alert("Report", "Are you sure you want to report this post?", [
                                                { text: "Cancel", style: "cancel" },
                                                { text: "Report", style: "destructive", onPress: async () => {
                                                    try {
                                                        await axios.post('/post/report', { postId: data._id, reason: "Inappropriate content" });
                                                        Alert.alert("Success", "Post has been reported to administrators.");
                                                    } catch (e) {
                                                        Alert.alert("Error", "Failed to report post.");
                                                    }
                                                }}
                                            ]);
                                        }
                                    }
                                ]);
                            }
                        }}><Ionicons name="ellipsis-horizontal" size={20} color="gray" /></Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="relative">
                            <FlatList
                                data={data.image || []}
                                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                                keyExtractor={(item, index) => `${item}-${index}`}
                                onScroll={(e) => setCurrentImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                                renderItem={({ item }) => (
                                    <Pressable onPress={() => setResizeMode(prev => !prev)}>
                                        <ExpoImage source={{ uri: getFullUrl(item) || '' }} style={{ width: width, height: width }} contentFit={resizeMode ? "contain" : "cover"} cachePolicy="disk" transition={300} />
                                    </Pressable>
                                )}
                            />
                            {data.image?.length > 1 && (
                                <View className="absolute top-3 right-3 bg-black/50 px-2 py-1 rounded-lg">
                                    <Text className="text-white text-2xs font-bold">
                                        {currentImageIndex + 1}/{data.image.length}
                                    </Text>
                                </View>
                            )}
                            {data.image?.length > 1 && (
                                <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
                                    {data.image.map((_: any, i: number) => (
                                        <View key={i} className={`h-1.5 w-1.5 rounded-full ${i === currentImageIndex ? 'bg-white shadow-sm' : 'bg-white/40'}`} />
                                    ))}
                                </View>
                            )}
                        </View>

                        <View className="px-3 pt-3 flex-row items-center gap-3">
                            <View className="flex-row items-center bg-slate-50 rounded-full px-1 py-0.5">
                                <Pressable onPress={() => handleVote('up')} className="p-1.5">
                                    <Ionicons name={vote === 'up' ? "arrow-up" : "arrow-up-outline"} size={22} color={vote === 'up' ? "#f97316" : "#536471"} />
                                </Pressable>
                                <Text className={`font-semibold text-sm px-1 min-w-[20px] text-center ${vote === 'up' ? 'text-[#f97316]' : vote === 'down' ? 'text-[#7193FF]' : 'text-[#536471]'}`}>
                                    {score === 0 ? 'Vote' : score}
                                </Text>
                                <Pressable onPress={() => handleVote('down')} className="p-1.5">
                                    <Ionicons name={vote === 'down' ? "arrow-down" : "arrow-down-outline"} size={22} color={vote === 'down' ? "#7193FF" : "#536471"} />
                                </Pressable>
                            </View>
                            <TouchableOpacity onPress={() => setCommentModalVisible(true)} className="flex-row items-center bg-slate-50 rounded-full px-3 py-2">
                                <Ionicons name="chatbubble-outline" size={20} color="#536471" />
                                <Text className="text-[#536471] font-semibold text-xs ml-1.5">{commentCount}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleShare} className="flex-row items-center bg-slate-50 rounded-full px-3 py-2">
                                <Ionicons name="paper-plane-outline" size={20} color="#536471" />
                                <Text className="text-[#536471] font-semibold text-xs ml-1.5">Share</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="px-3 pt-2 pb-10">
                            <Text className="text-black text-sm leading-5 mt-2">
                                <Text className="text-slate-500 font-bold">{data.user?.username} </Text>{data.description}
                            </Text>
                            <Text className="text-slate-500 text-2xs mt-1 uppercase tracking-wide font-bold mb-4">{formatTime(data.createdAt)}</Text>
                            
                            {/* INLINE COMMENTS FOR POSTS */}
                            <View className="border-t border-slate-100 pt-4 mt-2">
                                <Text className="text-black font-semibold text-sm mb-4">Comments ({commentCount})</Text>
                                {inlineCommentsLoading ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : inlineComments.length > 0 ? (
                                    inlineComments.map(comment => (
                                        <View key={comment._id} pointerEvents="box-none">
                                            <CommentItem 
                                                comment={comment}
                                                currentUser={currentUser}
                                                onReply={() => setCommentModalVisible(true)}
                                                onDelete={() => setCommentModalVisible(true)}
                                                onEdit={() => setCommentModalVisible(true)}
                                                editingId={null}
                                            />
                                        </View>
                                    ))
                                ) : (
                                    <Text className="text-slate-500 text-sm">No comments yet. Be the first!</Text>
                                )}
                                
                                <Pressable onPress={() => setCommentModalVisible(true)} className="mt-4 bg-slate-50 py-3 rounded-xl items-center border border-slate-100">
                                    <Text className="text-slate-600 font-semibold text-sm">Add a comment...</Text>
                                </Pressable>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            )}

            {/* --- MODALS --- */}
            <Modal visible={menuVisible} transparent animationType="slide">
                <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setMenuVisible(false)}>
                    <View className="px-4 pb-10" onStartShouldSetResponder={() => true}>
                        <View className="bg-white rounded-3xl overflow-hidden mb-3">
                            {currentUser?._id === data.user?._id ? (
                                <>
                                    <Pressable 
                                        onPress={() => { setMenuVisible(false); setEditDescription(isShort ? data.title : data.description || ''); setIsEditing(true); }}
                                        className="py-4 items-center border-b border-slate-200 bg-white active:bg-slate-100 flex-row justify-center gap-3"
                                    >
                                        <Ionicons name="create-outline" size={22} color="black" />
                                        <Text className="text-black font-semibold text-lg">Edit {isShort ? 'Short' : 'Post'}</Text>
                                    </Pressable>
                                    {!isShort && (
                                        <Pressable 
                                            onPress={async () => {
                                                setMenuVisible(false);
                                                try {
                                                    const newStatus = !data?.isPrivate;
                                                    const formData = new FormData();
                                                    formData.append('isPrivate', newStatus ? 'true' : 'false');
                                                    const res = await axios.post(`/post/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                    if (res.data.success) {
                                                        setData({ ...data, isPrivate: newStatus });
                                                        Alert.alert("Success", `Post is now ${newStatus ? 'Private' : 'Public'}`);
                                                    }
                                                } catch (err) { Alert.alert("Error", "Failed to update visibility."); }
                                            }}
                                            className="py-4 items-center border-b border-slate-200 bg-white active:bg-slate-100 flex-row justify-center gap-3"
                                        >
                                            <Ionicons name={data?.isPrivate ? "lock-open-outline" : "lock-closed-outline"} size={22} color="black" />
                                            <Text className="text-black font-semibold text-lg">Make it {data?.isPrivate ? 'Public' : 'Private'}</Text>
                                        </Pressable>
                                    )}
                                    <Pressable 
                                        onPress={async () => {
                                            setMenuVisible(false);
                                            Alert.alert(`Delete ${isShort ? 'Short' : 'Post'}`, "Are you sure? This cannot be undone.", [
                                                { text: "Cancel", style: "cancel" },
                                                { text: "Delete", style: "destructive", onPress: async () => {
                                                    navigation.goBack();
                                                    Toast.show({ type: 'info', text1: `Deleting ${isShort ? 'Short' : 'Post'}...` });
                                                    try {
                                                        const res = await axios.delete(isShort ? `/shorts/${id}` : `/post/${id}`);
                                                        if (res.data.success) {
                                                            Toast.show({ type: 'success', text1: `${isShort ? 'Short' : 'Post'} deleted` });
                                                        } else {
                                                            Toast.show({ type: 'error', text1: 'Delete failed' });
                                                        }
                                                    } catch (err) { 
                                                        console.error("Delete failed", err);
                                                        Toast.show({ type: 'error', text1: 'Delete failed' });
                                                    }
                                                }}
                                            ]);
                                        }}
                                        className="py-4 items-center bg-white active:bg-slate-100 flex-row justify-center gap-3"
                                    >
                                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                                        <Text className="text-red-500 font-semibold text-lg">Delete {isShort ? 'Short' : 'Post'}</Text>
                                    </Pressable>
                                </>
                            ) : (
                                <Pressable 
                                    onPress={() => { setMenuVisible(false); Toast.show({ type: 'success', text1: 'Content Reported' }); }}
                                    className="py-4 items-center bg-white active:bg-slate-100 flex-row justify-center gap-3"
                                >
                                    <Ionicons name="flag-outline" size={22} color="#EF4444" />
                                    <Text className="text-red-500 font-semibold text-lg">Report Content</Text>
                                </Pressable>
                            )}
                        </View>
                        <Pressable 
                            onPress={() => setMenuVisible(false)} 
                            className="py-4 bg-white rounded-3xl items-center active:bg-slate-100 shadow-sm"
                        >
                            <Text className="text-blue-500 font-bold text-lg">Cancel</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            <Modal visible={isEditing} transparent animationType="slide">
                <KeyboardAvoidingView behavior="padding" className="flex-1 bg-black/60">
                    <View className="flex-1" />
                    <View className="bg-white rounded-t-5xl p-6 shadow-2xl">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-black text-xl font-bold">Edit Content</Text>
                                <Pressable onPress={() => { setIsEditing(false); setNewVideo(null); setNewImages([]); }}>
                                    <Ionicons name="close" size={28} color="black" />
                                </Pressable>
                            </View>

                            {/* Media Preview / Picker */}
                            <Pressable 
                                onPress={pickMedia}
                                className="mb-4 aspect-video w-full bg-slate-100 rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 justify-center items-center"
                            >
                                {isShort ? (
                                    newVideo ? (
                                        <Video source={{ uri: newVideo.uri }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.COVER} isMuted />
                                    ) : (
                                        <View className="items-center">
                                            <Ionicons name="videocam-outline" size={40} color="#6B7280" />
                                            <Text className="text-slate-500 font-semibold mt-2">Change Video</Text>
                                        </View>
                                    )
                                ) : (
                                    newImages.length > 0 ? (
                                        <ScrollView horizontal className="w-full">
                                            {newImages.map((img, i) => (
                                                <RNImage key={i} source={{ uri: img.uri }} className="w-40 h-40 rounded-xl m-2" />
                                            ))}
                                        </ScrollView>
                                    ) : (
                                        <View className="items-center">
                                            <Ionicons name="images-outline" size={40} color="#6B7280" />
                                            <Text className="text-slate-500 font-semibold mt-2">Replace Photos</Text>
                                        </View>
                                    )
                                )}
                            </Pressable>

                            <TextInput multiline value={editDescription} onChangeText={setEditDescription} placeholder="Write something..." placeholderTextColor="#9CA3AF" className="bg-slate-100 rounded-2xl p-4 text-black text-base min-h-[120px]" autoFocus />
                            <Pressable 
                                onPress={async () => {
                                    setIsUpdating(true);
                                    try {
                                        const formData = new FormData();
                                        if (isShort) {
                                            formData.append('title', editDescription);
                                            if (newVideo) {
                                                const uri = Platform.OS === 'ios' ? newVideo.uri.replace('file://', '') : newVideo.uri;
                                                const name = uri.split('/').pop();
                                                const type = `video/${name?.split('.').pop()}`;
                                                formData.append('video', { uri, name, type } as any);
                                            }
                                        } else {
                                            formData.append('description', editDescription);
                                            newImages.forEach((img, i) => {
                                                const uri = Platform.OS === 'ios' ? img.uri.replace('file://', '') : img.uri;
                                                const name = uri.split('/').pop() || `image_${i}.jpg`;
                                                const type = `image/${name.split('.').pop()}`;
                                                formData.append('image', { uri, name, type } as any);
                                            });
                                        }

                                        const res = await axios.post(
                                            isShort ? `/shorts/update/${id}` : `/post/${id}`, 
                                            formData,
                                            { headers: { 'Content-Type': 'multipart/form-data' } }
                                        );

                                        if (res.data.success) {
                                            const updated = isShort ? res.data.short : res.data.post;
                                            setData(updated);
                                            setIsEditing(false);
                                            setNewVideo(null);
                                            setNewImages([]);
                                            if (!isShort && updated.image) setCurrentImageIndex(0);
                                        }
                                    } catch (err) { Alert.alert("Error", "Update failed."); } finally { setIsUpdating(false); }
                                }}
                                disabled={isUpdating}
                                className="bg-black py-4 rounded-2xl mt-6 items-center shadow-lg"
                            >
                                {isUpdating ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save Changes</Text>}
                            </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <UnifiedCommentsModal
                isVisible={isCommentModalVisible}
                id={id}
                isShort={isShort}
                currentUser={currentUser}
                onClose={() => setCommentModalVisible(false)}
                onCommentAdded={handleCommentAdded}
            />
        </>
    );
};

export default IndividualPostOrShort;
