import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
    View, Text, ActivityIndicator, Image, TouchableOpacity,
    Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, Alert,
    Pressable, Dimensions, ScrollView, Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import axios from "../context/axiosConfig";
import { useAuth } from '../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { memo } from 'react';
import Avatar from './Avatar';

const { width, height } = Dimensions.get('window');

// --- HELPER TO GET ENDPOINTS DYNAMICALLY ---
const getEndpoints = (isShort: boolean, id: string) => ({
    get: isShort ? `/shorts/individual/${id}` : `/post/individual/${id}`,
    like: isShort ? `/shorts/like/${id}` : `/post/like/${id}`,
    view: isShort ? `/shorts/views/${id}` : null,
    getComments: isShort ? `/shorts/comment/all/${id}` : `/post/comment/${id}`,
    addComment: isShort ? `/shorts/comment/add/${id}` : `/post/comment/${id}`,
    updateComment: isShort ? `/shorts/comment/update` : `/post/comment/update`,
    deleteComment: isShort ? `/shorts/comment/delete` : `/post/comment`,
});

// --- 0. COMMENT ITEM SUB-COMPONENT (Recursive) ---
const CommentItem = ({ 
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
            <Image source={{ uri: comment.commentor?.avatar || 'https://ui-avatars.com/api/?name=User' }} className={`${isReply ? 'h-7 w-7' : 'h-9 w-9'} rounded-full mr-3 bg-gray-700`} />
            <View className="flex-1">
                <View className="flex flex-row items-center gap-1">
                    <Text className="text-white font-semibold text-[13px]">{comment.commentor?.name}</Text>
                    <Text className="text-gray-400 text-[11px]">@{comment.commentor?.username}</Text>
                </View>

                {editingId === comment._id ? (
                    <TextInput
                        value={editingText}
                        onChangeText={setEditingText}
                        className="text-white border-b border-gray-600 pb-1 mt-1 text-[13px]"
                        autoFocus
                    />
                ) : (
                    <Text className="text-gray-300 mt-0.5 text-[13px] leading-5">
                        {comment.replyToUser && <Text className="text-pink-400">@{comment.replyToUser.username} </Text>}
                        {comment.text}
                    </Text>
                )}

                {/* Actions */}
                <View className="flex-row mt-2 gap-4">
                    {!isReply && (
                        <Pressable onPress={() => onReply(comment)}>
                            <Text className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">Reply</Text>
                        </Pressable>
                    )}
                    
                    {comment.commentor?._id === currentUser?._id && (
                        <>
                            {editingId === comment._id ? (
                                <Pressable onPress={() => handleUpdate(comment._id)}>
                                    {actionLoadingId === comment._id ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-blue-400 text-[11px] font-bold uppercase tracking-wider">Save</Text>}
                                </Pressable>
                            ) : (
                                <Pressable onPress={() => onEdit(comment)}>
                                    <Text className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">Edit</Text>
                                </Pressable>
                            )}
                            <Pressable onPress={() => onDelete(comment._id)}>
                                {actionLoadingId === comment._id ? <ActivityIndicator size="small" color="red" /> : <Text className="text-red-400/80 text-[11px] font-bold uppercase tracking-wider">Delete</Text>}
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
);

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
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                className="flex-1 justify-end bg-black/60"
            >
                <Pressable className="flex-1" onPress={onClose} />

                <View className="bg-neutral-900 rounded-t-2xl h-[75%] pt-4 border-t border-gray-800">
                    {/* Header */}
                    <View className="items-center mb-3">
                        <View className="h-1 w-10 bg-gray-600 rounded-full mb-2" />
                        <Text className="text-white font-semibold text-base">Comments</Text>
                    </View>

                    {/* List */}
                    {loading ? (
                        <ActivityIndicator size="large" color="#ec4899" className="mt-10" />
                    ) : (
                        <FlatList
                            data={comments}
                            keyExtractor={(item) => item._id}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
                            ListEmptyComponent={
                                <Text className="text-gray-400 text-center mt-10">No comments yet</Text>
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
                    <View className="absolute bottom-0 left-0 right-0 border-t border-gray-800 bg-neutral-900 px-3 pt-2 pb-8">
                        {replyingTo && (
                            <View className="flex-row items-center justify-between bg-neutral-800 px-3 py-2 mb-2 rounded-lg mx-2">
                                <Text className="text-gray-400 text-xs text-white">Replying to <Text className="font-bold">@{replyingTo.commentor?.username}</Text></Text>
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
                                placeholderTextColor="#888"
                                className="flex-1 text-white bg-neutral-800 rounded-full px-4 py-3 mr-2"
                                multiline
                            />
                            <Pressable onPress={handlePostComment} disabled={posting || !newComment.trim()}>
                                {posting ? <ActivityIndicator size="small" color="#ec4899" /> : <Text className={`font-semibold px-2 ${!newComment.trim() ? 'text-gray-600' : 'text-pink-400'}`}>Post</Text>}
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

    const { user: currentUser } = useAuth();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [commentCount, setCommentCount] = useState(0);
    const [isCommentModalVisible, setCommentModalVisible] = useState(false);

    // UI State
    const [resizeMode, setResizeMode] = useState(false);
    const videoRef = useRef<Video>(null);

    useEffect(() => {
        if (!id) {
            Alert.alert("Error", "No ID provided.");
            navigation.goBack();
            return;
        }
        loadData();
    }, [id]);

    const endpoints = useMemo(() => getEndpoints(isShort, id), [isShort, id]);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(endpoints.get);

            if (res.data.success) {
                const fetchedData = isShort ? res.data.short : res.data.post;
                setData(fetchedData);
                setLikeCount(fetchedData.likes || 0);
                const isUserLiked = fetchedData.liked_by?.some((id: any) => String(id) === String(currentUser?._id));
                setIsLiked(isUserLiked);
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
            const shareUrl = `https://fync.app/view?${idParam}`;
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

    // --- RENDER SHORT (Same UI as your Shorts.tsx) ---
    if (isShort) {
        return (
            <View style={{ flex: 1, backgroundColor: 'black' }}>
                {/* Back Button Overlay */}
                <Pressable
                    onPress={() => navigation.goBack()}
                    className="absolute top-12 left-4 z-50 bg-black/20 p-2 rounded-full"
                >
                    <Ionicons name="arrow-back" size={28} color="white" />
                </Pressable>

                {/* Video */}
                <Pressable onPress={() => {
                    // Optional: Toggle Play/Pause on Tap
                    // videoRef.current?.pauseAsync(); 
                }} style={{ flex: 1 }}>
                    <Video
                        ref={videoRef}
                        source={{ uri: data.video }}
                        style={{ width: width, height: height, backgroundColor: 'black' }}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={true}
                        isLooping
                        useNativeControls={false}
                    />
                </Pressable>

                {/* Bottom Overlay Info & Buttons */}
                <View className="relative bottom-[20%] left-4 right-4 flex-row justify-between items-end">
                    {/* LEFT INFO */}
                    <View className="flex-1 pr-6">
                        <Pressable
                            onPress={() => navigation.navigate("PublicProfile", { user: data.user })}
                            className="flex-row items-center mb-3"
                        >
                            <Avatar 
                                user={data.user as any} 
                                size={40} 
                            />
                            <View>
                                <Text className="text-white font-bold text-base shadow-md">
                                    {data.user?.name || data.user?.username}
                                </Text>
                                <Text className="text-gray-300 text-xs shadow-md">
                                    @{data.user?.username}
                                </Text>
                            </View>
                        </Pressable>
                        <Text className="text-white text-sm font-medium mb-1 shadow-md">{data.title}</Text>
                        <Text className="text-gray-300 text-xs shadow-md" numberOfLines={3}>{data.description}</Text>
                    </View>

                    {/* RIGHT ACTIONS */}
                    <View className="items-center gap-4">
                        <View className="items-center">
                            <TouchableOpacity onPress={handleLike} className="p-2">
                                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={34} color={isLiked ? "red" : "white"} />
                            </TouchableOpacity>
                            <Text className="text-white text-xs font-bold shadow-md">{likeCount}</Text>
                        </View>

                        <View className="items-center">
                            <TouchableOpacity onPress={() => setCommentModalVisible(true)} className="p-2">
                                <Ionicons name="chatbubble-outline" size={32} color="white" />
                            </TouchableOpacity>
                            <Text className="text-white text-xs font-bold shadow-md">{commentCount}</Text>
                        </View>

                        <View className="items-center">
                            <Ionicons name="eye-outline" size={32} color="white" />
                            <Text className="text-white text-xs font-bold shadow-md">{data.views || 0}</Text>
                        </View>

                        <TouchableOpacity onPress={handleShare}>
                            <Ionicons name="paper-plane-outline" size={32} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* MODAL */}
                <UnifiedCommentsModal
                    isVisible={isCommentModalVisible}
                    id={id}
                    isShort={true}
                    currentUser={currentUser}
                    onClose={() => setCommentModalVisible(false)}
                    onCommentAdded={handleCommentAdded}
                />
            </View>
        );
    }

    // --- RENDER POST (Keep Existing Logic) ---
    return (
        <SafeAreaView className="flex-1 bg-black">
            <View className="bg-black flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-900">
                    <View className="flex-row items-center gap-3">
                        <Pressable onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </Pressable>
                        <Pressable className="flex-row items-center" onPress={() => navigation.navigate("PublicProfile", { user: data?.user })}>
                            <Avatar 
                                user={data.user as any} 
                                size={36} 
                            />
                            <View className="ml-3">
                                <Text className="text-white font-bold text-sm">{data.user?.username}</Text>
                                {data.college && <Text className="text-gray-500 text-[10px] uppercase tracking-wide">{data.college}</Text>}
                            </View>
                        </Pressable>
                    </View>
                    <Ionicons name="ellipsis-horizontal" size={20} color="gray" />
                </View>

                {/* Content */}
                <ScrollView>
                    <Pressable onPress={() => setResizeMode(prev => !prev)}>
                        <View className="w-full bg-gray-900 aspect-square">
                            <ExpoImage
                                source={{ uri: data.image?.[0] }}
                                style={{ width: width, height: width }}
                                contentFit={resizeMode ? "contain" : "cover"}
                                cachePolicy="disk"
                                transition={300}
                            />
                        </View>
                    </Pressable>

                    {/* Actions */}
                    <View className="px-3 pt-3 flex-row items-center gap-4">
                        <TouchableOpacity onPress={handleLike}>
                            <Ionicons
                                name={isLiked ? "heart" : "heart-outline"}
                                size={28}
                                color={isLiked ? "#FF3040" : "white"}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setCommentModalVisible(true)}>
                            <Ionicons name="chatbubble-outline" size={26} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleShare}>
                            <Ionicons name="paper-plane-outline" size={26} color="white" style={{ transform: [{ rotate: '-0deg' }], marginTop: -3 }} />
                        </TouchableOpacity>
                    </View>

                    {/* Likes & Caption */}
                    <View className="px-3 pt-2 pb-10">
                        <Text className="text-white font-bold text-sm">{likeCount} likes</Text>
                        <View className="mt-2">
                            <Text className="text-white text-sm leading-5">
                                <Text className="font-bold text-gray-300">{data.user?.username} </Text>
                                {data.description}
                            </Text>
                        </View>
                        <Pressable onPress={() => setCommentModalVisible(true)} className="mt-1">
                            <Text className="text-gray-500 text-sm">
                                {commentCount > 0 ? `View all ${commentCount} comments` : "Add a comment..."}
                            </Text>
                        </Pressable>
                        <Text className="text-gray-600 text-xs mt-1 uppercase">Just now</Text>
                    </View>
                </ScrollView>
            </View>

            <UnifiedCommentsModal
                isVisible={isCommentModalVisible}
                id={id}
                isShort={false}
                currentUser={currentUser}
                onClose={() => setCommentModalVisible(false)}
                onCommentAdded={handleCommentAdded}
            />
        </SafeAreaView>
    );
};

export default IndividualPostOrShort;