import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {View, Text, Pressable, Image, Dimensions, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl, ViewToken, TouchableOpacity, Share, DeviceEventEmitter, ScrollView, Animated, Easing, useWindowDimensions, StatusBar} from 'react-native'
import { FlashList } from '@shopify/flash-list';
import { PostSkeleton } from "./Skeleton";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { Layout, FadeIn, FadeOut } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/auth.context';
import CreatePost from './create-post';
import Avatar from './Avatar';
import axios from '../context/axiosConfig';
import { takePrefetchedFeed } from '../utils/feedPrefetch';
import FollowSuggestions from './FollowSuggestions';
// @ts-ignore
import no_post from '../assets/no_post.png';
import AdCarousel from './AdCarousel';
import { Image as ExpoImage } from 'expo-image';
import { memo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  checkAndStartSession,
  getSeenPostIds,
  markPostsAsSeen,
  resetSeenPosts,
} from '../utils/feedSession';
import { BlurView } from 'expo-blur';
import StreakLeaderboardModal from './StreakLeaderboardModal';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getFullUrl } from '../utils/imageUtils';
import { prefetchPostImages, POST_PLACEHOLDER } from '../utils/imageWarm';
import { useTabBarClearance, useBottomInset } from '../constants/layout';
import { fetchUnreadCounts } from '../utils/supabase';
import { readRecentFeatureIds, recordFeatureUse } from '../utils/recentFeatures';
import { visibleFeatures, artUrl, type Feature } from '../constants/features';

// One colour per family rather than forty, matching ExploreHub.
const FAMILY: Record<string, string> = {
  study: '#7C3AED', career: '#2563EB', events: '#EA580C',
  social: '#0891B2', campus: '#57534E', fun: '#DB2777', account: '#57534E',
};

/** Shown until this user has opened anything; a first-run grid, not a fixed one. */
const DEFAULT_QUICK = ['academy', 'jobs', 'utilities', 'techPulse'];

import { dedupedGet } from '../utils/batchRequest';
import socket from '../utils/socket';
import { Alert } from './ui/AlertModal';
import CommentsSheet from './ui/CommentsSheet';
import { C } from '../constants/colors';

const { width } = Dimensions.get('window');

// --- TYPES ---
// --- HELPERS ---
const formatCount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num > 0 ? num.toString() : '0';
};

interface Post {
  /** A place name like "Library", never coordinates. */
  location?: string | null;
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
  repostedBy?: string[];
  reposts?: number;
  views?: number;
  comments: any[];
  commentCount?: number;
  college?: string;
}

// --- COMMENTS MODAL ---

// --- POST ITEM ---
/** Vote pill geometry. The indicator's travel is derived from these, so the
 *  fill always lands centred on a button rather than near it. */
const VOTE_BTN = 30;
const VOTE_SCORE_W = 30;

/** Instagram/LinkedIn feed: the card is edge-to-edge, so media spans the full
 *  screen width and only the text rows carry a horizontal inset. */

const PostItem = memo(({ item, index, currentUser, openComments, onDeletePost }: { item: Post, index: number, currentUser: any, openComments: (id: string) => void, onDeletePost: (id: string) => void }) => {
  const { width } = useWindowDimensions();
  const mediaWidth = width;
  const [vote, setVote] = useState<'up' | 'down' | null>(
    item.upvoted_by?.includes(currentUser?._id) ? 'up' : 
    item.downvoted_by?.includes(currentUser?._id) ? 'down' : null
  );
  const [score, setScore] = useState(item.score || (item.likes || 0));
  const [reposted, setReposted] = useState(item.repostedBy?.some((u: any) => String(u) === String(currentUser?._id)));
  const [repostCount, setRepostCount] = useState(item.reposts || 0);
  const [viewCount] = useState(item.views || 0);
  
  const [resizeMode, setResizeMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
const MAX_CHAR_LIMIT = 150;

  const springValue = useRef(new Animated.Value(1)).current;

  /**
   * The sliding vote indicator.
   *
   * `slide` is 0 at the upvote and 1 at the downvote; `fill` fades it out when
   * there is no vote. The pill used to fill the button itself, which left a
   * sliver of the container's own padding showing beside the circle — a white
   * crescent on an otherwise solid orange control. Moving the fill to a layer
   * underneath removes the padding problem entirely and gives the transition
   * something to animate along.
   */
  const slide = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const tint = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation<any>();

  const displayCommentCount = item.commentCount || item.comments?.length || 0;
  const images = item.image || [];

  // Driven from `vote` rather than from the tap, so an optimistic update that
  // gets rolled back animates back too.
  useEffect(() => {
    Animated.parallel([
      // All three on the JS driver, and they have to match.
      //
      // backgroundColor cannot run natively, and this indicator animates its
      // colour, its position and its opacity on one node. Mixing drivers on a
      // single node throws: once it is attached natively for transform, the JS
      // driver is refused for colour. The movement here is a 34px pill on tap,
      // never during a scroll, so nothing is lost by running it in JS.
      Animated.spring(slide, {
        toValue: vote === 'down' ? 1 : 0,
        friction: 7,
        tension: 90,
        useNativeDriver: false,
      }),
      Animated.timing(fill, {
        toValue: vote ? 1 : 0,
        duration: 140,
        useNativeDriver: false,
      }),
      Animated.timing(tint, {
        toValue: vote === 'down' ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [vote, slide, fill, tint]);

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


  /**
   * Repost, one tap.
   *
   * Optimistic, then reconciled: the server returns the count it settled on,
   * so two devices sharing at once cannot leave this showing a number the
   * database never held.
   */
  const handleRepost = async () => {
    const prevReposted = reposted;
    const prevCount = repostCount;
    setReposted(!prevReposted);
    setRepostCount(prevReposted ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await axios.post(`/post/repost/${item._id}`);
      if (res.data?.success) {
        setReposted(res.data.reposted);
        setRepostCount(res.data.reposts);
        if (res.data.reposted) {
          Toast.show({ type: 'success', text1: 'Reposted', text2: 'It is on your profile now.' });
        }
      }
    } catch (err: any) {
      setReposted(prevReposted);
      setRepostCount(prevCount);
      const msg = err?.response?.data?.message;
      if (msg) Toast.show({ type: 'info', text1: msg });
    }
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
    <View className="bg-card border-b border-line mb-2 py-3">
      {/* Top Header Row (Reddit Style) */}
      <View className="flex-row items-center justify-between mb-3 px-3">
        <View className="flex-row items-center">
          <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })}>
            {item.user?.avatar ? (
              <Avatar user={item.user as any} size={28} />
            ) : (
              <View className="w-7 h-7 rounded-full bg-recruiter items-center justify-center">
                <Text className="font-display text-label text-white uppercase">{(item.user?.name || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })} className="ml-2 flex-row items-center">
            <Text className="font-semibold text-sm text-ink">{item.user?.username || "Unknown"}</Text>
            <Text className="text-ink-3 text-sm mx-1">·</Text>
            <Text className="text-ink-3 text-sm">{timeAgo(item.createdAt)}</Text>
          </Pressable>
          {!!item.location && (
            <View className="flex-row items-center ml-2 min-w-0">
              <Ionicons name="location" size={11} color={C.brand[600]} />
              <Text className="text-ink-2 text-xs ml-0.5" numberOfLines={1}>{item.location}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => {
            const isOwner = item.user?._id === currentUser?._id;

            if (isOwner) {
              Alert.alert('Post options', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete post', style: 'destructive', onPress: () => onDeletePost(item._id) },
              ]);
              return;
            }

            // Reporting used to be two nested alerts ending in a hardcoded
            // "Inappropriate content". Asking what is wrong in the same step is
            // both fewer taps and the only way a moderator learns anything
            // useful from the report.
            const report = async (reason: string) => {
              try {
                await axios.post('/post/report', { postId: item._id, reason });
                Toast.show({
                  type: 'success',
                  text1: 'Reported',
                  text2: 'Thanks — we will take a look.',
                });
              } catch {
                Alert.alert('Could not report', 'That did not send. Try again.', [{ text: 'Okay' }]);
              }
            };

            Alert.alert('Report this post', 'What is wrong with it?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Spam or scam', onPress: () => report('Spam or scam') },
              { text: 'Harassment or abuse', onPress: () => report('Harassment or abuse') },
              { text: 'Explicit content', style: 'destructive', onPress: () => report('Explicit content') },
            ]);
          }}
          className="items-center justify-center rounded-full"
          style={{ width: 32, height: 32 }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Post options"
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={C.ink} />
        </Pressable>
      </View>

      <View className="mb-3 px-3">
        <Text className="font-sans text-base text-ink-2">
          {isExpanded || (item.description?.length || 0) <= MAX_CHAR_LIMIT
            ? item.description
            : `${item.description?.slice(0, MAX_CHAR_LIMIT)}...`}
        </Text>
        {(item.description?.length || 0) > MAX_CHAR_LIMIT && (
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} className="mt-1">
            <Text className="text-accent-text font-semibold">
              {isExpanded ? 'Show Less' : 'Show More'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Media (Full Width) */}
      {!!item.image?.length && (
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
            <View style={{ width: mediaWidth }}>
              <Pressable onPress={() => setResizeMode(prev => !prev)}>
                <ExpoImage
                  source={{ uri: getFullUrl(imageUrl) || '' }}
                  style={{ width: mediaWidth, height: mediaWidth }}
                  contentFit={resizeMode ? "contain" : "cover"}
                  cachePolicy="memory-disk"
                  // Tied to the URL so a recycled row never shows the previous
                  // post's photo for a frame while the new one decodes.
                  recyclingKey={imageUrl}
                  placeholder={{ blurhash: POST_PLACEHOLDER }}
                  placeholderContentFit="cover"
                  transition={120}
                  priority={index === 0 ? "high" : "normal"}
                />
              </Pressable>
            </View>
          )}
        />
        
        {/* Image Counter (Top Right) */}
        {(item.image?.length || 0) > 1 && (
          <View className="absolute top-3 right-3 bg-black/50 px-2 py-1 rounded-lg">
            <Text className="text-white text-label font-semibold">
              {activeIndex + 1}/{(item.image?.length || 0)}
            </Text>
          </View>
        )}
        {(item.image?.length || 0) > 1 && (
          <View className="flex-row justify-center gap-1.5 absolute bottom-4 w-full">
            {(item.image || []).map((_, i) => (
              <View key={i} className={`h-1.5 rounded-full ${activeIndex === i ? 'w-4 bg-card' : 'w-1.5 bg-card/50'}`} />
            ))}
          </View>
        )}
      </View>
      )}

      {/* Action Bar (Reddit Style Pills) */}
      <View className="flex-row items-center gap-2 px-3">
        {/* The action row.
            These were bg-paper-2 with a hairline border and ink-3 icons — 2.99:1,
            the exact visual language of a disabled control. They are live
            controls, so they sit on white with a 2px ink border.

            The container carries no horizontal padding: that 4px was the white
            sliver showing beside the filled button. The vote fill is a layer
            underneath instead, which is what lets it slide between the two
            positions and change colour on the way. */}
        <Animated.View
          style={{ transform: [{ scale: springValue }] }}
          className="flex-row items-center bg-card border-2 border-ink rounded-full overflow-hidden"
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              width: VOTE_BTN,
              height: VOTE_BTN,
              borderRadius: VOTE_BTN / 2,
              opacity: fill,
              transform: [{
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, VOTE_BTN + VOTE_SCORE_W],
                }),
              }],
              backgroundColor: tint.interpolate({
                inputRange: [0, 1],
                outputRange: ['#F97316', '#12100E'],
              }) as unknown as string,
            }}
          />

          <Pressable
            onPress={() => handleVote('up')}
            className="items-center justify-center"
            style={{ width: VOTE_BTN, height: VOTE_BTN }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Upvote"
            accessibilityState={{ selected: vote === 'up' }}
          >
            <Ionicons name={vote === 'up' ? 'arrow-up' : 'arrow-up-outline'} size={16} color={C.ink} />
          </Pressable>

          <Text
            className="font-display text-ink text-center"
            style={{ width: VOTE_SCORE_W, fontSize: 12 }}
          >
            {score === 0 ? '0' : score > 999 ? formatCount(score) : score}
          </Text>

          <Pressable
            onPress={() => handleVote('down')}
            className="items-center justify-center"
            style={{ width: VOTE_BTN, height: VOTE_BTN }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Downvote"
            accessibilityState={{ selected: vote === 'down' }}
          >
            {/* White on ink once the fill arrives underneath it. */}
            <Ionicons
              name={vote === 'down' ? 'arrow-down' : 'arrow-down-outline'}
              size={16}
              color={vote === 'down' ? '#FFFFFF' : '#12100E'}
            />
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={() => openComments(item._id)}
          className="flex-row items-center bg-card border-2 border-ink rounded-full px-2.5"
          style={{ minHeight: 30 }}
          accessibilityRole="button"
          accessibilityLabel={`${displayCommentCount} comments`}
        >
          <Ionicons name="chatbubble-outline" size={14} color={C.ink} />
          <Text className="font-display text-ink ml-1.5" style={{ fontSize: 12 }}>
            {formatCount(displayCommentCount)}
          </Text>
        </Pressable>

        {/* Hidden on your own posts: the endpoint refuses them, so offering
            the control would only produce an error. */}
        {item.user?._id !== currentUser?._id && (
          <Pressable
            onPress={handleRepost}
            className={`flex-row items-center rounded-full px-2.5 border-2 border-ink ${reposted ? 'bg-brand-500' : 'bg-card'}`}
            style={{ minHeight: 30 }}
            accessibilityRole="button"
            accessibilityState={{ selected: !!reposted }}
            accessibilityLabel={reposted ? 'Remove your repost' : 'Repost this'}
          >
            <Ionicons name={reposted ? 'repeat' : 'repeat-outline'} size={15} color={C.ink} />
            {repostCount > 0 && (
              <Text className="font-display text-ink ml-1.5" style={{ fontSize: 12 }}>
                {formatCount(repostCount)}
              </Text>
            )}
          </Pressable>
        )}

        <Pressable
          onPress={handleShare}
          className="flex-row items-center bg-card border-2 border-ink rounded-full px-2.5"
          style={{ minHeight: 30 }}
          accessibilityRole="button"
          accessibilityLabel="Share this post"
        >
          <Ionicons name="paper-plane-outline" size={14} color={C.ink} />
          <Text className="font-display text-ink ml-1.5" style={{ fontSize: 12 }}>Share</Text>
        </Pressable>

        <View className="flex-1" />

      </View>
    </View>
  );
});

// --- MAIN SCREEN ---
export default function HomeScreen() {
  const tabBarClearance = useTabBarClearance();
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
  const followingCursorRef = useRef<string | null>(null);

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
      const cacheKey = `fync_feed_${activeTab}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached && pageNum === 1 && !shouldRefresh) {
        const parsed = JSON.parse(cached);
        prefetchPostImages(parsed);
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
        const cursorParam = (pageNum === 1 ? null : followingCursorRef.current);
        const res = await axios.get(`/post/feed/followers?${cursorParam ? `cursor=${cursorParam}` : ''}&limit=10`);
        if (res.data.success) {
          newPosts = res.data.posts;
          serverHasMore = res.data.hasMore ?? newPosts.length >= 10;
          followingCursorRef.current = res.data.nextCursor ?? null;
        }
      } else {
        // Auth bootstrap already fired this request; reuse it instead of
        // making the user wait for a second round-trip.
        const prefetched = pageNum === 1 && !shouldRefresh ? await takePrefetchedFeed() : null;
        const res =
          prefetched ||
          (await axios.post(`/post/smart-feed?page=${pageNum}&limit=10`, {
            seenIds: await getSeenPostIds(),
          }));

        if (res.data.success) {
          newPosts = res.data.posts;
          serverHasMore = res.data.hasMore ?? newPosts.length >= 10;
          if (newPosts.length > 0) markPostsAsSeen(newPosts.map((p: Post) => p._id));
          if (res.data.mode === 'recycled') resetSeenPosts();
        }
      }

      prefetchPostImages(newPosts);

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
        if (pageNum === 1) AsyncStorage.setItem(`fync_feed_forYou`, JSON.stringify(updatedForYou));
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
        if (pageNum === 1) AsyncStorage.setItem(`fync_feed_following`, JSON.stringify(updatedFollowing));
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
        // Initial Load or For You load — no forced refresh so the cached page
        // paints immediately and the network result swaps in behind it.
        fetchFeed(1);
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
    if (!user?._id) return;
    try {
      // dedupedGet, not axios.get: returning to the feed can trigger this from
      // more than one place in the same tick, and the badge count only needs
      // fetching once.
      const [notifRes, chatCounts] = await Promise.all([
        dedupedGet<any>('/notifications/count'),
        fetchUnreadCounts(user._id)
      ]);
      if (notifRes.data.success) {
        setUnreadCount(notifRes.data.count);
      }
      setChatUnreadCount(
        Object.values(chatCounts).reduce((a, b) => a + b, 0)
      );
    } catch (error) {
      console.log("Badge Error:", error);
    }
  }, [user?._id]);

  // Focus alone left the badge stale while sitting on the feed. The server
  // already knows who to notify (it sends the push), so it nudges the open app
  // on the same event instead of the client polling for it.
  useEffect(() => {
    const bump = () => setChatUnreadCount((c) => c + 1);
    socket.on("chat_badge", bump);
    return () => { socket.off("chat_badge", bump); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBadges();
    }, [fetchBadges])
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

  /**
   * Set a post's comment count to the number the server actually returned.
   *
   * Distinct from handleCommentAddedInModal, which prepends a comment and adds
   * one. Passing a count into that path inflated the badge on every refetch.
   */
  const handleCommentCount = useCallback((postId: string, count: number) => {
    setFeed((currentFeed) =>
      currentFeed.map((post) =>
        post._id === postId ? { ...post, commentCount: count } : post,
      ),
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

  /**
   * Suggestions are woven into the data rather than worked out inside
   * renderItem, so the row keeps a stable key and the list does not have to
   * reason about index arithmetic on every render.
   *
   * First card after 5 posts, then every 7. Injecting earlier interrupts the
   * feed before the student has settled into it; much later and someone who
   * follows nobody never sees one at all.
   */
  const feedWithSuggestions = useMemo(() => {
    if (!feed.length) return feed as any[];
    const out: any[] = [];
    let injected = 0;
    feed.forEach((post, i) => {
      out.push(post);
      const n = i + 1;
      if (n >= 5 && (n - 5) % 7 === 0) {
        out.push({ _id: `__suggestions-${injected}`, __suggestions: true, offset: injected * 4 });
        injected += 1;
      }
    });
    return out;
  }, [feed]);

  const renderPostItem = useCallback(({ item, index }: { item: any, index: number }) => {
    if (item.__suggestions) return <FollowSuggestions offset={item.offset} />;
    return (
      <PostItem
        item={item}
        index={index}
        currentUser={user}
        openComments={handleOpenComments}
        onDeletePost={handleDeletePost}
      />
    );
  }, [user, handleOpenComments, handleDeletePost]);



  const renderHeader = () => (
    <View
      style={{ paddingTop: insets.top - 10 }}
      className="flex-row items-center justify-between px-4 bg-transparent z-10 mt-2 pb-2"
    >
      <View className="flex-row items-center py-2 gap-2 flex-1 min-w-0 mr-2">
        <Pressable onPress={() => navigation.openDrawer()} accessibilityRole="button" accessibilityLabel="Open menu">
          {/* mockup .av.ring-student: box-shadow 0 0 0 2px card, 0 0 0 4px student.
              RN has no spread shadow, so the two rings are a 2px card-coloured
              pad inside a 2px brand border. */}
          <View className="rounded-full border-2 border-brand-500 bg-card" style={{ padding: 2 }}>
            <ExpoImage
              source={{ uri: getFullUrl(profileImage) || `https://ui-avatars.com/api/?name=${user?.username}&background=random&color=fff` }}
              style={{ width: 34, height: 34, borderRadius: 999 }}
              cachePolicy="disk"
            />
          </View>
        </Pressable>
        <Text className="font-display text-h2 text-ink shrink" numberOfLines={1}>{`Hi, ${user?.name?.split(" ")[0]}`}</Text>
      </View>

      <View className="flex-row items-center gap-3 shrink-0">
        {/* Streak Display */}
        <TouchableOpacity 
          onPress={() => setShowLeaderboard(true)}
          className="flex-row items-center bg-brand-100 px-2 py-1 rounded-full border border-ink"
        >
          <MaterialCommunityIcons 
            name="fire" 
            size={16} 
            color={(user as any)?.streakCount > 0 ? "#F97316" : "#F97316"} 
          />
          <Text className="font-display text-xs ml-0.5 text-brand-700">
            {(user as any)?.streakCount || 0}
          </Text>
        </TouchableOpacity>

        <Pressable onPress={() => navigation.navigate('SearchScreen')}>
          <Ionicons name="search-outline" size={22} color={C.ink} />
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Notification')}>
          <View>
            <Ionicons name="heart-outline" size={22} color={C.ink} />
            {unreadCount > 0 && (
              <View className="absolute -top-1.5 -right-1.5 bg-brand-500 rounded-full w-4 h-4 justify-center items-center border border-white">
                <Text className="text-ink text-label font-semibold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('ChatList')}>
          <View>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={C.ink} />
            {chatUnreadCount > 0 && (
              <View className="absolute -top-1.5 -right-1.5 bg-fam-fun rounded-full w-4 h-4 justify-center items-center border border-white">
                <Text className="text-white text-label font-semibold">
                  {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {/* <View className='absolute bg-brand-200 w-48 h-48 rounded-full -right-14 -top-24 -z-10 opacity-40'></View> */}
    </View>
  );

  const renderTabBar = () => (
    <View className="flex-row bg-transparent border-b border-line">
      {['For You', 'Following'].map((tabTitle) => {
        const key = tabTitle === 'For You' ? 'forYou' : 'following';
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            onPress={() => setActiveTab(key as any)}
            className="flex-1 items-center pb-2 pt-1"
          >
            <Text className={`font-display text-sm ${isActive ? 'text-ink' : 'text-ink-3'}`}>
              {tabTitle}
            </Text>
            {isActive && <View className="absolute bottom-0 h-[3px] bg-brand-500 w-1/2 rounded-full" />}
          </Pressable>
        );
      })}
    </View>
  );


  const renderFooter = () => {
    if (!loadingMore) return <View className="h-20" />;
    return (
      <View className="py-4 h-20">
        <ActivityIndicator size="small" color={C.brand[500]} />
      </View>
    );
  };
  // The home grid is sourced from constants/features.ts now, so there is one
  // registry instead of a second hand-maintained copy that drifted from it.
  // The four features this user actually opens, newest first. Shared with
  // Explore, so using something in either place reorders both. Until there is
  // any history, fall back to a sensible starting set rather than an empty row.
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      readRecentFeatureIds().then(setRecentIds).catch(() => setRecentIds([]));
    }, [])
  );

  const quickFeatures = useMemo(() => {
    const registry: Feature[] = visibleFeatures(user);
    const byId = new Map(registry.map((f: Feature) => [f.id, f]));
    const ordered = recentIds.map((id) => byId.get(id)).filter(Boolean) as Feature[];
    const fallback = registry.filter((f: Feature) => DEFAULT_QUICK.includes(f.id));
    const seen = new Set(ordered.map((f: Feature) => f.id));
    return [...ordered, ...fallback.filter((f: Feature) => !seen.has(f.id))].slice(0, 4);
  }, [recentIds, user]);

  const openQuick = useCallback((f: any) => {
    navigation.navigate(f.route, f.params);
    recordFeatureUse(f.id).then(setRecentIds).catch(() => {});
  }, [navigation]);
  
  const renderFeatureStories = () => {
  return (
    <View className="bg-transparent py-2 px-2 w-full">
      {/* Grid Container */}
      <View className="flex-row flex-wrap">
        {quickFeatures.map((item: any, index: number) => (
          <Reanimated.View
            key={item.id}
            entering={FadeIn.delay(index * 50).duration(500)}
            className="w-1/4 p-1.5"
          >
            <Pressable
              onPress={() => openQuick(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}. ${item.hint}`}
              className="w-full bg-card p-1.5 flex flex-col items-center justify-between border-[1.5px] border-line rounded-md"
              style={{
                shadowColor: "#12100E",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
                aspectRatio: 1
              }}
            >
              {/* One colour per family, the same mapping Explore uses */}
              <View className="w-full flex-1 rounded-xl overflow-hidden mb-1 justify-center items-center"
                style={{ backgroundColor: (FAMILY[item.category] ?? item.tint) + '1A' }}>
                {artUrl(item.art) ? (
                  <ExpoImage source={{ uri: artUrl(item.art) }} style={{ width: 34, height: 34 }} contentFit="contain" cachePolicy="disk" transition={120} />
                ) : (
                  <Ionicons name={item.icon} size={24} color={FAMILY[item.category] ?? item.tint} />
                )}
              </View>

              {/* Title below icon */}
              <Text className="font-display text-ink text-label text-center px-0.5 leading-tight" numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          </Reanimated.View>
        ))}
      </View>
    </View>
  );
}


  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />
      
      {renderHeader()}

      {/* FlashList recycles cells instead of keeping every mounted row alive,
          which is what stops the blank-cell flash on a fast scroll once the
          feed is thousands of posts long. v2 sizes cells itself, so the
          FlatList windowing props it replaces are gone. */}
      <FlashList
        data={feedWithSuggestions}
        keyExtractor={(item) => item._id}
        renderItem={renderPostItem}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />
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
              <Text className="font-display text-h1 text-ink mt-4">Welcome to Fync!</Text>
              <Text className="text-ink-3 text-center mt-2 px-gutter">
                Your feed is empty. Start following people or create a post to see updates here.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
        showsVerticalScrollIndicator={false}
      />

      <CommentsSheet
        visible={isCommentModalVisible}
        onClose={() => setCommentModalVisible(false)}
        resource="post"
        targetId={selectedPostId}
        currentUser={user}
        onCountChange={handleCommentCount}
      />

      <StreakLeaderboardModal 
        isVisible={showLeaderboard} 
        onClose={() => setShowLeaderboard(false)} 
      />

    </View>
  );
}
