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
import { LinearGradient } from 'expo-linear-gradient';

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
        className={`flex-row items-center p-3 mb-2 rounded-xl border ${!item.isRead
          ? 'bg-white border-orange-100 shadow-sm'
          : 'bg-white/80 border-slate-50'
          }`}
        onPress={() => handlePress(item)}
      >
        {/* Avatar Section */}
        <View className="relative mr-3">
          <Image
            source={{
              uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}`
            }}
            className="w-10 h-10 rounded-full border border-slate-100"
          />
          {!item.isRead && (
            <View className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
          )}
        </View>

        {/* Text Section */}
        <View className="flex-1">
          <Text className="text-zinc-600 text-[12px] leading-5">
            {item.type === 'opportunity' ? (
              // Opportunity notifications: show full message without username prefix
              <Text className="text-zinc-800 font-bold text-[12px] uppercase ">{message}</Text>
            ) : (
              <>
                <Text className="font-black text-zinc-900 text-[13px] uppercase  tracking-tighter">
                  {item.sender?.username || item.sender?.name || 'Fync'}
                </Text>{' '}{message}
              </>
            )}
          </Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest">
            {getTimeAgo(item.createdAt)}
          </Text>
        </View>

        {/* Right Side: Post Image / Follow Button / Opportunity Icon */}
        {item.type === 'opportunity' ? (
          <View style={{ backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 12, padding: 8 }}>
            <Ionicons name="briefcase" size={18} color="#f97316" />
          </View>
        ) : item.type !== 'follow' && item.post?.image && item.post.image.length > 0 ? (
          <Image
            source={{ uri: item.post.image[0] }}
            className="w-12 h-12 rounded-xl border border-slate-100 ml-2"
          />
        ) : item.type === 'follow' ? (
          <View className="bg-zinc-900 px-4 py-2 rounded-xl ml-2 shadow-sm">
            <Text className="text-white text-[8px] font-black uppercase tracking-widest">Profile</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#f97316', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Arena Header */}
        <View className="px-8 pt-2 bg-transparent">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                  Updates <Text className="text-orange-500">Center</Text>
                </Text>
              </View>
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1px]">System & Social Logs</Text>
            </View>
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View className="flex-1 px-8 pt-6">
            {[1, 2, 3, 4, 5].map(i => (
              <View key={i} className="mb-4 h-24 bg-white rounded-[24px] border border-slate-100 shadow-sm opacity-50" />
            ))}
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={() => (
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Recent transmissions</Text>
            )}
            ListFooterComponent={() => (
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color="#f97316" />
                </View>
              ) : <View className="h-20" />
            )}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20 px-10">
                <View className="w-20 h-20 bg-white rounded-[32px] items-center justify-center mb-6 border border-slate-100 shadow-sm">
                  <Ionicons name="notifications-off-outline" size={32} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-400 font-black  uppercase text-xs tracking-widest text-center">Sync Complete</Text>
                <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center">No active signals found in the registry.</Text>
              </View>
            }
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10 }}
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
