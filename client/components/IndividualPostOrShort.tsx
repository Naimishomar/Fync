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
                className={`${isReply ? 'h-7 w-7' : 'h-9 w-9'} rounded-full mr-3 bg-paper-2`} 
                cachePolicy="disk"
            />
            <View className="flex-1">
                <View className="flex flex-row items-center gap-1">
                    <Text className="text-ink font-semibold text-xs">{comment.commentor?.name}</Text>
                    <Text className="text-ink-3 text-label">@{comment.commentor?.username}</Text>
                </View>

                {editingId === comment._id ? (
                    <TextInput
                        value={editingText}
                        onChangeText={setEditingText}
                        className="text-ink border-b border-[1.5px] border-ink pb-1 mt-1 text-xs"
                        autoFocus
                    />
                ) : (
                    <Text className="text-ink mt-0.5 text-xs leading-5">
                        {comment.replyToUser && <Text className="text-accent-text">@{comment.replyToUser.username} </Text>}
                        {comment.text}
                    </Text>
                )}

                {/* Actions */}
                <View className="flex-row mt-2 gap-4">
                    {!isReply && (
                        <Pressable onPress={() => onReply(comment)}>
                            <Text className="text-ink-3 text-label font-semibold uppercase">Reply</Text>
                        </Pressable>
                    )}
                    
                    {comment.commentor?._id === currentUser?._id && (
                        <>
                            {editingId === comment._id ? (
                                <Pressable onPress={() => handleUpdate(comment._id)}>
                                    {actionLoadingId === comment._id ? <ActivityIndicator size="small" color="#12100E" /> : <Text className="text-fam-career text-label font-semibold uppercase">Save</Text>}
                                </Pressable>
                            ) : (
                                <Pressable onPress={() => onEdit(comment)}>
                                    <Text className="text-ink-3 text-label font-semibold uppercase">Edit</Text>
                                </Pressable>
                            )}
                            <Pressable onPress={() => onDelete(comment._id)}>
                                {actionLoadingId === comment._id ? <ActivityIndicator size="small" color="red" /> : <Text className="text-danger/80 text-label font-semibold uppercase">Delete</Text>}
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
            {/* behavior must be set on Android too. It was undefined, which
                means no avoidance at all — and inside a Modal the manifest's
                adjustResize does not reach here either. */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-end"
                style={{ backgroundColor: 'rgba(18,16,14,0.6)' }}
            >
                <Pressable className="flex-1" onPress={onClose} />

                {/* A column that can shrink, not a fixed 75% box. The composer
                    below is a normal sibling rather than absolutely positioned:
                    pinned to the bottom of a fixed-height container it could
                    never rise, whatever the keyboard did. */}
                <View
                    className="bg-paper rounded-t-sheet pt-4 border-t-2 border-x-2 border-ink"
                    style={{ maxHeight: '85%', flexShrink: 1 }}
                >
                    <View className="items-center mb-3">
                        <View className="h-1 w-10 bg-ink-3 rounded-full mb-3" />
                    </View>

                    {/* Title left-aligned under a section rule, matching the rest
                        of the app rather than the centred sheet this used to be. */}
                    <View className="px-5 mb-3">
                        <Text className="font-display text-xl text-ink">Comments</Text>
                        <View className="h-[2px] bg-ink mt-1" style={{ width: 44 }} />
                    </View>

                    {/* List */}
                    {loading ? (
                        <View className="flex-1 items-center justify-center" style={{ minHeight: 220 }}>
                            <ActivityIndicator size="large" color="#F97316" />
                        </View>
                    ) : (
                        <FlatList
                            data={comments}
                            keyExtractor={(item) => item._id}
                            showsVerticalScrollIndicator={false}
                            className="flex-1"
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 16 }}
                            initialNumToRender={10}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            removeClippedSubviews={Platform.OS === 'android'}
                            ListEmptyComponent={
                                <View className="items-center mt-16 px-10">
                                    <Ionicons name="chatbubble-ellipses-outline" size={44} color="#C4BEB6" />
                                    <Text className="font-display text-base text-ink mt-3">No comments yet</Text>
                                    <Text className="font-sans text-ink-3 mt-1 text-center" style={{ fontSize: 12 }}>
                                        Say the first thing.
                                    </Text>
                                </View>
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
                    <View className="border-t-2 border-ink bg-white px-3 pt-2 pb-3">
                        {replyingTo && (
                            <View className="flex-row items-center justify-between bg-paper px-3 py-2 mb-2 rounded-xl mx-2 border-2 border-ink">
                                <Text className="text-ink-3 text-xs">Replying to <Text className="font-semibold text-ink">@{replyingTo.commentor?.username}</Text></Text>
                                <Pressable onPress={() => setReplyingTo(null)}>
                                    <Ionicons name="close-circle" size={18} color="#C4BEB6" />
                                </Pressable>
                            </View>
                        )}
                        <View className="flex-row items-center px-2">
                            <TextInput
                                ref={commentInputRef}
                                value={newComment}
                                onChangeText={setNewComment}
                                placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
                                placeholderTextColor="#C4BEB6"
                                className="flex-1 text-ink bg-paper border-2 border-ink rounded-xl px-4 mr-2"
                                style={{ minHeight: 46, maxHeight: 110, paddingTop: 12, paddingBottom: 12 }}
                                multiline
                            />
                            {/* 44x44 minimum, and a filled button rather than bare
                                text — the old one was a ~20px tap target. */}
                            <TouchableOpacity
                                onPress={handlePostComment}
                                disabled={posting || !newComment.trim()}
                                className={`items-center justify-center rounded-xl border-2 border-ink ${!newComment.trim() ? 'bg-paper' : 'bg-brand-500'}`}
                                style={{ width: 52, height: 46, opacity: posting ? 0.6 : 1 }}
                                accessibilityRole="button"
                                accessibilityLabel={replyingTo ? 'Post reply' : 'Post comment'}
                            >
                                {posting
                                    ? <ActivityIndicator size="small" color="#12100E" />
                                    : <Ionicons name="arrow-up" size={20} color={!newComment.trim() ? '#8B857E' : '#12100E'} />}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// --- 2. MAIN COMPONENT ---
/**
 * One row in the options sheet.
 *
 * A hint under each label because "Make private" alone does not say what
 * happens — the destructive and irreversible actions sit next to each other
 * here, and the difference should not depend on the reader guessing.
 */
const SheetAction = ({
  icon, label, hint, onPress, destructive = false,
}: {
  icon: any; label: string; hint?: string; onPress: () => void; destructive?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-row items-center bg-white border-2 border-ink rounded-card px-4 py-3 mb-3"
    style={{ minHeight: 60 }}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
  >
    <View
      className="items-center justify-center rounded-xl border-2 border-ink"
      style={{ width: 40, height: 40, backgroundColor: destructive ? '#FEE2E2' : '#FFEDD5' }}
    >
      <Ionicons name={icon} size={20} color={destructive ? '#DC2626' : '#EA580C'} />
    </View>
    <View className="ml-3 flex-1">
      <Text className={`font-display ${destructive ? 'text-danger' : 'text-ink'}`} style={{ fontSize: 15 }}>
        {label}
      </Text>
      {!!hint && (
        <Text className="font-sans text-ink-3 mt-[2px]" style={{ fontSize: 11 }}>{hint}</Text>
      )}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#8B857E" />
  </TouchableOpacity>
);

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
            <View className="flex-1 bg-night justify-center items-center">
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
                                    <Text className="text-white font-semibold text-base shadow-hair">{data.user?.name || data.user?.username}</Text>
                                    <Text className="text-ink-4 text-xs shadow-hair">@{data.user?.username}</Text>
                                </View>
                            </Pressable>
                            {/* Truncated Title & Description */}
                            <View className="mb-1">
                                <Text className="text-white text-sm font-semibold shadow-hair">
                                    {(!showFullText && data.title.length > 50) 
                                        ? data.title.substring(0, 50) + "..." 
                                        : data.title}
                                </Text>
                                <Text className="text-ink-4 text-xs shadow-hair mt-1">
                                    {(!showFullText && data.description.length > 50) 
                                        ? data.description.substring(0, 50) + "..." 
                                        : data.description}
                                </Text>

                                {(data.title.length > 50 || data.description.length > 50) && (
                                    <Pressable onPress={() => setShowFullText(!showFullText)} className="mt-1">
                                        <Text className="text-accent-text font-semibold text-label">
                                            {showFullText ? "SHOW LESS" : "SHOW MORE"}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                            <Text className="text-white/60 text-label mt-2 uppercase font-semibold">{formatTime(data.createdAt)}</Text>
                        </View>

                        <View className="items-center gap-4">
                            <TouchableOpacity onPress={handleLike} className="items-center">
                                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={34} color={isLiked ? "red" : "white"} />
                                <Text className="text-white text-xs font-semibold">{likeCount}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setCommentModalVisible(true)} className="items-center">
                                <Ionicons name="chatbubble-outline" size={32} color="white" />
                                <Text className="text-white text-xs font-semibold">{commentCount}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="items-center">
                                <Ionicons name="eye-outline" size={32} color="white" />
                                <Text className="text-white text-xs font-semibold">{data.views || 0}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleShare}>
                                <Ionicons name="paper-plane-outline" size={32} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            ) : (
                /* --- POST VIEW --- */
                <SafeAreaView className="bg-paper flex-1">
                    <View className="flex-row items-center justify-between px-4 py-3">
                        <View className="flex-row items-center gap-3">
                            <Pressable onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}><Ionicons name="arrow-back" size={24} color="black" /></Pressable>
                            <Pressable onPress={() => navigation.navigate("PublicProfile", { user: data?.user })} className="flex-row items-center">
                                <Avatar user={data.user as any} size={36} />
                                <View className="ml-3">
                                    <Text className="text-ink font-semibold text-sm">{data.user?.username}</Text>
                                    {data.college && <Text className="text-ink-3 text-label uppercase">{data.college}</Text>}
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
                                    <Text className="text-white text-label font-semibold">
                                        {currentImageIndex + 1}/{data.image.length}
                                    </Text>
                                </View>
                            )}
                            {data.image?.length > 1 && (
                                <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
                                    {data.image.map((_: any, i: number) => (
                                        <View key={i} className={`h-1.5 w-1.5 rounded-full ${i === currentImageIndex ? 'bg-card shadow-hair' : 'bg-card/40'}`} />
                                    ))}
                                </View>
                            )}
                        </View>

                        <View className="px-3 pt-3 flex-row items-center gap-3">
                            <View className="flex-row items-center bg-paper-2 rounded-full px-1 py-0.5">
                                <Pressable onPress={() => handleVote('up')} className="p-1.5">
                                    <Ionicons name={vote === 'up' ? "arrow-up" : "arrow-up-outline"} size={22} color={vote === 'up' ? "#F97316" : "#57534E"} />
                                </Pressable>
                                <Text className={`font-semibold text-sm px-1 min-w-[20px] text-center ${vote === 'up' ? 'text-brand-500' : vote === 'down' ? 'text-fam-career' : 'text-ink-3'}`}>
                                    {score === 0 ? 'Vote' : score}
                                </Text>
                                <Pressable onPress={() => handleVote('down')} className="p-1.5">
                                    <Ionicons name={vote === 'down' ? "arrow-down" : "arrow-down-outline"} size={22} color={vote === 'down' ? "#7193FF" : "#57534E"} />
                                </Pressable>
                            </View>
                            <TouchableOpacity onPress={() => setCommentModalVisible(true)} className="flex-row items-center bg-paper-2 rounded-full px-3 py-2">
                                <Ionicons name="chatbubble-outline" size={20} color="#57534E" />
                                <Text className="text-ink-3 font-semibold text-xs ml-1.5">{commentCount}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleShare} className="flex-row items-center bg-paper-2 rounded-full px-3 py-2">
                                <Ionicons name="paper-plane-outline" size={20} color="#57534E" />
                                <Text className="text-ink-3 font-semibold text-xs ml-1.5">Share</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="px-3 pt-2 pb-10">
                            <Text className="text-ink text-sm leading-5 mt-2">
                                <Text className="text-ink-3 font-semibold">{data.user?.username} </Text>{data.description}
                            </Text>
                            <Text className="text-ink-3 text-label mt-1 uppercase font-semibold mb-4">{formatTime(data.createdAt)}</Text>
                            
                            {/* INLINE COMMENTS FOR POSTS */}
                            <View className="border-t-2 border-ink pt-4 mt-2">
                                <Text className="text-ink font-semibold text-sm mb-4">Comments ({commentCount})</Text>
                                {inlineCommentsLoading ? (
                                    <ActivityIndicator size="small" color="#12100E" />
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
                                    <Text className="text-ink-3 text-sm">No comments yet. Be the first!</Text>
                                )}
                                
                                <Pressable onPress={() => setCommentModalVisible(true)} className="mt-4 bg-white py-3 rounded-xl items-center border-2 border-ink" style={{ minHeight: 46 }}>
                                    <Text className="text-ink-2 font-semibold text-sm">Add a comment...</Text>
                                </Pressable>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            )}

            {/* --- MODALS --- */}
            <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(18,16,14,0.45)' }}>
                    <Pressable className="flex-1" onPress={() => setMenuVisible(false)} />

                    <View className="bg-paper rounded-t-sheet border-t-2 border-x-2 border-ink px-5 pt-4 pb-8">
                        <View className="items-center mb-4">
                            <View className="h-1 w-10 bg-ink-3 rounded-full" />
                        </View>

                        <Text className="font-display text-xl text-ink mb-1">
                            {isShort ? 'Short' : 'Post'} options
                        </Text>
                        <View className="h-[2px] bg-ink mb-4" style={{ width: 44 }} />

                        {currentUser?._id === data.user?._id ? (
                            <>
                                <SheetAction
                                    icon="create-outline"
                                    label={`Edit ${isShort ? 'short' : 'post'}`}
                                    hint="Change the caption or replace the media"
                                    onPress={() => {
                                        setMenuVisible(false);
                                        setEditDescription(isShort ? data.title : data.description || '');
                                        setIsEditing(true);
                                    }}
                                />

                                {!isShort && (
                                    <SheetAction
                                        icon={data?.isPrivate ? 'earth-outline' : 'lock-closed-outline'}
                                        label={data?.isPrivate ? 'Make public' : 'Make private'}
                                        hint={data?.isPrivate
                                            ? 'Show this in feeds again'
                                            : 'Hide from feeds — only you can see it'}
                                        onPress={async () => {
                                            setMenuVisible(false);
                                            const next = !data?.isPrivate;
                                            // Flip first so the sheet does not sit there looking
                                            // unresponsive while the request is in flight.
                                            setData({ ...data, isPrivate: next });
                                            try {
                                                const form = new FormData();
                                                form.append('isPrivate', next ? 'true' : 'false');
                                                const res = await axios.post(`/post/${id}`, form, {
                                                    headers: { 'Content-Type': 'multipart/form-data' },
                                                });
                                                if (!res.data.success) throw new Error('rejected');
                                                Toast.show({
                                                    type: 'success',
                                                    text1: next ? 'Post is now private' : 'Post is public again',
                                                });
                                            } catch {
                                                setData({ ...data, isPrivate: !next });
                                                Toast.show({ type: 'error', text1: 'Could not change visibility' });
                                            }
                                        }}
                                    />
                                )}

                                <SheetAction
                                    icon="trash-outline"
                                    label={`Delete ${isShort ? 'short' : 'post'}`}
                                    hint="This cannot be undone"
                                    destructive
                                    onPress={() => {
                                        setMenuVisible(false);
                                        Alert.alert(
                                            `Delete ${isShort ? 'short' : 'post'}`,
                                            'This cannot be undone.',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Delete',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        navigation.goBack();
                                                        Toast.show({ type: 'info', text1: 'Deleting...' });
                                                        try {
                                                            const res = await axios.delete(isShort ? `/shorts/${id}` : `/post/${id}`);
                                                            Toast.show(res.data.success
                                                                ? { type: 'success', text1: `${isShort ? 'Short' : 'Post'} deleted` }
                                                                : { type: 'error', text1: 'Delete failed' });
                                                        } catch {
                                                            Toast.show({ type: 'error', text1: 'Delete failed' });
                                                        }
                                                    },
                                                },
                                            ],
                                        );
                                    }}
                                />
                            </>
                        ) : (
                            <SheetAction
                                icon="flag-outline"
                                label="Report content"
                                hint="Tell us this breaks the rules"
                                destructive
                                onPress={() => {
                                    setMenuVisible(false);
                                    Toast.show({ type: 'success', text1: 'Reported. We will take a look.' });
                                }}
                            />
                        )}

                        <TouchableOpacity
                            onPress={() => setMenuVisible(false)}
                            className="mt-3 bg-white border-2 border-ink rounded-xl items-center justify-center"
                            style={{ height: 52 }}
                            accessibilityRole="button"
                            accessibilityLabel="Close options"
                        >
                            <Text className="font-display text-ink">CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={isEditing} transparent animationType="slide">
                <KeyboardAvoidingView behavior="padding" className="flex-1" style={{ backgroundColor: 'rgba(18,16,14,0.45)' }}>
                    <View className="flex-1" />
                    <View className="bg-paper rounded-t-sheet border-t-2 border-x-2 border-ink px-5 pt-4 pb-6">
                            <View className="items-center mb-3">
                                <View className="h-1 w-10 bg-ink-3 rounded-full" />
                            </View>
                            <View className="flex-row justify-between items-center mb-5">
                                <View>
                                    <Text className="font-display text-xl text-ink">Edit {isShort ? 'short' : 'post'}</Text>
                                    <View className="h-[2px] bg-ink mt-1" style={{ width: 44 }} />
                                </View>
                                <TouchableOpacity
                                    onPress={() => { setIsEditing(false); setNewVideo(null); setNewImages([]); }}
                                    className="w-11 h-11 items-center justify-center rounded-xl"
                                    style={{ marginRight: -11 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Close editor"
                                >
                                    <Ionicons name="close" size={26} color="#12100E" />
                                </TouchableOpacity>
                            </View>

                            {/* Media Preview / Picker */}
                            <Pressable 
                                onPress={pickMedia}
                                className="mb-4 aspect-video w-full bg-white overflow-hidden border-2 border-dashed border-ink justify-center items-center rounded-card"
                            >
                                {isShort ? (
                                    newVideo ? (
                                        <Video source={{ uri: newVideo.uri }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.COVER} isMuted />
                                    ) : (
                                        <View className="items-center">
                                            <Ionicons name="videocam-outline" size={40} color="#8B857E" />
                                            <Text className="text-ink-3 font-semibold mt-2">Change Video</Text>
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
                                            <Ionicons name="images-outline" size={40} color="#8B857E" />
                                            <Text className="text-ink-3 font-semibold mt-2">Replace Photos</Text>
                                        </View>
                                    )
                                )}
                            </Pressable>

                            <TextInput multiline value={editDescription} onChangeText={setEditDescription} placeholder="Write something..." placeholderTextColor="#C4BEB6" className="bg-paper-2 rounded-card p-4 text-ink text-base min-h-[120px]" autoFocus />
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
                                className="bg-brand-500 border-2 border-ink py-4 rounded-card mt-6 items-center"
                            >
                                {isUpdating ? <ActivityIndicator color="#12100E" /> : <Text className="text-ink font-display text-lg">Save changes</Text>}
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
