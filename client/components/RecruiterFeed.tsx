import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ViewToken,
  TouchableOpacity,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/auth.context';
import Avatar from './Avatar';
import axios from '../context/axiosConfig';
import AdCarousel from './AdCarousel';
import { Image as ExpoImage } from 'expo-image';
import { memo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  checkAndStartSession,
  getSeenPostIds,
  markPostsAsSeen,
  resetSeenPosts,
} from '../utils/feedSession';

const { width } = Dimensions.get('window');

// --- TYPES ---
interface Post {
  _id: string;
  user?: {
    _id: string;
    avatar?: string;
    name?: string;
    username?: string;
    user_access?: 'admin' | 'user' | 'alumni' | 'recruiter';
  };
  createdAt: string;
  image?: string[];
  description: string;
  likes: number;
  liked_by: string[];
  comments: any[];
  commentCount?: number;
  college?: string;
}

// --- COMMENTS MODAL ---
const CommentsModal = ({ isVisible, postId, onClose, currentUser, onCommentAdded }: any) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const inputRef = useRef<TextInput>(null);

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
      const res = await axios.post(`/post/comment/${postId}`, {
        text: newComment,
        parentCommentId: replyingTo?._id
      });
      if (res.data.success) {
        const addedComment = res.data.comment;
        if (replyingTo) {
          setComments(prev => prev.map(c => {
            if (c._id === replyingTo._id) {
              return { ...c, replies: [addedComment, ...(c.replies || [])] };
            }
            return c;
          }));
        } else {
          setComments([addedComment, ...comments]);
        }
        setNewComment('');
        setReplyingTo(null);
        if (onCommentAdded) onCommentAdded(postId, addedComment);
      }
    } catch (error) {
      console.log("Error posting comment", error);
    } finally {
      setPosting(false);
    }
  };

  const handleReply = (comment: any) => {
    setReplyingTo(comment);
    setNewComment(`@${comment.commentor.username} `);
    inputRef.current?.focus();
  };

  const CommentItem = ({ comment, isReply = false }: { comment: any, isReply?: boolean }) => (
    <View className={`${isReply ? 'ml-12 mt-2' : 'px-4 py-3 border-b border-gray-50'}`}>
      <View className="flex-row">
        <ExpoImage
          source={{ uri: comment.commentor?.avatar || `https://ui-avatars.com/api/?name=${comment.commentor?.username}` }}
          style={{ width: isReply ? 28 : 36, height: isReply ? 28 : 36, borderRadius: 999 }}
          cachePolicy="disk"
        />
        <View className="ml-3 flex-1">
          <View className="flex-row items-baseline mb-1">
            <Text className="text-zinc-900 font-bold text-[13px] mr-2">{comment.commentor?.username}</Text>
            <Text className="text-gray-400 text-[10px]">{new Date(comment.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text className="text-zinc-700 text-sm leading-5">
            {comment.replyToUser && <Text className="text-pink-500">@{comment.replyToUser.username} </Text>}
            {comment.text}
          </Text>
          {!isReply && (
            <Pressable onPress={() => handleReply(comment)} className="mt-2">
              <Text className="text-gray-500 text-xs font-bold">Reply</Text>
            </Pressable>
          )}
        </View>
      </View>
      {comment.replies && comment.replies.length > 0 && (
        <View className="mt-2">
          {comment.replies.map((reply: any) => (
            <CommentItem key={reply._id} comment={reply} isReply={true} />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="w-full">
          <View className="bg-white h-[650px] rounded-t-3xl w-full overflow-hidden">
            <View className="flex-row justify-center items-center py-4 border-b border-gray-100">
               <View className="w-12 h-1 bg-gray-200 rounded-full absolute top-2 self-center" />
               <Text className="text-zinc-900 font-bold text-base">Comments</Text>
               <Pressable onPress={onClose} className="absolute right-4 p-1">
                 <Ionicons name="close" size={24} color="#1A1A1A" />
               </Pressable>
            </View>
            {loading ? (
              <ActivityIndicator size="large" color="#ec4899" className="mt-10" />
            ) : (
              <FlatList
                data={comments}
                renderItem={({ item }) => <CommentItem comment={item} />}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingBottom: 150 }}
                ListEmptyComponent={<Text className="text-gray-400 text-center mt-10">No comments yet.</Text>}
              />
            )}
            <View className="w-full bg-white border-t border-gray-100 px-4 pt-2 pb-5" style={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}>
              <View className="flex-row items-center gap-2">
                <Avatar user={currentUser} size={32} />
                <TextInput
                  ref={inputRef}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Add a comment..."
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-black bg-gray-50 rounded-full px-4 py-3 mr-3 border border-gray-100"
                  multiline
                />
                <Pressable onPress={handlePostComment} disabled={posting || !newComment.trim()}>
                  <Text className={`font-bold ${!newComment.trim() ? 'text-gray-300' : 'text-pink-500'}`}>Post</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// --- POST ITEM (Matching home-screen.tsx styles) ---
const PostItem = memo(({ item, currentUser, openComments, onDeletePost }: { item: Post, currentUser: any, openComments: (id: string) => void, onDeletePost: (id: string) => void }) => {
  const [liked, setLiked] = useState(item.liked_by.includes(currentUser?._id));
  const [likeCount, setLikeCount] = useState(item.likes);
  const [resizeMode, setResizeMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_CHAR_LIMIT = 150;
  const navigation = useNavigation<any>();

  const images = item.image || [];

  const handleLike = async () => {
    const previousState = liked;
    const previousCount = likeCount;
    setLiked(!previousState);
    setLikeCount(previousState ? previousCount - 1 : previousCount + 1);
    try { await axios.post(`/post/like/${item._id}`); } catch { setLiked(previousState); setLikeCount(previousCount); }
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

  return (
    <View className="bg-gray-50 border-b border-gray-100 py-2 mb-3 shadow-sm shadow-black/5 rounded-2xl">
      {/* Post Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })}>
          <View className="flex-row items-center">
            <Avatar user={item.user as any} size={30} />
            <View className="ml-3">
              <Text className="text-zinc-900 font-bold text-sm">{item.user?.name || "Unknown"}</Text>
              {item.user?.username && <Text className="text-gray-400 text-[10px] tracking-wide">{item.user?.username}</Text>}
            </View>
          </View>
        </Pressable>
        {currentUser && currentUser._id === item.user?._id && (
          <Pressable onPress={() => Alert.alert("Delete Post", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => onDeletePost(item._id) }])}>
            <Ionicons name="ellipsis-horizontal" size={20} color="gray" />
          </Pressable>
        )}
      </View>

      {/* Image Carousel */}
      <View>
        <FlatList
          data={images}
          keyExtractor={(url, index) => `${item._id}-img-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item: imageUrl }) => (
            <Pressable onPress={() => setResizeMode(prev => !prev)}>
              <ExpoImage
                source={{ uri: imageUrl }}
                style={{ width: width, height: width }}
                contentFit={resizeMode ? "contain" : "cover"}
                cachePolicy="disk"
                transition={200}
              />
            </Pressable>
          )}
        />
        {images.length > 1 && (
          <View className="absolute top-3 right-3 bg-white/80 px-3 py-1 rounded-full border border-gray-200">
            <Text className="text-zinc-900 text-xs font-bold">{activeIndex + 1}/{images.length}</Text>
          </View>
        )}
      </View>

      {/* Caption */}
      <View className="px-3 pt-1 mt-2">
        <Text className="text-zinc-800 text-sm leading-5">
          <Text className="font-bold text-pink-500">{item.user?.username} </Text>
          {item.description?.length > MAX_CHAR_LIMIT && !isExpanded
            ? `${item.description.substring(0, MAX_CHAR_LIMIT)}...`
            : item.description
          }
          {item.description?.length > MAX_CHAR_LIMIT && (
            <Text onPress={() => setIsExpanded(!isExpanded)} className="text-gray-400 font-semibold">
              {isExpanded ? " show less" : " show more"}
            </Text>
          )}
        </Text>
      </View>

      {/* Action Bar */}
      <View className="flex-row items-center px-3 pt-2 gap-4">
        <Pressable onPress={handleLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? "#ff3040" : "#1A1A1A"} />
        </Pressable>
        <Pressable onPress={() => openComments(item._id)}>
          <Ionicons name="chatbubble-outline" size={26} color="#1A1A1A" />
        </Pressable>
        <Pressable onPress={() => Share.share({ message: item.description })}>
          <Ionicons name="paper-plane-outline" size={26} color="#1A1A1A" />
        </Pressable>
      </View>

      {/* Likes */}
      <View className="px-3">
        <Text className="text-zinc-500 font-bold text-sm">{likeCount > 0 ? `${likeCount} likes` : 'Be the first to like'}</Text>
      </View>

      {/* Time */}
      <Text className="px-3 pt-1 text-gray-400 text-[10px] uppercase tracking-wider">{timeAgo(item.createdAt)} Ago</Text>
    </View>
  );
});

export default function RecruiterFeed() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [feed, setFeed] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCommentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchFeed = useCallback(async (shouldRefresh = false) => {
    if (shouldRefresh) setRefreshing(true); else setLoading(true);
    try {
      const seenIds = await getSeenPostIds();
      const res = await axios.post(`/post/smart-feed?page=1&limit=20`, { seenIds });
      if (res.data.success) {
        setFeed(res.data.posts);
        markPostsAsSeen(res.data.posts.map((p: Post) => p._id));
      }
    } catch { /* error handled */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { checkAndStartSession().then(() => fetchFeed()); }, [fetchFeed]);

  const handleDeletePost = async (postId: string) => {
    try {
      const res = await axios.delete(`/post/${postId}`);
      if (res.data.success) setFeed(prev => prev.filter(p => p._id !== postId));
    } catch { Alert.alert("Error", "Could not delete post"); }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Top Bar matching RecruiterPortal */}
      <View className="px-6 pb-4 flex-row items-center justify-between bg-white border-b border-slate-100">
          <View>
              <Text className="text-2xl font-black italic uppercase tracking-tighter">
                  Campus <Text className="text-indigo-600">Feed</Text>
              </Text>
              <Text className="text-slate-400 text-[8px] font-bold tracking-[2px] uppercase">
                  Community Updates
              </Text>
          </View>
          <View className="flex-row items-center gap-2">
              <TouchableOpacity
                  onPress={() => navigation.navigate('SearchScreen')}
                  className="w-10 h-10 items-center justify-center"
              >
                  <Ionicons name="search-outline" size={25} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity
                  onPress={() => navigation.navigate('Notification')}
                  className="w-10 h-10 items-center justify-center"
              >
                  <Ionicons name="notifications-outline" size={25} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => fetchFeed(true)} className="w-10 h-10 items-center justify-center">
                  <Ionicons name="refresh" size={25} color="#000" />
              </TouchableOpacity>
          </View>
      </View>

      <FlatList
        data={feed}
        keyExtractor={p => p._id}
        renderItem={({ item }) => (
          <PostItem 
            item={item} 
            currentUser={user} 
            openComments={(id: string) => { setSelectedPostId(id); setCommentModalVisible(true); }} 
            onDeletePost={handleDeletePost} 
          />
        )}
        ListHeaderComponent={
          <View className="mb-4">
             <AdCarousel />
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchFeed(true)} tintColor="#ec4899" />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          !loading && (
            <View className="mt-20 flex-1 items-center px-4">
                <Text className="text-xl font-bold text-zinc-900 mt-4">Welcome to Recruiter Feed!</Text>
                <Text className="text-gray-400 text-center mt-2 px-10">Follow people or create a post to see updates here.</Text>
            </View>
          )
        }
      />

      <CommentsModal 
        isVisible={isCommentModalVisible} 
        postId={selectedPostId} 
        currentUser={user} 
        onClose={() => setCommentModalVisible(false)} 
        onCommentAdded={(pid: string, comment: any) => {
            setFeed(prev => prev.map(p => p._id === pid ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
        }}
      />
    </SafeAreaView>
  );
}
