import React, { useEffect, useState, useRef } from 'react';
import { 
  View, Text, ActivityIndicator, Image, TouchableOpacity, 
  Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, Alert, 
  Pressable, Dimensions, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av'; 
import axios from "../context/axiosConfig";
import { useAuth } from '../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// --- HELPER TO GET ENDPOINTS DYNAMICALLY ---
const getEndpoints = (isShort: boolean, id: string) => ({
    get: isShort ? `/shorts/individual/${id}` : `/post/individual/${id}`,
    like: isShort ? `/shorts/like/${id}` : `/post/like/${id}`,
    view: isShort ? `/shorts/view/${id}` : null,
    getComments: isShort ? `/shorts/comment/all/${id}` : `/post/comment/${id}`,
    addComment: isShort ? `/shorts/comment/add/${id}` : `/post/comment/${id}`,
    updateComment: isShort ? `/shorts/comment/update` : `/post/comment`, // Append ID later
    deleteComment: isShort ? `/shorts/comment/delete` : `/post/comment/delete`, // Append ID later
});

// --- 1. UNIFIED COMMENTS MODAL (Dark Theme Matched) ---
const UnifiedCommentsModal = ({ isVisible, id, isShort, onClose, currentUser, onCommentAdded }: any) => {
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    
    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const endpoints = getEndpoints(isShort, id);
  
    useEffect(() => {
      if (isVisible && id) fetchComments();
    }, [isVisible, id]);
  
    const fetchComments = async () => {
      setLoading(true);
      try {
        const res = await axios.get(endpoints.getComments);
        if (res.data.success) {
          const sorted = res.data.comments.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setComments(sorted);
        }
      } catch (error) {
        console.log("Error loading comments", error);
      } finally {
        setLoading(false);
      }
    };
  
    const handlePostComment = async () => {
      if (!newComment.trim()) return;
      setPosting(true);
      try {
        const res = await axios.post(endpoints.addComment, { text: newComment });
        if (res.data.success) {
          const addedComment = res.data.comment;
          // Manual population
          if (!addedComment.commentor) {
              addedComment.commentor = {
                  _id: currentUser._id,
                  username: currentUser.username,
                  avatar: currentUser.avatar,
                  name: currentUser.name || currentUser.username
              };
          }
          setComments([addedComment, ...comments]); 
          setNewComment('');
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
            // Construct URL: e.g. /shorts/comment/update/123
            const url = `${endpoints.updateComment}/${commentId}`;
            await axios.post(url, { text: editingText });
            
            // Update Local State
            setComments(prev => prev.map(c => c._id === commentId ? { ...c, text: editingText } : c));
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
            // Try both methods just in case backend varies
            await axios.post(url).catch(() => axios.delete(url));
            
            setComments(prev => prev.filter(c => c._id !== commentId));
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
            
            <View className="bg-neutral-900 rounded-t-2xl h-[75%] px-4 pt-4 border-t border-gray-800">
                {/* Header */}
                <View className="items-center mb-3">
                    <View className="h-1 w-10 bg-gray-600 rounded-full mb-2" />
                    <Text className="text-white font-semibold text-base">Comments</Text>
                </View>

                {/* List */}
                {loading ? (
                    <ActivityIndicator size="large" color="#fff" className="mt-10" />
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
                        {comments.length === 0 && (
                            <Text className="text-gray-400 text-center mt-10">No comments yet</Text>
                        )}
                        {comments.map((c: any) => (
                            <View key={c._id} className="flex-row mb-4">
                                <Image source={{ uri: c.commentor?.avatar }} className="h-9 w-9 rounded-full mr-3 bg-gray-700" />
                                <View className="flex-1">
                                    <View className="flex flex-row items-center gap-1">
                                        <Text className="text-white font-semibold">{c.commentor?.name}</Text>
                                        <Text className="text-gray-400 text-sm">@{c.commentor?.username}</Text>
                                    </View>

                                    {editingId === c._id ? (
                                        <TextInput 
                                            value={editingText} 
                                            onChangeText={setEditingText} 
                                            className="text-white border-b border-gray-600 pb-1 mt-1" 
                                            autoFocus 
                                        />
                                    ) : (
                                        <Text className="text-gray-300 mt-0.5">{c.text}</Text>
                                    )}

                                    {/* Actions */}
                                    {(c.commentor?._id === currentUser._id) && (
                                        <View className="flex-row mt-2">
                                            {editingId === c._id ? (
                                                <Pressable onPress={() => handleUpdateComment(c._id)} className="mr-4">
                                                    {actionLoadingId === c._id ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-blue-400 text-xs">Save</Text>}
                                                </Pressable>
                                            ) : (
                                                <Pressable onPress={() => { setEditingId(c._id); setEditingText(c.text); }} className="mr-4">
                                                    <Text className="text-gray-400 text-xs">Edit</Text>
                                                </Pressable>
                                            )}
                                            <Pressable onPress={() => handleDeleteComment(c._id)}>
                                                {actionLoadingId === c._id ? <ActivityIndicator size="small" color="red" /> : <Text className="text-red-400 text-xs">Delete</Text>}
                                            </Pressable>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Input */}
                <View className="absolute bottom-0 left-0 right-0 border-t border-gray-800 bg-neutral-900 px-3 py-3 flex-row items-center">
                    <TextInput
                        value={newComment}
                        onChangeText={setNewComment}
                        placeholder="Add a comment..."
                        placeholderTextColor="#888"
                        className="flex-1 text-white bg-neutral-800 rounded-full px-4 py-3 mr-2"
                    />
                    <Pressable onPress={handlePostComment} disabled={posting || !newComment.trim()}>
                        {posting ? <ActivityIndicator size="small" color="#ec4899" /> : <Text className="text-pink-400 font-semibold">Post</Text>}
                    </Pressable>
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

    const loadData = async () => {
        try {
            setLoading(true);
            const endpoints = getEndpoints(isShort, id);
            const res = await axios.get(endpoints.get);
            
            if (res.data.success) {
                const fetchedData = isShort ? res.data.short : res.data.post;
                setData(fetchedData);
                setLikeCount(fetchedData.likes || 0);
                setIsLiked(fetchedData.liked_by.includes(currentUser?._id));
                setCommentCount(fetchedData.comments?.length || 0);
                
                if (isShort && endpoints.view) axios.get(endpoints.view);
            }
        } catch (error: any) {
            console.error("Error loading data:", error);
            Alert.alert("Error", "Failed to load content.");
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        const previousLiked = isLiked;
        const previousCount = likeCount;
        const endpoints = getEndpoints(isShort, id);

        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);

        try {
            await axios.post(endpoints.like);
        } catch (error) {
            setIsLiked(previousLiked);
            setLikeCount(previousCount);
        }
    };

    const handleCommentAdded = () => {
        setCommentCount(prev => prev + 1);
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
                            <Image
                                source={{ uri: data.user?.avatar || `https://ui-avatars.com/api/?name=${data.user?.username}` }}
                                className="h-10 w-10 rounded-full mr-3 border border-white/50"
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
                            <Image 
                                source={{ uri: data.user?.avatar || `https://ui-avatars.com/api/?name=${data.user?.username}` }} 
                                className="w-9 h-9 rounded-full border border-gray-800" 
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
                    <Pressable onPress={()=> setResizeMode(prev => !prev)}>
                        <View className="w-full bg-gray-900 aspect-square"> 
                            <Image 
                                source={{ uri: data.image?.[0] }} 
                                style={{ width: width, height: width }}
                                resizeMode={resizeMode ? "contain" : "cover"}
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
                        <TouchableOpacity>
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