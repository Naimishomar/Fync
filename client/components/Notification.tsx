import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Platform,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import { NotificationSkeleton } from './Skeleton';
import { C, themed } from '../constants/colors';
import { AppBar, Button, Empty } from './ui/kit';
import { withTimeHeaders, HeaderRow } from '../utils/timeBuckets';

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
  /** Set on a confession tag; the sender is then the recipient themself. */
  confession?: string;
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
  const [loadError, setLoadError] = useState(false);

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
        if (!append) setLoadError(false);
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
      if (!append) setLoadError(true);
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
    if (item.type === 'tag' && item.confession) {
      navigation.navigate('ConfessionFeed');
      return;
    }
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

  // Today / This week / Earlier header rows interleaved into the list data,
  // so paging and refresh keep working on the plain notifications array.
  const rows = useMemo(() => withTimeHeaders(notifications), [notifications]);

  // --- RENDER ITEM ---
  const renderItem = useCallback(({ item: row }: { item: NotificationItem | HeaderRow }) => {
    if ('kind' in row) {
      return (
        <Text className="text-ink-3 text-label font-display uppercase mt-3 mb-2" accessibilityRole="header">
          {row.label}
        </Text>
      );
    }
    const item = row;
    let message = '';
    let iconName: any = 'notifications';
    let iconColor = '#fff';
    let iconBg = C.paper2;
    // Anonymous: never name or picture the sender of a confession tag.
    const anonymous = item.type === 'tag' && !!item.confession;

    switch (item.type) {
      case 'follow':
        message = 'started following you.';
        iconName = 'person-add';
        iconColor = C.fam.career;
        iconBg = 'rgba(96, 165, 250, 0.2)';
        break;
      case 'tag':
        message = anonymous ? 'Someone confessed about you' : 'tagged you in a post.';
        iconName = 'at';
        iconColor = C.fam.study;
        iconBg = 'rgba(168, 85, 247, 0.2)';
        break;
      case 'like':
        message = 'liked your post.';
        iconName = 'heart';
        iconColor = C.fam.fun;
        iconBg = 'rgba(244, 63, 94, 0.2)';
        break;
      case 'comment':
        message = `commented: "${item.commentText || 'Nice!'}"`;
        iconName = 'chatbubble';
        iconColor = C.success;
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'story_comment':
        message = `commented: "${item.commentText || 'Nice!'} on your shorts"`;
        iconName = 'chatbubble';
        iconColor = C.success;
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'story_like':
        message = 'liked your shorts.';
        iconName = 'heart-circle';
        iconColor = C.warning;
        iconBg = 'rgba(251, 191, 36, 0.2)';
        break;
      case 'split_request':
        message = item.commentText || 'requested a split payment.';
        iconName = 'wallet';
        iconColor = C.alumniLit;
        iconBg = 'rgba(250, 204, 21, 0.2)';
        break;
      case 'split_paid':
        message = item.commentText || 'paid their debt.';
        iconName = 'cash';
        iconColor = C.success;
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'broadcast':
        message = item.message || 'sent an announcement.';
        iconName = 'megaphone';
        iconColor = C.brand[500];
        iconBg = 'rgba(249, 115, 22, 0.15)';
        break;
      case 'hackathon_announcement':
        message = item.message || 'posted a hackathon announcement.';
        iconName = 'megaphone';
        iconColor = C.brand[500];
        iconBg = 'rgba(249, 115, 22, 0.15)';
        break;
      case 'reply':
      case 'college_reply':
        message = item.commentText ? `replied: "${item.commentText}"` : 'replied to you.';
        iconName = 'return-down-forward';
        iconColor = C.fam.social;
        iconBg = 'rgba(56, 189, 248, 0.2)';
        break;
      case 'opportunity':
        message = item.message || 'sent you an opportunity update.';
        iconName = 'briefcase';
        iconColor = C.brand[500];
        iconBg = 'rgba(236, 72, 153, 0.15)';
        break;
      default:
        // Fallback: always show backend message if available
        message = item.message || item.commentText || 'sent you a notification.';
        iconName = 'notifications';
        iconColor = C.fam.study;
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
          {anonymous ? (
            <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person" size={18} color={C.ink3} />
            </View>
          ) : (
          <ExpoImage
            source={{
              uri: item.sender?.avatar || `https://ui-avatars.com/api/?name=${item.sender?.username || 'Fync'}`
            }}
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line }}
            cachePolicy="memory-disk"
          />
          )}
          {!item.isRead && (
            <View className="absolute -top-1 -right-1 w-3 h-3 bg-brand-500 rounded-full border-2 border-card" />
          )}
        </View>

        {/* Text Section */}
        <View className="flex-1">
          {/* Capped: a long comment used to stretch one row over half the screen. */}
          <Text className="font-sans text-sm text-ink-2" numberOfLines={3}>
            {anonymous || item.type === 'opportunity' || item.type === 'hackathon_announcement' || item.type === 'broadcast' ? (
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
          <ExpoImage source={{ uri: item.imageUrl }} style={s.thumb} cachePolicy="memory-disk" />
        ) : item.type === 'opportunity' || item.type === 'hackathon_announcement' || item.type === 'broadcast' ? (
          <View style={{ backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 12, padding: 8 }}>
            <Ionicons name={item.type === 'broadcast' ? 'megaphone' : 'briefcase'} size={18} color={C.brand[500]} />
          </View>
        ) : item.type !== 'follow' && item.post?.image && item.post.image.length > 0 ? (
          <ExpoImage source={{ uri: item.post.image[0] }} style={s.thumb} cachePolicy="memory-disk" />
        ) : item.type === 'follow' ? (
          <View className="bg-ink ml-2 px-2.5 py-1 rounded-full">
            <Text className="text-paper text-label font-display uppercase">Profile</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }, [navigation]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title="Updates Center" onBack={() => navigation.goBack()} />

        {/* List */}
        {loading ? (
          <View className="flex-1 px-5 pt-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <NotificationSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList keyboardShouldPersistTaps="handled"
            data={rows}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                <Text className="text-ink-3 text-label font-display uppercase">Recent transmissions</Text>
                <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color={C.brand[500]} />
                </View>
              ) : <View className="h-20" />
            }
            ListEmptyComponent={loadError ? (
              <View className="mt-10">
                <Empty
                  icon="cloud-offline-outline"
                  title="Couldn't load notifications"
                  action={<Button title="Try again" onPress={onRefresh} />}
                />
              </View>
            ) : (
              <View className="items-center justify-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="notifications-off-outline" size={32} color={C.ink4} />
                </View>
                <Text className="font-semibold text-base text-ink text-center">Sync Complete</Text>
                <Text className="font-sans text-sm text-ink-3 mt-2 text-center">No active signals found in the registry.</Text>
              </View>
            )}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const s = themed(() => ({ thumb: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.line, marginLeft: 8 } }));

// --- HELPER FUNCTION: Time Ago ---
const getTimeAgo = (dateString: string) => {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default Notification;
