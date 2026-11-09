import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Platform,
  StatusBar,
  Linking
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import { NotificationSkeleton } from './Skeleton';
import { C, themed } from '../constants/colors';
import { AppBar, Button, Empty, IconTile } from './ui/kit';
import Avatar from './Avatar';
import { timeBucket } from '../utils/timeBuckets';
import Animated from 'react-native-reanimated';
import { enterAt } from './ui/motion';
import { ProgressiveImage } from './ui/ProgressiveImage';
import { groupNotifications, NotifGroup, SectionHeader } from './notifications/groupNotifications';
import { getFullUrl } from '../utils/imageUtils';

import FyncRefreshControl from './ui/FyncRefreshControl';
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
  // Denied OS permission is why "nothing arrives"; say so instead of "all caught up".
  const [pushOff, setPushOff] = useState(false);
  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setPushOff(p.status === 'denied')).catch(() => {});
  }, []);
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
    // A pull while a page is loading would otherwise leave the spinner stuck.
    if (inFlightRef.current) { setRefreshing(false); return; }
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
    // Nothing unread: skip the write (every open used to PUT regardless).
    if (!oldest || !loaded.some(n => !n.isRead)) return;
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
    if (item.post?._id) {
      navigation.navigate('IndividualPostOrShort', { postId: item.post._id });
      return;
    }
    if (item.shorts?._id) {
      navigation.navigate('IndividualPostOrShort', { shortId: item.shorts._id });
      return;
    }
    if (item.sender?._id) {
      navigation.navigate('PublicProfile', { userId: item.sender._id, user: item.sender });
    }
  };

  // Today / This week / Earlier headers, with same-type/same-target rows folded
  // into one group per section; paging and refresh still work on the plain array.
  const rows = useMemo(() => groupNotifications(notifications, timeBucket), [notifications]);

  const renderItem = useCallback(({ item: row, index }: { item: Row; index: number }) => (
    row.kind === 'header' ? (
      <Text className="text-ink-3 text-[13px] font-semibold mt-4 mb-1" accessibilityRole="header">
        {row.label}
      </Text>
    ) : (
      <Animated.View entering={enterAt(index)}>
        <NotificationRow group={row} onPress={handlePress} />
      </Animated.View>
    )
  ), [navigation]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title="Notifications" onBack={() => navigation.goBack()} />

        {/* List */}
        {loading ? (
          <View className="flex-1 px-gutter pt-4">
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
              <FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
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
              <View className="mt-16">
                {pushOff ? (
                  <Empty icon="notifications-off-outline" title="Notifications are off"
                    hint="Turn them on to hear about matches, replies and streak reminders."
                    action={<Button variant="primary" title="Turn on notifications" onPress={() => Linking.openSettings()} />} />
                ) : (
                  <Empty icon="notifications-off-outline" title="You're all caught up" hint="Likes, follows and replies will show up here." />
                )}
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

type Row = NotifGroup<NotificationItem> | SectionHeader<string>;

const SYSTEM = new Set(['opportunity', 'hackathon_announcement', 'broadcast']);

const describe = (item: NotificationItem): string => {
  switch (item.type) {
    case 'follow': return 'started following you.';
    case 'tag': return item.confession ? 'Someone confessed about you' : 'tagged you in a post.';
    case 'like': return 'liked your post.';
    case 'comment': return `commented: "${item.commentText || 'Nice!'}"`;
    case 'story_comment': return `commented on your shorts: "${item.commentText || 'Nice!'}"`;
    case 'story_like': return 'liked your shorts.';
    case 'split_request': return item.commentText || 'requested a split payment.';
    case 'split_paid': return item.commentText || 'paid their debt.';
    case 'broadcast': return item.message || 'sent an announcement.';
    case 'hackathon_announcement': return item.message || 'posted a hackathon announcement.';
    case 'reply':
    case 'college_reply': return item.commentText ? `replied: "${item.commentText}"` : 'replied to you.';
    case 'opportunity': return item.message || 'sent you an opportunity update.';
    default: return item.message || item.commentText || 'sent you a notification.';
  }
};

// Folded rows can't quote one comment, so they get a generic verb.
const GROUP_VERB: Record<string, string> = {
  like: 'liked your post.',
  story_like: 'liked your shorts.',
  comment: 'commented on your post.',
  story_comment: 'commented on your shorts.',
  follow: 'started following you.',
};

const nameOf = (u?: NotificationItem['sender']) => u?.username || u?.name || 'Fync';

const AVATAR = 44;
const STACK = 30;

const AvatarStack = ({ senders, ring }: { senders: NotificationItem['sender'][]; ring: string }) => {
  const shown = senders.slice(0, 3);
  // Back-to-front so the newest sender sits on top-left, like Instagram.
  return (
    <View style={{ width: AVATAR, height: AVATAR }}>
      {shown.map((u, i) => (
        <View
          key={u._id}
          style={{
            position: 'absolute', left: i * 5, top: i * 5, zIndex: 3 - i,
            borderRadius: STACK / 2 + 2, borderWidth: 2, borderColor: ring,
          }}
        >
          <Avatar user={u as any} size={STACK} showBadge={false} />
        </View>
      ))}
    </View>
  );
};

const NotificationRow = React.memo(function NotificationRow({
  group, onPress,
}: { group: NotifGroup<NotificationItem>; onPress: (n: NotificationItem) => void }) {
  const item = group.lead;
  const unread = group.unread;
  // Anonymous: never name or picture the sender of a confession tag.
  const anonymous = item.type === 'tag' && !!item.confession;
  const people = group.senders.length;
  const folded = people > 1;
  const message = folded ? GROUP_VERB[item.type] ?? describe(item) : describe(item);
  const who = !folded ? nameOf(item.sender)
    : people === 2 ? `${nameOf(group.senders[0])} and ${nameOf(group.senders[1])}`
    : `${nameOf(group.senders[0])} and ${people - 1} others`;
  const time = getTimeAgo(item.createdAt);
  const postImage = item.type !== 'follow' ? item.post?.image?.[0] : undefined;

  return (
    <Pressable
      className={`flex-row items-center py-3 px-3 -mx-3 rounded-2xl active:opacity-85 ${unread ? 'bg-paper-2' : ''}`}
      style={{ minHeight: 64 }}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${anonymous ? '' : who + ' '}${message}, ${time}`}
    >
      <View className="relative mr-3">
        {anonymous ? (
          <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={18} color={C.ink3} />
          </View>
        ) : folded ? (
          <AvatarStack senders={group.senders} ring={unread ? C.paper2 : C.paper} />
        ) : (
          <Avatar user={item.sender as any} size={AVATAR} showBadge={false} />
        )}
        {unread && (
          <View className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-brand-500 rounded-full border-2 border-paper-2" style={{ zIndex: 5 }} />
        )}
      </View>

      <View className="flex-1">
        {/* Capped: a long comment used to stretch one row over half the screen. */}
        <Text className="font-sans text-sm leading-5 text-ink-2" numberOfLines={3}>
          {anonymous || SYSTEM.has(item.type) ? (
            <Text className="font-semibold text-sm text-ink">{message}</Text>
          ) : (
            <>
              <Text className="font-semibold text-sm text-ink">{who}</Text>{' '}{message}
            </>
          )}
        </Text>
        <Text className="font-sans text-xs text-ink-3 mt-0.5">{time}</Text>
      </View>

      {item.type === 'broadcast' && item.imageUrl ? (
        <ExpoImage source={{ uri: getFullUrl(item.imageUrl) || '' }} style={s.thumb} cachePolicy="memory-disk" />
      ) : SYSTEM.has(item.type) ? (
        <IconTile icon={item.type === 'broadcast' ? 'megaphone-outline' : 'briefcase-outline'} size={40} style={{ marginLeft: 8 }} />
      ) : postImage ? (
        <ProgressiveImage path={postImage} thumbOnly style={s.thumb} />
      ) : item.type === 'follow' && !folded ? (
        <View className="bg-paper-2 border border-line ml-2 px-3 py-1.5 rounded-full">
          <Text className="text-ink text-xs font-semibold">View profile</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const s = themed(() => ({ thumb: { width: 48, height: 48, borderRadius: 12, marginLeft: 8, backgroundColor: C.paper2 } }));

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
