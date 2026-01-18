import React, { useEffect, useState } from 'react';
import { 
  View, Text, ActivityIndicator, Image, TouchableOpacity, 
  Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, Alert, 
  Pressable, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from "../context/axiosConfig";
import { useAuth } from '../context/auth.context';

const { width } = Dimensions.get('window');

// --- 1. REUSABLE COMMENTS MODAL (Same as Home Screen) ---
const CommentsModal = ({ isVisible, postId, onClose, currentUser, onCommentAdded }: any) => {
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
  
    useEffect(() => {
      if (isVisible && postId) {
        fetchComments();
      }
    }, [isVisible, postId]);
  
    const fetchComments = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/post/comment/${postId}`);
        if (res.data.success) {
          setComments(res.data.comments);
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
        const res = await axios.post(`/post/comment/${postId}`, { text: newComment });
        if (res.data.success) {
          const addedComment = res.data.comment;
          
          // Manual population
          if (!addedComment.commentor) {
              addedComment.commentor = {
                  _id: currentUser._id,
                  username: currentUser.username,
                  avatar: currentUser.avatar
              };
          }
          
          setComments([addedComment, ...comments]); 
          setNewComment('');
  
          // Notify Parent to update count
          if (onCommentAdded) {
              onCommentAdded(addedComment);
          }
        }
      } catch (error) {
        console.log("Error posting comment", error);
        Alert.alert("Error", "Could not post comment");
      } finally {
        setPosting(false);
      }
    };
  
    const renderCommentItem = ({ item }: { item: any }) => (
      <View className="flex-row px-4 py-3 border-b border-gray-900">
        <Image 
          source={{ uri: item.commentor?.avatar || `https://ui-avatars.com/api/?name=${item.commentor?.username}` }} 
          className="w-9 h-9 rounded-full bg-gray-800" 
        />
        <View className="ml-3 flex-1">
          <View className="flex-row items-baseline mb-1">
              <Text className="text-white font-bold text-sm mr-2">{item.commentor?.username}</Text>
              <Text className="text-gray-500 text-xs">{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text className="text-gray-300 text-sm leading-5">{item.text}</Text>
        </View>
      </View>
    );
  
    return (
      <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-black h-[75%] rounded-t-3xl w-full">
            
            {/* Header */}
            <View className="flex-row justify-center items-center py-4 border-b border-gray-900">
              <View className="w-12 h-1 bg-gray-700 rounded-full absolute top-2 self-center" />
              <Text className="text-white font-bold text-base">Comments</Text>
              <Pressable onPress={onClose} className="absolute right-4 p-1">
                 <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>
  
            {/* Comment List */}
            {loading ? (
              <ActivityIndicator size="large" color="#fff" className="mt-10" />
            ) : (
              <FlatList
                data={comments}
                renderItem={renderCommentItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                  <Text className="text-gray-500 text-center mt-10">No comments yet.</Text>
                }
              />
            )}
  
            {/* Input Area */}
            <KeyboardAvoidingView 
              behavior={Platform.OS === "ios" ? "padding" : "height"} 
              className="absolute bottom-0 w-full bg-gray-900 border-t border-gray-800 px-4 py-3 flex-row items-center"
            >
              <Image 
                  source={{ uri: currentUser?.avatar || `https://ui-avatars.com/api/?name=${currentUser?.username}` }} 
                  className="w-10 h-10 rounded-full mr-3" 
              />
              <TextInput
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Add a comment..."
                  placeholderTextColor="#888"
                  className="flex-1 text-white bg-black rounded-full px-4 py-3 mr-3"
              />
              <Pressable onPress={handlePostComment} disabled={posting || !newComment.trim()}>
                  {posting ? (
                      <ActivityIndicator size="small" color="#3b82f6" />
                  ) : (
                      <Text className={`font-bold ${!newComment.trim() ? 'text-gray-600' : 'text-blue-500'}`}>Post</Text>
                  )}
              </Pressable>
            </KeyboardAvoidingView>
  
          </View>
        </View>
      </Modal>
    );
};

// --- 2. MAIN COMPONENT ---
const IndividualPostOrShort = ({ route, navigation }: any) => {
    const { postId } = route.params;
    const { user: currentUser } = useAuth();
    
    // Data States
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Interaction States
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [resizeMode, setResizeMode] = useState(false);
    
    // Comment Modal State
    const [isCommentModalVisible, setCommentModalVisible] = useState(false);
    // We only track count here now, since the list is in the modal
    const [commentCount, setCommentCount] = useState(0); 

    useEffect(() => {
        loadData();
    }, [postId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/post/individual/${postId}`);
            
            if (res.data.success) {
                const fetchedPost = res.data.post;
                setPost(fetchedPost);
                setLikeCount(fetchedPost.likes || 0);
                setIsLiked(fetchedPost.liked_by.includes(currentUser?._id));
                // Set initial comment count based on array length
                setCommentCount(fetchedPost.comments?.length || 0);
            }
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        const previousLiked = isLiked;
        const previousCount = likeCount;

        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);

        try {
            await axios.post(`/post/like/${postId}`);
        } catch (error) {
            setIsLiked(previousLiked);
            setLikeCount(previousCount);
            console.error("Like failed", error);
        }
    };

    // Callback when comment is added via Modal
    const handleCommentAdded = (newComment: any) => {
        setCommentCount(prev => prev + 1);
    };

    const timeAgo = (dateString: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    };

    if (loading) {
        return (
            <View className="flex-1 bg-black justify-center items-center">
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    if (!post) return null;

    return (
        <SafeAreaView className="flex-1 bg-black">
            <View className="bg-black flex-1">
                 {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-3">
                    <Pressable className="flex-row items-center" onPress={() => navigation.navigate("PublicProfile", { user: post?.user })}>
                        <Image 
                            source={{ uri: post.user?.avatar || `https://ui-avatars.com/api/?name=${post.user?.username}` }} 
                            className="w-9 h-9 rounded-full border border-gray-800" 
                        />
                        <View className="ml-3">
                            <Text className="text-white font-bold text-sm">{post.user?.username}</Text>
                            {post.college && <Text className="text-gray-500 text-[10px] uppercase tracking-wide">{post.college}</Text>}
                        </View>
                    </Pressable>
                </View>

                {/* Content */}
                <Pressable onPress={()=> setResizeMode(prev => !prev)}>
                    <View className="w-full bg-gray-900 aspect-square"> 
                        <Image 
                            source={{ uri: post.image?.[0] }} 
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
                    
                    {/* OPEN MODAL ON CLICK */}
                    <TouchableOpacity onPress={() => setCommentModalVisible(true)}>
                        <Ionicons name="chatbubble-outline" size={26} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity>
                        <Ionicons name="paper-plane-outline" size={26} color="white" style={{ transform: [{ rotate: '-0deg' }], marginTop: -3 }} />
                    </TouchableOpacity>
                </View>

                {/* Likes & Caption */}
                <View className="px-3 pt-2">
                    <Text className="text-white font-bold text-sm">{likeCount} likes</Text>
                    <View className="mt-2">
                        <Text className="text-white text-sm leading-5">
                            <Text className="font-bold text-gray-300">{post.user?.username} </Text>
                            {post.description}
                        </Text>
                    </View>
                    
                    {/* View Comments Text */}
                    <Pressable onPress={() => setCommentModalVisible(true)} className="mt-1">
                        <Text className="text-gray-500 text-sm">
                            {commentCount > 0 ? `View all ${commentCount} comments` : "Add a comment..."}
                        </Text>
                    </Pressable>

                    <Text className="text-gray-600 text-xs mt-1 uppercase">{timeAgo(post.createdAt)} Ago</Text>
                </View>
            </View>

            {/* --- COMMENT MODAL --- */}
            <CommentsModal 
                isVisible={isCommentModalVisible}
                postId={postId}
                currentUser={currentUser}
                onClose={() => setCommentModalVisible(false)}
                onCommentAdded={handleCommentAdded}
            />
        </SafeAreaView>
    );
};

export default IndividualPostOrShort;