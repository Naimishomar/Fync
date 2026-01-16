import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import CreatePost from './create-post'; 
import axios from '../context/axiosConfig';
// @ts-ignore
import no_post from '../assets/no_post.png';

const { width } = Dimensions.get('window');

// --- TYPES ---
interface Post {
  _id: string;
  user?: {
    _id: string;
    avatar?: string;
    name?: string;
    username?: string;
  };
  createdAt: string;
  image?: string[];
  description: string;
  likes: number;
  liked_by: string[]; 
  comments: any[];
  commentCount?: number; // Added optional field for robustness
  college?: string;
}

// --- SUB-COMPONENT: COMMENTS MODAL ---
// Added onCommentAdded prop
const CommentsModal = ({ isVisible, postId, onClose, currentUser, onCommentAdded }: any) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (isVisible && postId) {
      setLoading(true);
      fetchComments();
    }
  }, [isVisible, postId]);

  const fetchComments = async () => {
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
        
        // Manual population if backend doesn't return it populated
        if (!addedComment.commentor) {
            addedComment.commentor = {
                _id: currentUser._id,
                username: currentUser.username,
                avatar: currentUser.avatar
            };
        }
        
        // 1. Update Modal State
        setComments([addedComment, ...comments]); 
        setNewComment('');

        // 2. Notify Parent (HomeScreen) to update Feed State
        if (onCommentAdded) {
            onCommentAdded(postId, addedComment);
        }
      }
    } catch (error) {
      console.log("Error posting comment", error);
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

// --- SUB-COMPONENT: POST ITEM ---
const PostItem = ({ item, currentUser, openComments }: { item: Post, currentUser: any, openComments: (id: string) => void }) => {
  const [liked, setLiked] = useState(item.liked_by.includes(currentUser?._id));
  const [likeCount, setLikeCount] = useState(item.likes);
  const [resizeMode, setResizeMode] = useState(false);
  const navigation = useNavigation<any>();

  // Calculate comment count safely
  const displayCommentCount = item.commentCount || item.comments?.length || 0;

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
    <View className="bg-black border-b border-t border-gray-800 py-2 mb-5 rounded-md">
      {/* Post Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })}>
          <View className="flex-row items-center">
              <Image source={{ uri: item.user?.avatar || `https://ui-avatars.com/api/?name=${item.user?.username}` }} className="w-9 h-9 rounded-full border border-gray-800" />

            <View className="ml-3">
              <Text className="text-white font-bold text-sm">{item.user?.username || "Unknown"}</Text>
              {item.college && <Text className="text-gray-500 text-[10px] uppercase tracking-wide">{item.college}</Text>}
            </View>
          </View>
        </Pressable>
        <Ionicons name="ellipsis-horizontal" size={20} color="gray" />
      </View>

      {/* Post Image */}
      <Pressable onPress={()=> setResizeMode(prev => !prev)}>
        {item.image && item.image.length > 0 && (
          <Image 
              source={{ uri: item.image[0] }} 
              style={{ width: width, height: width, borderRadius: 5 }} 
              resizeMode={resizeMode ? "contain" : "cover"}
          />
        )}
      </Pressable>

      {/* Caption */}
      <View className="px-3 pt-1 mt-2">
        <Text className="text-white text-sm leading-5">
            <Text className="font-bold text-gray-300">{item.user?.username} </Text>
            {item.description}
        </Text>
      </View>

      {/* Action Bar */}
      <View className="flex-row items-center px-3 pt-2 gap-4">
        <Pressable onPress={handleLike}>
            <Ionicons 
                name={liked ? "heart" : "heart-outline"} 
                size={28} 
                color={liked ? "#ff3040" : "white"} 
            />
        </Pressable>
        
        <Pressable onPress={() => openComments(item._id)}>
            <Ionicons name="chatbubble-outline" size={26} color="white" />
        </Pressable>
        
        <Pressable>
            <Ionicons name="paper-plane-outline" size={26} color="white" style={{ transform: [{ rotate: '-0deg' }], marginTop: -3 }} />
        </Pressable>
        
        <View className="flex-1" />
      </View>

      {/* Likes */}
      <View className="px-3 pt-2">
        <Text className="text-gray-500 font-bold text-sm">{likeCount > 0 ? `${likeCount} likes` : 'Be the first to like'}</Text>
      </View>

      {/* View Comments Link */}
      <Pressable className="px-2 pt-3 pb-1 border-b border-gray-900 mx-3" onPress={() => openComments(item._id)}>
        <Text className="text-gray-500 text-sm">
            {displayCommentCount > 0 
                ? `View all ${displayCommentCount} comments` 
                : "Add a comment..."}
        </Text>
      </Pressable>

      {/* Time */}
      <Text className="px-3 pt-1 text-gray-600 text-xs uppercase">{timeAgo(item.createdAt)} Ago</Text>
    </View>
  );
};

// --- MAIN SCREEN ---
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [profileImage, setProfileImage] = useState<string | undefined>('');
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const [feed, setFeed] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  // Modal State
  const [isCommentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const getFeed = async () => {
    try {
      const endpoint = activeTab === 'forYou' ? '/post/feed' : '/post/feed/followers'; 
      const res = await axios.get(endpoint);
      if (res.data.success) {
        setFeed(res.data.posts);
      }
    } catch (error) {
      console.log('Failed to load feed', error);
    }
  };

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

  useEffect(() => {
    if (user) {
      setProfileImage(user.avatar);
    }
    getFeed();
  }, [user, activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await getFeed();
    setRefreshing(false);
  };

  const handleOpenComments = (postId: string) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  };

  // --- NEW FUNCTION: Update feed state when comment is added in modal ---
  const handleCommentAddedInModal = (postId: string, newComment: any) => {
    setFeed((currentFeed) => 
      currentFeed.map((post) => {
        if (post._id === postId) {
          // Increment comment count and add new comment object to array
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
  };

  const renderHeader = () => (
    <View className="flex-row items-center justify-between px-4 pt-10 pb-2 bg-black border-b border-gray-900/50">
      <View className="flex-row items-center">
        <Pressable onPress={() => navigation.openDrawer()}>
          <Image
            source={{ uri: profileImage || `https://ui-avatars.com/api/?name=${user?.username}&background=random&color=fff` }}
            className="mr-3 h-9 w-9 rounded-full border border-gray-700"
          />
        </Pressable>
        <Text className="text-2xl font-bold text-white tracking-tighter italic">Fync</Text>
      </View>

      <View className="flex-row items-center gap-6">
        <Pressable onPress={()=> navigation.navigate('SearchScreen')}>
          <Ionicons name="search-outline" size={26} color="white"/>
        </Pressable>
        <Pressable onPress={()=> navigation.navigate('Notification')}>
          {/* <Text className="text-white absolute top-0 right-0 bg-pink-600 h-4 w-4 px-2 py-1 rounded-full">{unreadCount}</Text> */}
          <View>
            <Ionicons name="heart-outline" size={26} color="white" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-pink-500 rounded-full w-4 h-4 justify-center items-center border border-black">
                <Text className="text-white text-xs font-light">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
          {/* <Ionicons name="notifications-outline" size={26} color="white" /> */}
        </Pressable>
        <Pressable onPress={()=> navigation.navigate('ChatList')}>
          <Ionicons name="chatbubble-ellipses-outline" size={26} color="white" />
        </Pressable>
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View className="flex-row pt-2 bg-black border-b border-gray-900">
      {['For You', 'Following'].map((tabTitle) => {
        const key = tabTitle === 'For You' ? 'forYou' : 'following';
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            onPress={() => setActiveTab(key as any)}
            className="flex-1 items-center pb-2"
          >
            <Text className={`text-base font-bold ${isActive ? 'text-white' : 'text-gray-500'}`}>
              {tabTitle}
            </Text>
            {isActive && <View className="absolute bottom-0 h-0.5 bg-white w-1/4 rounded-full" />}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      {renderHeader()}
      
      <FlatList
        data={feed}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
            <PostItem 
                item={item} 
                currentUser={user} 
                openComments={handleOpenComments} 
            />
        )}
        ListHeaderComponent={
          <View>
            {renderTabBar()}
            <View className="bg-black py-2">
                <CreatePost /> 
            </View>
          </View>
        }
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
        ListEmptyComponent={
            !refreshing ? (
                <View className="mt-20 flex-1 items-center px-4">
                    <Image source={no_post} className="h-48 w-[80%]" resizeMode="contain" />
                    <Text className="text-xl font-bold text-white mt-4">Welcome to Fync!</Text>
                    <Text className="text-gray-500 text-center mt-2 px-10">
                        Your feed is empty. Start following people or create a post to see updates here.
                    </Text>
                </View>
            ) : null
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Comments Modal with Callback */}
      <CommentsModal 
        isVisible={isCommentModalVisible}
        postId={selectedPostId}
        currentUser={user}
        onClose={() => setCommentModalVisible(false)}
        onCommentAdded={handleCommentAddedInModal} // <--- Passed callback here
      />
    </View>
  );
}