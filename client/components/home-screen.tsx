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
  DeviceEventEmitter
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Layout, FadeIn, FadeOut } from 'react-native-reanimated';
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

const { width } = Dimensions.get('window');


// --- TYPES ---
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
          source={{ uri: comment.commentor?.avatar || `https://ui-avatars.com/api/?name=${comment.commentor?.username}` }}
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              <View className="flex-row items-center">
                <ExpoImage
                  source={{ uri: currentUser?.avatar || `https://ui-avatars.com/api/?name=${currentUser?.username}` }}
                  style={{ width: 40, height: 40, borderRadius: 999 }}
                  className="rounded-full mr-3"
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
const PostItem = memo(({ item, currentUser, openComments, onDeletePost }: { item: Post, currentUser: any, openComments: (id: string) => void, onDeletePost: (id: string) => void }) => {
  const [liked, setLiked] = useState(item.liked_by.includes(currentUser?._id));
  const [likeCount, setLikeCount] = useState(item.likes);
  const [resizeMode, setResizeMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_CHAR_LIMIT = 150; 

  const navigation = useNavigation<any>();

  const displayCommentCount = item.commentCount || item.comments?.length || 0;
  const images = item.image || [];

  const handleLike = async () => {
    const previousState = liked;
    const previousCount = likeCount;
    setLiked(!previousState);
    setLikeCount(previousState ? previousCount - 1 : previousCount + 1);
    try {
      await axios.post(`/post/like/${item._id}`);
    } catch (error) {
      console.log("Like failed", error);
      setLiked(previousState);
      setLikeCount(previousCount);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

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

  const handleShare = async () => {
    try {
      const shareUrl = `https://fync.app/view?postId=${item._id}`;
      const playStoreUrl = "https://play.google.com/store/apps/details?id=com.fync.app"; 

      await Share.share({
        message: `Check out this post by ${item.user?.username} on Fync!\n\n${item.description || ''}\n\nView post: ${shareUrl}\n\nDon't have Fync? Download it here: ${playStoreUrl}`,
      });
    } catch (error: any) {
      console.log('Share error:', error.message);
    }
  };

  return (
    <View className="bg-white border-b border-gray-100 py-2 mb-3 shadow-sm shadow-black/5">
      {/* Post Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })}>
          <View className="flex-row items-center">
            <Avatar 
              user={item.user as any} 
              size={36} 
            />
            <View className="ml-3">
              <Text className="text-zinc-900 font-bold text-sm">{item.user?.username || "Unknown"}</Text>
              {item.college && <Text className="text-gray-400 text-[10px] uppercase tracking-wide">{item.college}</Text>}
            </View>
          </View>
        </Pressable>
        {currentUser && currentUser._id === item.user?._id && (
          <Pressable onPress={() => {
            Alert.alert(
              "Delete Post",
              "Are you sure you want to delete this post?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => onDeletePost(item._id) }
              ]
            );
          }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="gray" />
          </Pressable>
        )}
      </View>

      {/* --- CAROUSEL IMAGE SECTION --- */}
      <View>
        <FlatList
          data={images}
          keyExtractor={(url, index) => `${item._id}-img-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item: imageUrl }) => (
            <Pressable onPress={() => setResizeMode(prev => !prev)}>
              <ExpoImage
                source={{ uri: imageUrl }}
                style={{ width: width, height: width, borderRadius: 5 }}
                contentFit={resizeMode ? "contain" : "cover"}
                cachePolicy="disk"
                transition={200}
              />
            </Pressable>
          )}
        />

        {/* Image Counter */}
        {images.length > 1 && (
          <View className="absolute top-3 right-3 bg-white/80 px-3 py-1 rounded-full border border-gray-200">
            <Text className="text-zinc-900 text-xs font-bold">
              {activeIndex + 1}/{images.length}
            </Text>
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
            <Text
              onPress={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 font-semibold"
            >
              {isExpanded ? " show less" : " show more"}
            </Text>
          )}
        </Text>
      </View>

      {/* Action Bar */}
      <View className="flex-row items-center px-3 pt-2 gap-4">
        <Pressable onPress={handleLike}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={28}
            color={liked ? "#ff3040" : "#1A1A1A"}
          />
        </Pressable>
        <Pressable onPress={() => openComments(item._id)}>
          <Ionicons name="chatbubble-outline" size={26} color="#1A1A1A" />
        </Pressable>
        <Pressable onPress={handleShare}>
          <Ionicons name="paper-plane-outline" size={26} color="#1A1A1A" style={{ transform: [{ rotate: '-0deg' }], marginTop: -3 }} />
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

// --- MAIN SCREEN ---
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [profileImage, setProfileImage] = useState<string | undefined>('');
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');

  const [feed, setFeed] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const [isCommentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);





  const fetchFeed = useCallback(async (pageNum: number, shouldRefresh = false) => {
    if (!hasMore && !shouldRefresh && pageNum !== 1) return;

    if (pageNum === 1) setLoading(true);
    if (pageNum > 1) setLoadingMore(true);

    try {
      if (activeTab === 'following') {
        const res = await axios.get(`/post/feed/followers?page=${pageNum}&limit=10`);
        if (res.data.success) {
          const newPosts = res.data.posts;
          if (shouldRefresh || pageNum === 1) setFeed(newPosts);
          else setFeed(prev => {
            const ids = new Set(prev.map(p => p._id));
            return [...prev, ...newPosts.filter((p: Post) => !ids.has(p._id))];
          });
          setHasMore(newPosts.length >= 10);
        }
        return;
      }

      const seenIds = await getSeenPostIds();
      const res = await axios.post(`/post/smart-feed?page=${pageNum}&limit=10`, {
        seenIds,
      });

      if (res.data.success) {
        const newPosts = res.data.posts;

        if (shouldRefresh || pageNum === 1) {
          setFeed(newPosts);
        } else {
          setFeed(prev => {
            const existingIds = new Set(prev.map(p => p._id));
            const uniqueNew = newPosts.filter((p: Post) => !existingIds.has(p._id));
            return [...prev, ...uniqueNew];
          });
        }

        setHasMore(res.data.hasMore ?? newPosts.length >= 10);

        if (newPosts.length > 0) {
          markPostsAsSeen(newPosts.map((p: Post) => p._id));
        }

        if (res.data.mode === 'recycled') {
          resetSeenPosts();
        }
      }
    } catch (error) {
      console.log('Failed to load feed', error);
      try {
        const res = await axios.get(`/post/feed?page=${pageNum}&limit=10`);
        if (res.data.success) {
          const newPosts = res.data.posts;
          if (shouldRefresh || pageNum === 1) setFeed(newPosts);
          else setFeed(prev => [...prev, ...newPosts]);
          setHasMore(newPosts.length >= 10);
        }
      } catch { /* silent */ }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [activeTab, hasMore]);

  useEffect(() => {
    if (user) {
      setProfileImage(user.avatar);
      setPage(1);
      setHasMore(true);
      checkAndStartSession().then(() => {
        fetchFeed(1, true);
      });
    }
  }, [user, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await fetchFeed(1, true);
  }, [fetchFeed]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFeed(nextPage);
    }
  }, [loadingMore, hasMore, loading, page, fetchFeed]);

  useFocusEffect(
    useCallback(() => {
      const getCount = async () => {
        try {
          const res = await axios.get('/notifications/count');
          if (res.data.success) {
            setUnreadCount(res.data.count);
          }
        } catch (error) {
          console.log("Badge Error:", error);
        }
      };
      getCount();
    }, [])
  );

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
    try {
      const res = await axios.delete(`/post/${postId}`);
      if (res.data.success) {
        setFeed(prev => prev.filter(p => p._id !== postId));
        Toast.show({ type: 'success', text1: 'Post deleted successfully' });
      }
    } catch (error) {
      console.log('Failed to delete post', error);
      Toast.show({ type: 'error', text1: 'Failed to delete post' });
    }
  }, []);



  const renderHeader = () => (
    <View 
      style={{ paddingTop: insets.top }}  
      className="flex-row items-center justify-between px-4 bg-white border-b border-gray-100 shadow-sm"
    >
      <View className="flex-row items-center py-2 gap-2">
        <Pressable onPress={() => navigation.openDrawer()}>
          <ExpoImage
            source={{ uri: profileImage || `https://ui-avatars.com/api/?name=${user?.username}&background=random&color=fff` }}
            style={{ width: 32, height: 32, borderRadius: 999 }}
            className="mr-3 rounded-full border border-gray-100"
            cachePolicy="disk"
          />
        </Pressable>
        <Text className="text-2xl font-bold text-zinc-900 tracking-tighter italic">Fync</Text>
      </View>

      <View className="flex-row items-center gap-5">
        <Pressable onPress={() => navigation.navigate('PayAndSplitHome')}>
          <Ionicons name="qr-code-outline" size={26} color="#1A1A1A" />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('SearchScreen')}>
          <Ionicons name="search-outline" size={26} color="#1A1A1A" />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Notification')}>
          <View>
            <Ionicons name="heart-outline" size={26} color="#1A1A1A" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-pink-500 rounded-full w-4 h-4 justify-center items-center border border-white">
                <Text className="text-white text-[10px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('ChatList')}>
          <Ionicons name="chatbubble-ellipses-outline" size={26} color="#1A1A1A" />
        </Pressable>
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View className="flex-row bg-white border-b border-gray-100 mt-0">
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
            {isActive && <View className="absolute bottom-0 h-0.5 bg-zinc-900 w-1/4 rounded-full" />}
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
    { id: 'jobs', name: 'Alumni Jobs', icon: 'business-outline', color: '#f87171', onPress: () => navigation.navigate('AlumniJobs') },
    { id: 'professional_hub', name: 'Mentor Hub', icon: 'briefcase-outline', color: '#3b82f6', onPress: () => navigation.navigate('ProfessionalHub') },
    { id: 'events', name: 'Speaker Hub', icon: 'mic-outline', color: '#ec4899', onPress: () => navigation.navigate('SpeakerSessionScreen') },
    { id: 'bootcamp', name: 'Bootcamp', icon: 'rocket-outline', color: '#6366f1', onPress: () => navigation.navigate('BootcampScreen') },

    { id: 'alumni', name: 'Alumni', icon: 'school-outline', color: '#f9a8d4', onPress: () => navigation.navigate('FindAlumni') },
  ], [user, navigation]);

  const displayedFeatures = useMemo(() => features.slice(0, 6), [features]);

  const renderFeatureStories = () => {
    return (
      <Animated.View
        layout={Layout.duration(400).springify().damping(20).stiffness(90)}
        className="bg-white py-4 border-b border-gray-200 px-2 overflow-hidden rounded-2xl mt-3 mx-3 shadow-sm shadow-black/5"
      >
        <Animated.View
          layout={Layout}
          className="flex-row flex-wrap justify-between"
        >
          {displayedFeatures.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeIn.delay(index * 20)}
              className="items-center"
              style={{ width: '20%' }}
            >
              <Pressable onPress={item.onPress}>
                <View
                  className="w-14 h-14 rounded-full items-center justify-center border border-gray-100 bg-gray-50"
                >
                  <View className="w-12 h-12 rounded-full bg-white items-center justify-center shadow-sm shadow-black/10">
                    <Ionicons name={item.icon as any} size={20} color={item.color || "#1A1A1A"} />
                  </View>
                </View>
              </Pressable>
              <Text className="text-zinc-600 text-[9px] mt-2 font-bold text-center px-1" numberOfLines={1}>
                {item.name}
              </Text>
            </Animated.View>
          ))}
        </Animated.View>
      </Animated.View>
    );
  };


  return (
    <View className="flex-1 bg-[#F5F7FA]">
      {renderHeader()}

      <FlatList
        data={feed}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <PostItem
            item={item}
            currentUser={user}
            openComments={handleOpenComments}
            onDeletePost={handleDeletePost}
          />
        )}
        ListHeaderComponent={
          <View>
            {renderTabBar()}
            <View className="bg-[#F5F7FA]">
              <AdCarousel />
              {renderFeatureStories()}
              <CreatePost />
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

    </View>
  );
}