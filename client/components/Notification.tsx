import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';

// --- TYPES ---
interface NotificationItem {
  _id: string;
  type: 'follow' | 'tag' | 'like' | 'comment' | 'story_like' | 'story_comment' | 'split_request' | 'split_paid' | 'opportunity' | string;
  sender: {
    _id: string;
    username: string;
    avatar: string;
    name?: string;
  };
  post?: {
    _id: string;
    image?: string[];
  };
  message?: string;
  commentText?: string;
  isRead: boolean;
  createdAt: string;
}

const Notification = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);


  // --- FETCH NOTIFICATIONS ---
  const fetchNotifications = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    if (pageNum > 1) setLoadingMore(true);
    else if (!refreshing) setLoading(true);

    try {
      const response = await axios.get(`/notifications?page=${pageNum}&limit=20`);
      if (response.data.success) {
        const newNotifications = response.data.notifications;
        if (shouldAppend) {
          setNotifications(prev => [...prev, ...newNotifications]);
        } else {
          setNotifications(newNotifications);
          markAsRead();
        }

        const pagination = response.data.pagination;
        if (pagination) {
          setHasMore(pagination.page < pagination.pages);
          setPage(pagination.page);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };


  const markAsRead = async () => {
    try {
      await axios.put('/notifications/read');
    } catch (error) {
      console.error("Error marking read:", error);
    }
  };

  useEffect(() => {
    fetchNotifications(1, false);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchNotifications(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchNotifications(page + 1, true);
    }
  };


  // --- HANDLERS ---
  const handlePress = (item: NotificationItem) => {
    if (item.type === 'follow') {
      navigation.navigate('PublicProfile', { user: item.sender });
    } else if (item.post) {
      navigation.navigate('Profile');
    }
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }: { item: NotificationItem }) => {
    let message = '';
    let iconName: any = 'notifications';
    let iconColor = '#fff';
    let iconBg = '#333';

    switch (item.type) {
      case 'follow':
        message = 'started following you.';
        iconName = 'person-add';
        iconColor = '#60a5fa'; // blue-400
        iconBg = 'rgba(96, 165, 250, 0.2)';
        break;
      case 'tag':
        message = 'tagged you in a post.';
        iconName = 'at';
        iconColor = '#a855f7'; // purple-500
        iconBg = 'rgba(168, 85, 247, 0.2)';
        break;
      case 'like':
        message = 'liked your post.';
        iconName = 'heart';
        iconColor = '#f43f5e'; // rose-500
        iconBg = 'rgba(244, 63, 94, 0.2)';
        break;
      case 'comment':
        message = `commented: "${item.commentText || 'Nice!'}"`;
        iconName = 'chatbubble';
        iconColor = '#34d399'; // emerald-400
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'story_comment':
        message = `commented: "${item.commentText || 'Nice!'} on your shorts"`;
        iconName = 'chatbubble';
        iconColor = '#34d399'; // emerald-400
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'story_like':
        message = 'liked your shorts.';
        iconName = 'heart-circle';
        iconColor = '#fbbf24'; // amber-400
        iconBg = 'rgba(251, 191, 36, 0.2)';
        break;
      case 'split_request':
        message = item.commentText || 'requested a split payment.';
        iconName = 'wallet';
        iconColor = '#facc15'; // yellow-400
        iconBg = 'rgba(250, 204, 21, 0.2)';
        break;
      case 'split_paid':
        message = item.commentText || 'paid their debt.';
        iconName = 'cash';
        iconColor = '#34d399'; // emerald-400
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'opportunity':
        message = item.message || 'sent you an opportunity update.';
        iconName = 'briefcase';
        iconColor = '#ec4899'; // pink-500
        iconBg = 'rgba(236, 72, 153, 0.15)';
        break;
      default:
        // Fallback: always show backend message if available
        message = item.message || item.commentText || 'sent you a notification.';
        iconName = 'notifications';
        iconColor = '#a855f7';
        iconBg = 'rgba(168, 85, 247, 0.15)';
        break;
    }

    return (
      <Pressable
        className={`flex-row items-center py-4 px-4 mb-3 mx-4 rounded-2xl border ${!item.isRead
          ? 'bg-white border-pink-100 shadow-sm'
          : 'bg-white/80 border-gray-100'
          }`}
        onPress={() => handlePress(item)}
      >
        {/* Avatar Section */}
        <View className="relative mr-3">
          <Image
            source={{
              uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}`
            }}
            className="w-12 h-12 rounded-full border border-gray-100"
          />
          {!item.isRead && (
            <View className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full border-2 border-white" />
          )}
        </View>

        {/* Text Section */}
        <View className="flex-1">
          <Text className="text-zinc-600 text-[13px] leading-5">
            {item.type === 'opportunity' ? (
              // Opportunity notifications: show full message without username prefix
              <Text className="text-zinc-800 text-[13px]">{message}</Text>
            ) : (
              <>
                <Text className="font-bold text-zinc-900 text-[14px]">
                  {item.sender?.username || item.sender?.name || 'Fync'}
                </Text>{' '}{message}
              </>
            )}
          </Text>
          <Text className="text-gray-400 text-[10px] mt-1 font-bold uppercase tracking-wider">
            {getTimeAgo(item.createdAt)}
          </Text>
        </View>

        {/* Right Side: Post Image / Follow Button / Opportunity Icon */}
        {item.type === 'opportunity' ? (
          <View style={{ backgroundColor: 'rgba(236,72,153,0.12)', borderRadius: 10, padding: 8 }}>
            <Ionicons name="briefcase" size={18} color="#ec4899" />
          </View>
        ) : item.type !== 'follow' && item.post?.image && item.post.image.length > 0 ? (
          <Image
            source={{ uri: item.post.image[0] }}
            className="w-12 h-12 rounded-lg border border-gray-100 ml-2"
          />
        ) : item.type === 'follow' ? (
          <View className="bg-pink-500 px-3 py-1.5 rounded-full ml-2">
            <Text className="text-white text-[10px] font-bold uppercase tracking-tighter">Profile</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-[#F5F7FA]">
      <StatusBar barStyle="dark-content" />
      
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-4 pb-4 flex flex-row items-center">
          <Pressable onPress={() => navigation.goBack()} className="p-2 bg-white rounded-full mr-1 border border-gray-100">
            <Ionicons name="arrow-back" size={20} color="#18181b" />
          </Pressable>
          <Text className="text-zinc-900 text-2xl font-black tracking-tighter">Notifications</Text>
        </View>

        {/* List */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#ec4899" />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => (
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color="#ec4899" />
                </View>
              ) : <View className="h-20" />
            )}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center mt-6 px-10">
                <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-2 shadow-sm border border-gray-100">
                  <Ionicons name="notifications-off-outline" size={36} color="#9ca3af" />
                </View>
                <Text className="text-zinc-900 text-xl font-black">All caught up!</Text>
                <Text className="text-gray-500 text-sm mt-2 text-center font-medium">No new notifications at the moment. Check back later!</Text>
              </View>
            }
            contentContainerStyle={{ paddingTop: 16 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

// --- HELPER FUNCTION: Time Ago ---
const getTimeAgo = (dateString: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default Notification;