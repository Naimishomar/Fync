import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
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
  DeviceEventEmitter,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { PostSkeleton } from "./Skeleton";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sparkles, Mic, Briefcase, Trophy, Rocket, Crown, MessageCircle, Megaphone, Users, Code, Wrench } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { Layout, FadeIn, FadeOut } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/auth.context';
import CreatePost from './create-post';
import Avatar from './Avatar';
import axios from '../context/axiosConfig';
// @ts-ignore
import no_post from '../assets/no_post.png';
import AdCarousel from './AdCarousel';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { memo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  checkAndStartSession,
  getSeenPostIds,
  markPostsAsSeen,
  resetSeenPosts,
} from '../utils/feedSession';
import { BlurView } from 'expo-blur';
import StreakLeaderboardModal from './StreakLeaderboardModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFullUrl } from '../utils/imageUtils';

const { width } = Dimensions.get('window');

// --- TYPES ---
// --- HELPERS ---
const formatCount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num > 0 ? num.toString() : '0';
};

interface Post {
  _id: string;
  user?: {
    _id: string;
    avatar?: string;
    name?: string;
    username?: string;
    user_access?: 'admin' | 'user' | 'alumni';
  };
  createdAt: string;
  image?: string[];
  description: string;
  likes: number;
  liked_by: string[];
  upvoted_by?: string[];
  downvoted_by?: string[];
  score?: number;
  saved_by?: string[];
  reposted_by?: string[];
  reposts?: number;
  views?: number;
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
          // Add to replies of the parent comment
          setComments(prev => prev.map(c => {
            if (c._id === replyingTo._id) {
              return { ...c, replies: [addedComment, ...(c.replies || [])] };
            }
            return c;
          }));
        } else {
          // Add to top level comments
          setComments([addedComment, ...comments]);
        }

        setNewComment('');
        setReplyingTo(null);
        if (onCommentAdded) {
          onCommentAdded(postId, addedComment);
        }
      }
    } catch (error) {
      console.log("Error posting comment", error);
      Alert.alert("Error", "Could not post comment");
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
          source={{ uri: getFullUrl(comment.commentor?.avatar) || `https://ui-avatars.com/api/?name=${comment.commentor?.username}` }}
          style={{ width: isReply ? 28 : 36, height: isReply ? 28 : 36, borderRadius: 999 }}
          className="bg-gray-100"
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
        <KeyboardAvoidingView
          behavior="padding"
          className="w-full"
        >
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
                showsVerticalScrollIndicator={false}
              />
            )}

            <View className="w-full bg-white border-t border-gray-100 px-4 pt-2 pb-5" style={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}>
              {replyingTo && (
                <View className="flex-row items-center justify-between bg-zinc-50 px-3 py-2 mb-2 rounded-lg">
                  <Text className="text-zinc-500 text-xs">Replying to <Text className="font-bold">@{replyingTo.commentor.username}</Text></Text>
                  <Pressable onPress={() => setReplyingTo(null)}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </Pressable>
                </View>
              )}
              <View className="flex-row items-center gap-2">
                <ExpoImage
                  source={{ uri: getFullUrl(currentUser?.avatar) || `https://ui-avatars.com/api/?name=${currentUser?.username}` }}
                  style={{ width: 32, height: 32, borderRadius: 999 }}
                  className="rounded-full"
                  cachePolicy="disk"
                />
                <TextInput
                  ref={inputRef}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-black bg-gray-50 rounded-full px-4 py-3 mr-3 border border-gray-100"
                  multiline
                />
                <Pressable onPress={handlePostComment} disabled={posting || !newComment.trim()}>
                  {posting ? <ActivityIndicator size="small" color="#ec4899" /> : <Text className={`font-bold ${!newComment.trim() ? 'text-gray-300' : 'text-pink-500'}`}>Post</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// --- POST ITEM ---
const PostItem = memo(({ item, index, currentUser, openComments, onDeletePost }: { item: Post, index: number, currentUser: any, openComments: (id: string) => void, onDeletePost: (id: string) => void }) => {
  const { width } = useWindowDimensions();
  const [vote, setVote] = useState<'up' | 'down' | null>(
    item.upvoted_by?.includes(currentUser?._id) ? 'up' : 
    item.downvoted_by?.includes(currentUser?._id) ? 'down' : null
  );
  const [score, setScore] = useState(item.score || (item.likes || 0));
  const [reposted, setReposted] = useState(item.reposted_by?.includes(currentUser?._id));
  const [repostCount, setRepostCount] = useState(item.reposts || 0);
  const [viewCount] = useState(item.views || 0);
  
  const [resizeMode, setResizeMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_CHAR_LIMIT = 150;

  const springValue = useRef(new Animated.Value(1)).current;
  const navigation = useNavigation<any>();

  const displayCommentCount = item.commentCount || item.comments?.length || 0;
  const images = item.image || [];

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(springValue, { toValue: 0.9, duration: 100, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.spring(springValue, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true })
    ]).start();
  };

  const handleVote = async (type: 'up' | 'down') => {
    animatePress();
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
      await axios.post(`/post/vote/${item._id}`, { type: newVote });
    } catch (error) {
      setVote(prevVote);
      setScore(prevScore);
    }
  };


  const handleRepost = () => {
    Alert.alert("Repost", "Share this post on your feed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Repost", onPress: async () => {
        const prevReposted = reposted;
        const prevCount = repostCount;
        setReposted(!prevReposted);
        setRepostCount(prevReposted ? prevCount - 1 : prevCount + 1);
        try {
          await axios.post(`/post/repost/${item._id}`);
        } catch (error) {
          setReposted(prevReposted);
          setRepostCount(prevCount);
        }
      }}
    ]);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const timeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://fync-api.duckdns.org/view?postId=${item._id}`;
      await Share.share({
        message: `Check out this post by ${item.user?.username} on Fync!\n\n${item.description || ''}\n\nView post: ${shareUrl}`,
      });
    } catch (error: any) {
      console.log('Share error:', error.message);
    }
  };

  return (
    <View className="bg-white border-b border-gray-100 py-4 px-3 mb-2">
      {/* Top Header Row (Reddit Style) */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })}>
            {item.user?.avatar ? (
              <Avatar user={item.user as any} size={28} />
            ) : (
              <View className="w-7 h-7 rounded-full bg-indigo-500 items-center justify-center">
                <Text className="text-white font-bold text-[10px]">{(item.user?.name || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })} className="ml-2 flex-row items-center">
            <Text className="text-zinc-900 font-bold text-[14px]">{item.user?.username || "Unknown"}</Text>
            <Text className="text-gray-400 text-[14px] mx-1">·</Text>
            <Text className="text-gray-500 text-[14px] font-medium">{timeAgo(item.createdAt)}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => {
          const isOwner = item.user?._id === currentUser?._id;
          Alert.alert("Post Options", undefined , [
            { text: "Cancel", style: "cancel"},
            isOwner ? { 
              text: "Delete Post", 
              style: "destructive", 
              onPress: () => onDeletePost(item._id) 
            } : { 
              text: "Report Post", 
              style: "destructive", 
              onPress: () => {
                Alert.alert("Report", "Are you sure you want to report this post?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Report", style: "destructive", onPress: async () => {
                    try {
                      await axios.post('/post/report', { postId: item._id, reason: "Inappropriate content" });
                      Alert.alert("Success", "Post has been reported to administrators.");
                    } catch (e) {
                      Alert.alert("Error", "Failed to report post.");
                    }
                  }}
                ]);
              }
            }
          ]);
        }} className="p-1">
          <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
        </Pressable>
      </View>

      <View className="mb-3 px-1">
        <Text className="text-zinc-900 text-[15px] font-medium leading-6">
          {isExpanded || (item.description?.length || 0) <= MAX_CHAR_LIMIT
            ? item.description
            : `${item.description?.slice(0, MAX_CHAR_LIMIT)}...`}
        </Text>
        {(item.description?.length || 0) > MAX_CHAR_LIMIT && (
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} className="mt-1">
            <Text className="text-orange-500 font-bold">
              {isExpanded ? 'Show Less' : 'Show More'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Media (Full Width) */}
      <View className="relative mb-4">
        <FlatList
          data={item.image || []}
          keyExtractor={(url, index) => `${item._id}-img-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item: imageUrl }) => (
            <View style={{ width: width - 24 }}>
              <Pressable onPress={() => setResizeMode(prev => !prev)}>
                <ExpoImage
                  source={{ uri: getFullUrl(imageUrl) || '' }}
                  style={{ width: width - 24, height: width - 24, borderRadius: 12 }}
                  contentFit={resizeMode ? "contain" : "cover"}
                  cachePolicy="disk"
                  transition={200}
                  priority={index === 0 ? "high" : "normal"}
                />
              </Pressable>
            </View>
          )}
        />
        
        {/* Image Counter (Top Right) */}
        {(item.image?.length || 0) > 1 && (
          <View className="absolute top-3 right-3 bg-black/50 px-2 py-1 rounded-lg">
            <Text className="text-white text-[10px] font-bold">
              {activeIndex + 1}/{(item.image?.length || 0)}
            </Text>
          </View>
        )}
        {(item.image?.length || 0) > 1 && (
          <View className="flex-row justify-center gap-1.5 absolute bottom-4 w-full">
            {(item.image || []).map((_, i) => (
              <View key={i} className={`h-1.5 rounded-full ${activeIndex === i ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </View>
        )}
      </View>

      {/* Action Bar (Reddit Style Pills) */}
      <View className="flex-row items-center gap-2">
        {/* Vote Pill */}
        <Animated.View style={{ transform: [{ scale: springValue }] }} className="flex-row items-center bg-gray-50 rounded-full px-1 py-0.5">
          <Pressable onPress={() => handleVote('up')} className="p-1.5">
            <Ionicons name={vote === 'up' ? "arrow-up" : "arrow-up-outline"} size={19} color={vote === 'up' ? "#FF4500" : "#536471"} />
          </Pressable>
          <Text className={`font-semibold text-[13px] px-1 min-w-[20px] text-center ${vote === 'up' ? 'text-[#FF4500]' : vote === 'down' ? 'text-[#7193FF]' : 'text-[#536471]'}`}>
            {score === 0 ? 'Vote' : score > 999 ? formatCount(score) : score}
          </Text>
          <Pressable onPress={() => handleVote('down')} className="p-1.5">
            <Ionicons name={vote === 'down' ? "arrow-down" : "arrow-down-outline"} size={19} color={vote === 'down' ? "#7193FF" : "#536471"} />
          </Pressable>
        </Animated.View>

        {/* Comment Pill */}
        <Pressable 
          onPress={() => openComments(item._id)}
          className="flex-row items-center bg-gray-50 rounded-full px-3 py-1.5"
        >
          <Ionicons name="chatbubble-outline" size={17} color="#536471" />
          <Text className="text-[#536471] font-semibold text-[13px] ml-1.5">{formatCount(displayCommentCount)}</Text>
        </Pressable>

        {/* Share Pill */}
        <Pressable 
          onPress={handleShare}
          className="flex-row items-center bg-gray-50 rounded-full px-3 py-1.5"
        >
          <Ionicons name="share-social-outline" size={17} color="#536471" />
          <Text className="text-[#536471] font-semibold text-[13px] ml-1.5">Share</Text>
        </Pressable>

        <View className="flex-1" />

      </View>
    </View>
  );
});

// --- MAIN SCREEN ---
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [profileImage, setProfileImage] = useState<string | undefined>('');
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [forYouFeed, setForYouFeed] = useState<Post[]>([]);
  const [followingFeed, setFollowingFeed] = useState<Post[]>([]);
  const [forYouPage, setForYouPage] = useState(1);
  const [followingPage, setFollowingPage] = useState(1);
  const [forYouHasMore, setForYouHasMore] = useState(true);
  const [followingHasMore, setFollowingHasMore] = useState(true);
  const [followingLoadedOnce, setFollowingLoadedOnce] = useState(false);

  const [feed, setFeed] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [unreadCount, setUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const { user } = useAuth();

  const [isCommentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);





  const fetchFeed = useCallback(async (pageNum: number, shouldRefresh = false) => {
    const currentHasMore = activeTab === 'forYou' ? forYouHasMore : followingHasMore;
    if (!currentHasMore && !shouldRefresh && pageNum !== 1) return;

    if (pageNum === 1) {
      // 1. Try to load from cache first for instant UI
      const cacheKey = `cache_feed_${activeTab}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached && pageNum === 1 && !shouldRefresh) {
        const parsed = JSON.parse(cached);
        if (activeTab === 'forYou') setForYouFeed(parsed);
        else setFollowingFeed(parsed);
        setFeed(parsed);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    
    if (pageNum > 1) setLoadingMore(true);

    try {
      let newPosts: Post[] = [];
      let serverHasMore = true;

      if (activeTab === 'following') {
        const res = await axios.get(`/post/feed/followers?page=${pageNum}&limit=10`);
        if (res.data.success) {
          newPosts = res.data.posts;
          serverHasMore = newPosts.length >= 10;
        }
      } else {
        const seenIds = await getSeenPostIds();
        const res = await axios.post(`/post/smart-feed?page=${pageNum}&limit=10`, {
          seenIds,
        });

        if (res.data.success) {
          newPosts = res.data.posts;
          serverHasMore = res.data.hasMore ?? newPosts.length >= 10;
          if (newPosts.length > 0) markPostsAsSeen(newPosts.map((p: Post) => p._id));
          if (res.data.mode === 'recycled') resetSeenPosts();
        }
      }

      // Update the specific tab state and the active feed
      if (activeTab === 'forYou') {
        const updatedForYou = (shouldRefresh || pageNum === 1) ? newPosts : [...forYouFeed, ...newPosts.filter(p => !forYouFeed.find(fp => fp._id === p._id))];
        setForYouFeed(updatedForYou);
        setForYouHasMore(serverHasMore);
        setForYouPage(pageNum);
        setFeed(updatedForYou);
        setHasMore(serverHasMore);
        setPage(pageNum);
        // Cache the first page
        if (pageNum === 1) AsyncStorage.setItem(`cache_feed_forYou`, JSON.stringify(updatedForYou));
      } else {
        const updatedFollowing = (shouldRefresh || pageNum === 1) ? newPosts : [...followingFeed, ...newPosts.filter(p => !followingFeed.find(fp => fp._id === p._id))];
        setFollowingFeed(updatedFollowing);
        setFollowingHasMore(serverHasMore);
        setFollowingPage(pageNum);
        setFollowingLoadedOnce(true);
        setFeed(updatedFollowing);
        setHasMore(serverHasMore);
        setPage(pageNum);
        // Cache the first page
        if (pageNum === 1) AsyncStorage.setItem(`cache_feed_following`, JSON.stringify(updatedFollowing));
      }
    } catch (error) {
      console.log('Failed to load feed', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [activeTab, forYouFeed, followingFeed, forYouHasMore, followingHasMore]);

  useEffect(() => {
    if (user) {
      setProfileImage(user.avatar);
      
      // Smart Tab Switching Logic
      if (activeTab === 'following' && !followingLoadedOnce) {
        // First time switching to Following - Load it
        setFeed([]); 
        setRefreshing(true);
        checkAndStartSession().then(() => fetchFeed(1, true));
      } else if (activeTab === 'following' && followingLoadedOnce) {
        // Already loaded Following - Use cache
        setFeed(followingFeed);
        setHasMore(followingHasMore);
        setPage(followingPage);
      } else if (activeTab === 'forYou' && forYouFeed.length > 0) {
        // Switching back to For You - Use cache
        setFeed(forYouFeed);
        setHasMore(forYouHasMore);
        setPage(forYouPage);
      } else {
        // Initial Load or For You load
        setRefreshing(true);
        fetchFeed(1, true);
      }
    }
  }, [user, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await Promise.all([
      fetchFeed(1, true),
      fetchBadges()
    ]);
  }, [fetchFeed]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFeed(nextPage);
    }
  }, [loadingMore, hasMore, loading, page, fetchFeed]);

  const fetchBadges = useCallback(async () => {
    try {
      const [notifRes, chatRes] = await Promise.all([
        axios.get('/notifications/count'),
        axios.get('/chat/unread-count')
      ]);
      if (notifRes.data.success) {
        setUnreadCount(notifRes.data.count);
      }
      if (chatRes.data.success) {
        setChatUnreadCount(chatRes.data.count);
      }
    } catch (error) {
      console.log("Badge Error:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBadges();
    }, [])
  );

  useEffect(() => {
    fetchBadges();
  }, []);

  const handleOpenComments = useCallback((postId: string) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  }, []);

  const handleCommentAddedInModal = useCallback((postId: string, newComment: any) => {
    setFeed((currentFeed) =>
      currentFeed.map((post) => {
        if (post._id === postId) {
          const currentCount = post.commentCount || post.comments?.length || 0;
          return {
            ...post,
            comments: post.comments ? [newComment, ...post.comments] : [newComment],
            commentCount: currentCount + 1
          };
        }
        return post;
      })
    );
  }, []);

  const handleDeletePost = useCallback(async (postId: string) => {
    const previousFeed = feed;
    // Optimistic update
    setFeed(prev => prev.filter(p => p._id !== postId));
    
    try {
      const res = await axios.delete(`/post/${postId}`);
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Post deleted successfully' });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      setFeed(previousFeed); // Rollback
      console.log('Failed to delete post', error);
      Toast.show({ type: 'error', text1: 'Failed to delete post' });
    }
  }, [feed]);

  const renderPostItem = useCallback(({ item, index }: { item: Post, index: number }) => (
    <PostItem
      item={item}
      index={index}
      currentUser={user}
      openComments={handleOpenComments}
      onDeletePost={handleDeletePost}
    />
  ), [user, handleOpenComments, handleDeletePost]);



  const renderHeader = () => (
    <View
      style={{ paddingTop: insets.top - 10 }}
      className="flex-row items-center justify-between px-4 bg-transparent z-10 mt-2 pb-2"
    >
      <View className="flex-row items-center py-2 gap-2">
        <Pressable onPress={() => navigation.openDrawer()}>
          <ExpoImage
            source={{ uri: getFullUrl(profileImage) || `https://ui-avatars.com/api/?name=${user?.username}&background=random&color=fff` }}
            style={{ width: 32, height: 32, borderRadius: 999 }}
            className="mr-3 rounded-full border border-gray-100"
            cachePolicy="disk"
          />
        </Pressable>
        <Text className="text-xl font-bold text-zinc-900 tracking-tighter">{`Hi, ${user?.name?.split(" ")[0]}`}</Text>
      </View>

      <View className="flex-row items-center gap-5">
        {/* Streak Display */}
        <TouchableOpacity 
          onPress={() => setShowLeaderboard(true)}
          className="flex-row items-center bg-orange-100 px-3 py-1.5 rounded-full border border-orange-200"
        >
          <MaterialCommunityIcons 
            name="fire" 
            size={20} 
            color={(user as any)?.streakCount > 0 ? "#f97316" : "#f97316"} 
          />
          <Text className={`font-black text-sm ml-1 ${(user as any)?.streakCount > 0 ? "text-orange-600" : "text-orange-400"}`}>
            {(user as any)?.streakCount || 0}
          </Text>
        </TouchableOpacity>

        <Pressable onPress={() => navigation.navigate('SearchScreen')}>
          <Ionicons name="search-outline" size={26} color="#1A1A1A" />
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Notification')}>
          <View>
            <Ionicons name="heart-outline" size={26} color="#1A1A1A" />
            {unreadCount > 0 && (
              <View className="absolute -top-2 -right-2 bg-orange-500 rounded-full w-5 h-5 justify-center items-center border border-white">
                <Text className="text-white text-[10px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('ChatList')}>
          <View>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color="#1A1A1A" />
            {chatUnreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-pink-500 rounded-full w-5 h-5 justify-center items-center border border-white">
                <Text className="text-white text-[10px] font-bold">
                  {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {/* <View className='absolute bg-pink-200 w-48 h-48 rounded-full -right-14 -top-24 -z-10 opacity-40'></View> */}
    </View>
  );

  const renderTabBar = () => (
    <View className="flex-row bg-transparent border-b border-slate-100/10">
      {['For You', 'Following'].map((tabTitle) => {
        const key = tabTitle === 'For You' ? 'forYou' : 'following';
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            onPress={() => setActiveTab(key as any)}
            className="flex-1 items-center pb-2 pt-1"
          >
            <Text className={`text-base font-bold ${isActive ? 'text-zinc-900' : 'text-gray-400'}`}>
              {tabTitle}
            </Text>
            {isActive && <View className="absolute bottom-0 h-0.5 bg-zinc-900 w-1/2 rounded-full" />}
          </Pressable>
        );
      })}
    </View>
  );


  const renderFooter = () => {
    if (!loadingMore) return <View className="h-20" />;
    return (
      <View className="py-4 h-20">
        <ActivityIndicator size="small" color="#ec4899" />
      </View>
    );
  };
  const features = useMemo(() => [
    { id: 'fyncAcademy', name: 'Academy', imageUrl: 'https://i.pinimg.com/736x/5e/4e/cb/5e4ecb34c19b87cfed2053ee96bbf08f.jpg', colorHex: '#8b5cf6', bgClass: 'bg-purple-50', sparkle: true, onPress: () => navigation.navigate('MasterStudyHub') },
    { id: 'internship', name: 'Internship', imageUrl: 'https://i.pinimg.com/736x/21/64/40/2164400be5fa3f7c681354a2df865bc8.jpg', colorHex: '#3b82f6', bgClass: 'bg-blue-50', sparkle: false, onPress: () => navigation.navigate('InternshipList') },
    { id: 'jobs', name: 'Jobs', imageUrl: 'https://i.pinimg.com/736x/f1/97/94/f19794f0bc2872555bcf0a1424a3f090.jpg', colorHex: '#3b82f6', bgClass: 'bg-blue-50', sparkle: false, onPress: () => navigation.navigate('AlumniJobs') },
    { id: 'contest', name: 'Contests', imageUrl: 'https://i.pinimg.com/736x/62/f3/e9/62f3e929d234353e0cf48216012f1331.jpg', colorHex: '#4f46e5', bgClass: 'bg-indigo-50', sparkle: true, onPress: () => navigation.navigate('DSAAndDevelopmentContest') },
    { id: 'utilityHub', name: 'Utilities', Icon: Wrench, colorHex: '#10b981', bgClass: 'bg-emerald-50', sparkle: true, onPress: () => navigation.navigate('UtilityHubScreen') },
    { id: 'partyPool', name: 'Party Pool', imageUrl: 'https://i.pinimg.com/736x/e7/8b/09/e78b09f6adfd51c96062659dff826d03.jpg', colorHex: '#db2777', bgClass: 'bg-pink-50', sparkle: true, onPress: () => navigation.navigate('PartyPool') },
    { id: 'entertainment', name: 'Movies', imageUrl: 'https://i.pinimg.com/736x/30/9f/86/309f86d79b2ca442fa81202ea7c879aa.jpg', colorHex: '#e11d48', bgClass: 'bg-rose-50', sparkle: true, onPress: () => navigation.navigate('EntertainmentHome') },
    { id: 'fyncMedia', name: 'Fync Media', imageUrl: 'https://i.pinimg.com/736x/60/10/f3/6010f333db6714ec3861ec908973d6b1.jpg', colorHex: '#f43f5e', bgClass: 'bg-rose-50', sparkle: false, onPress: () => navigation.navigate('FyncMediaFeed') },
    { id: 'competitions', name: 'Reward', imageUrl: 'https://i.pinimg.com/736x/8b/b1/a4/8bb1a490de08b581618ce6a0e0990122.jpg', colorHex: '#f59e0b', bgClass: 'bg-amber-50', sparkle: false, onPress: () => navigation.navigate('RewardsMarketplace') },
    { id: 'bootcamps', name: 'Bootcamps', imageUrl: 'https://i.pinimg.com/736x/29/c1/be/29c1bea31c35e94c773a7b8f7b599ec0.jpg', colorHex: '#a855f7', bgClass: 'bg-purple-50', sparkle: true, onPress: () => navigation.navigate('BootcampScreen') },
    { id: 'codingLeaderboard', name: 'Leaderboard', imageUrl: 'https://i.pinimg.com/736x/3b/26/26/3b2626a5c5153ac9d0d45673a36ad39a.jpg', colorHex: '#f97316', bgClass: 'bg-orange-50', sparkle: false, onPress: () => navigation.navigate('CodingLeaderboard') },
    { id: 'confessions', name: 'Confessions', imageUrl: 'https://i.pinimg.com/736x/71/29/ca/7129ca1ff74ba44b9dda205b7425cb76.jpg', colorHex: '#14b8a6', bgClass: 'bg-teal-50', sparkle: false, onPress: () => navigation.navigate('ConfessionFeed') },
    { id: 'speakers', name: 'Speakers', imageUrl: 'https://i.pinimg.com/736x/c2/c6/d3/c2c6d3c80febbfabe4b8e263806501d3.jpg', colorHex: '#6366f1', bgClass: 'bg-indigo-50', sparkle: false, onPress: () => navigation.navigate('SpeakerSessionScreen') },
    { id: 'college_clubs', name: 'Clubs', imageUrl: 'https://i.pinimg.com/736x/ed/a3/5a/eda35ac4a08a5c5d6ffade9a94380d78.jpg', colorHex: '#10b981', bgClass: 'bg-emerald-50', sparkle: false, onPress: () => navigation.navigate('ClubList') },
  ], [navigation]);
  const displayedFeatures = useMemo(() => features.slice(0, 6), [features]);
const renderFeatureStories = () => {
  return (
    <View className="bg-white py-2 px-2 w-full">
      {/* Grid Container */}
      <View className="flex-row flex-wrap">
        {features.map((item, index) => (
          <Reanimated.View
            key={item.id}
            entering={FadeIn.delay(index * 50).duration(500)}
            className="w-1/4 p-1.5"
          >
            <Pressable
              onPress={item.onPress}
              className="w-full bg-white rounded-2xl py-3 px-1 flex flex-col items-center justify-start border border-slate-100 h-28"
              style={{
                shadowColor: "#94a3b8",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 2
              }}
            >
              {/* Icon Container with soft background framing */}
              <View className={`rounded-full p-2.5 mb-2 relative flex items-center justify-center ${item.bgClass}`}>
                {item.imageUrl ? (
                  <ExpoImage source={{ uri: item.imageUrl }} style={{ width: 28, height: 28, borderRadius: 8 }} contentFit="cover" />
                ) : (
                  <item.Icon size={24} color={item.colorHex} strokeWidth={1.5} />
                )}
                
                {/* Refined Sparkle badge overlapping the icon container */}
                {item.sparkle && (
                  <View className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-50">
                    <Sparkles size={12} color={item.colorHex} />
                  </View>
                )}
              </View>

              {/* Title shifted to the bottom for better readability */}
              <Text className="text-slate-700 font-medium text-[11px] text-center px-1 leading-tight" numberOfLines={2}>
                {item.name}
              </Text>
            </Pressable>
          </Reanimated.View>
        ))}
      </View>
    </View>
  );
}


  return (
    <View className="flex-1 bg-[#FDFDFF]">
      <StatusBar barStyle="dark-content" />
      
      {renderHeader()}

      <FlatList
        data={feed}
        keyExtractor={(item) => item._id}
        renderItem={renderPostItem}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={
          <View>
            {renderTabBar()}
            <View className="bg-transparent">
              <AdCarousel />
              {renderFeatureStories()}
              {/* <CreatePost /> */}
              {loading && feed.length === 0 && (
                <View>
                  {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
                </View>
              )}
            </View>
          </View>
        }

        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !loading && !refreshing ? (
            <View className="mt-20 flex-1 items-center px-4">
              <ExpoImage
                source={no_post}
                className="h-48 w-[80%]"
                contentFit="contain"
              />
              <Text className="text-xl font-bold text-zinc-900 mt-4">Welcome to Fync!</Text>
              <Text className="text-gray-400 text-center mt-2 px-10">
                Your feed is empty. Start following people or create a post to see updates here.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />

      <CommentsModal
        isVisible={isCommentModalVisible}
        postId={selectedPostId}
        currentUser={user}
        onClose={() => setCommentModalVisible(false)}
        onCommentAdded={handleCommentAddedInModal}
      />

      <StreakLeaderboardModal 
        isVisible={showLeaderboard} 
        onClose={() => setShowLeaderboard(false)} 
      />

    </View>
  );
}
