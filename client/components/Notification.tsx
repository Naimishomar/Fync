import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Platform,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import { NotificationSkeleton } from './Skeleton';

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
  shorts?: {
    _id: string;
  };
  message?: string;
  commentText?: string;
  hackathon?: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt: string;
}

const Notification = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Cursor paging: onEndReached fires repeatedly while the list settles, and
  // state updates land a render too late to stop the second call. A ref does.
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  // --- FETCH NOTIFICATIONS ---
  const fetchNotifications = useCallback(async (append: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (append) setLoadingMore(true);

    try {
      const cursor = append ? cursorRef.current : null;
      const response = await axios.get('/notifications', {
        params: { limit: 20, ...(cursor ? { cursor } : {}) },
      });

      if (response.data.success) {
        const incoming: NotificationItem[] = response.data.notifications || [];
        cursorRef.current = response.data.nextCursor ?? null;
        setHasMore(Boolean(response.data.hasMore));

        if (append) {
          // The server pages on (createdAt, _id) so overlap is not expected,
          // but a duplicate key would crash the FlatList rather than fail quietly.
          setNotifications(prev => {
            const seen = new Set(prev.map(x => x._id));
            return [...prev, ...incoming.filter(x => !seen.has(x._id))];
          });
        } else {
          setNotifications(incoming);
          markAsRead(incoming);
        }
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  // Mark read only as far back as the user actually received, and reflect it
  // locally -- the old version fired and forgot, so every row kept its unread
  // dot until the screen was reopened.
  const markAsRead = async (loaded: NotificationItem[]) => {
    const oldest = loaded[loaded.length - 1];
    if (!oldest) return;
    try {
      await axios.put('/notifications/read', { upTo: oldest._id });
      setNotifications(prev => prev.map(x => ({ ...x, isRead: true })));
    } catch (error) {
      console.error("Error marking read:", error);
    }
  };

  useEffect(() => {
    fetchNotifications(false);
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    cursorRef.current = null;
    setHasMore(true);
    fetchNotifications(false);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) fetchNotifications(true);
  };


  // --- HANDLERS ---
  const handlePress = (item: NotificationItem) => {
    if (item.type === 'follow') {
      navigation.navigate('PublicProfile', { userId: item.sender?._id, user: item.sender });
      return;
    }
    if (item.type === 'broadcast') return;
    if (item.hackathon) {
      navigation.navigate('HackathonDetail', { hackathonId: item.hackathon });
      return;
    }
    const contentId = item.post?._id || item.shorts?._id;
    if (contentId) {
      navigation.navigate('IndividualPostOrShort', { postId: contentId });
      return;
    }
    if (item.sender?._id) {
      navigation.navigate('PublicProfile', { userId: item.sender._id, user: item.sender });
    }
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }: { item: NotificationItem }) => {
    let message = '';
    let iconName: any = 'notifications';
    let iconColor = '#fff';
    let iconBg = '#EDE8E0';

    switch (item.type) {
      case 'follow':
        message = 'started following you.';
        iconName = 'person-add';
        iconColor = '#2563EB'; // blue-400
        iconBg = 'rgba(96, 165, 250, 0.2)';
        break;
      case 'tag':
        message = 'tagged you in a post.';
        iconName = 'at';
        iconColor = '#7C3AED'; // purple-500
        iconBg = 'rgba(168, 85, 247, 0.2)';
        break;
      case 'like':
        message = 'liked your post.';
        iconName = 'heart';
        iconColor = '#DB2777'; // rose-500
        iconBg = 'rgba(244, 63, 94, 0.2)';
        break;
      case 'comment':
        message = `commented: "${item.commentText || 'Nice!'}"`;
        iconName = 'chatbubble';
        iconColor = '#047857'; // emerald-400
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'story_comment':
        message = `commented: "${item.commentText || 'Nice!'} on your shorts"`;
        iconName = 'chatbubble';
        iconColor = '#047857'; // emerald-400
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'story_like':
        message = 'liked your shorts.';
        iconName = 'heart-circle';
        iconColor = '#B45309'; // amber-400
        iconBg = 'rgba(251, 191, 36, 0.2)';
        break;
      case 'split_request':
        message = item.commentText || 'requested a split payment.';
        iconName = 'wallet';
        iconColor = '#F5B700'; // yellow-400
        iconBg = 'rgba(250, 204, 21, 0.2)';
        break;
      case 'split_paid':
        message = item.commentText || 'paid their debt.';
        iconName = 'cash';
        iconColor = '#047857'; // emerald-400
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'broadcast':
        message = item.message || 'sent an announcement.';
        iconName = 'megaphone';
        iconColor = '#F97316';
        iconBg = 'rgba(249, 115, 22, 0.15)';
        break;
      case 'hackathon_announcement':
        message = item.message || 'posted a hackathon announcement.';
        iconName = 'megaphone';
        iconColor = '#F97316';
        iconBg = 'rgba(249, 115, 22, 0.15)';
        break;
      case 'reply':
      case 'college_reply':
        message = item.commentText ? `replied: "${item.commentText}"` : 'replied to you.';
        iconName = 'return-down-forward';
        iconColor = '#0891B2';
        iconBg = 'rgba(56, 189, 248, 0.2)';
        break;
      case 'opportunity':
        message = item.message || 'sent you an opportunity update.';
        iconName = 'briefcase';
        iconColor = '#F97316';
        iconBg = 'rgba(236, 72, 153, 0.15)';
        break;
      default:
        // Fallback: always show backend message if available
        message = item.message || item.commentText || 'sent you a notification.';
        iconName = 'notifications';
        iconColor = '#7C3AED';
        iconBg = 'rgba(168, 85, 247, 0.15)';
        break;
    }

    return (
      <Pressable
        className={`flex-row items-center p-3 mb-2 rounded-xl border ${!item.isRead ? 'bg-card border-line shadow-hair' : 'bg-card/80 border-line' }`}
        onPress={() => handlePress(item)}
      >
        {/* Avatar Section */}
        <View className="relative mr-3">
          <Image
            source={{
              uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}`
            }}
            className="w-10 h-10 rounded-full border border-line"
          />
          {!item.isRead && (
            <View className="absolute -top-1 -right-1 w-3 h-3 bg-brand-500 rounded-full border-2 border-card" />
          )}
        </View>

        {/* Text Section */}
        <View className="flex-1">
          <Text className="font-sans text-sm text-ink-2">
            {item.type === 'opportunity' || item.type === 'hackathon_announcement' || item.type === 'broadcast' ? (
              // Opportunity notifications: show full message without username prefix
              <Text className="font-semibold text-base text-ink">{message}</Text>
            ) : (
              <>
                <Text className="font-semibold text-base text-ink">
                  {item.sender?.username || item.sender?.name || 'Fync'}
                </Text>{' '}{message}
              </>
            )}
          </Text>
          <Text className="font-display text-label text-ink-3 uppercase">
            {getTimeAgo(item.createdAt)}
          </Text>
        </View>

        {/* Right Side: Post Image / Follow Button / Opportunity Icon */}
        {item.type === 'broadcast' && item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} className="w-12 h-12 rounded-xl border border-line ml-2" />
        ) : item.type === 'opportunity' || item.type === 'hackathon_announcement' || item.type === 'broadcast' ? (
          <View style={{ backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 12, padding: 8 }}>
            <Ionicons name={item.type === 'broadcast' ? 'megaphone' : 'briefcase'} size={18} color="#F97316" />
          </View>
        ) : item.type !== 'follow' && item.post?.image && item.post.image.length > 0 ? (
          <Image
            source={{ uri: item.post.image[0] }}
            className="w-12 h-12 rounded-xl border border-line ml-2"
          />
        ) : item.type === 'follow' ? (
          <View className="bg-ink ml-2 px-2.5 py-1 rounded-full">
            <Text className="text-white text-label font-display uppercase">Profile</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Arena Header */}
        <View className="px-gutter pt-4 bg-transparent">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-1">
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  className="w-11 h-11 items-center justify-center rounded-xl"
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  style={{ marginLeft: -11 }}
                >
                  <Ionicons name="arrow-back" size={24} color="#12100E" />
                </TouchableOpacity>
                <Text className="font-display text-ink uppercase text-display" style={{ letterSpacing: -1.2 }}>
                  Updates <Text className="text-accent-text">Center</Text>
                </Text>
              </View>
              <Text className="font-display text-label text-ink-3 uppercase">System & Social Logs</Text>
            </View>
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View className="flex-1 px-6 pt-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <NotificationSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={() => (
              <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                <Text className="text-ink-3 text-label font-display uppercase">Recent transmissions</Text>
                <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
              </View>
            )}
            ListFooterComponent={() => (
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color="#F97316" />
                </View>
              ) : <View className="h-20" />
            )}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="notifications-off-outline" size={32} color="#C4BEB6" />
                </View>
                <Text className="font-semibold text-base text-ink text-center">Sync Complete</Text>
                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">No active signals found in the registry.</Text>
              </View>
            }
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}
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
