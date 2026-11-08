import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {View, Text, Pressable, Image, Dimensions, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ViewToken, TouchableOpacity, Share, DeviceEventEmitter, ScrollView, useWindowDimensions, StatusBar} from 'react-native'
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import { PostSkeleton } from "./Skeleton";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppBar, H2, IconBtn, Button, Tabs, Empty } from './ui/kit';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/auth.context';
import CreatePost from './create-post';
import Avatar from './Avatar';
import axios from '../context/axiosConfig';
import { takePrefetchedFeed } from '../utils/feedPrefetch';
import FollowSuggestions from './FollowSuggestions';
import { HeartBurst, useDoubleTap } from './ui/HeartBurst';
import ZoomableImage from './ui-extra/ZoomableImage';
import { tapHaptic } from '../utils/haptics';
// @ts-ignore
import AdCarousel from './AdCarousel';
import { Image as ExpoImage } from 'expo-image';
import { memo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  checkAndStartSession,
  getSeenPostsBloom,
  markPostsAsSeen,
  resetSeenPosts,
} from '../utils/feedSession';
import { BlurView } from 'expo-blur';
import StreakLeaderboardModal from './StreakLeaderboardModal';
import { getFullUrl } from '../utils/imageUtils';
import { shareCard } from '../utils/shareCard';
import { prefetchPostImages } from '../utils/imageWarm';
import { useTabBarClearance, useBottomInset, useTabBarAutoHide } from '../constants/layout';
import { fetchUnreadCounts } from '../utils/supabase';


import { dedupedGet } from '../utils/batchRequest';
import socket from '../utils/socket';
import { Alert } from './ui/AlertModal';
import CommentsSheet from './ui/CommentsSheet';
import RepostModal from './ui/RepostModal';
import { ActionSheet, type SheetAction } from './ui/Sheet';
import { C } from '../constants/colors';
import Reanimated from 'react-native-reanimated';
import { PressScale, AnimatedCount, enterAt, buzz, usePop } from './ui/motion';
import { ProgressiveImage } from './ui/ProgressiveImage';
import { formatCount } from '../utils/format';
import { Flame } from './home/GreetingCard';
import { StoriesRow, STORIES_REFRESH } from './stories/Stories';

import FyncRefreshControl from './ui/FyncRefreshControl';
const FEED_TABS = ['For you', 'Following'];

// --- TYPES ---
// --- HELPERS ---

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
  saved_by?: string[];
  repostedBy?: string[];
  reposts?: number;
  views?: number;
  comments: any[];
  commentCount?: number;
  /** Present when this row is in the feed because someone reposted it. */
  repostMeta?: { user?: { _id?: string; name?: string; username?: string; avatar?: string }; text?: string; createdAt?: string };
  college?: string;
}

// --- COMMENTS MODAL ---

// --- POST ITEM ---
/** Instagram/LinkedIn feed: the card is edge-to-edge, so media spans the full
 *  screen width and only the text rows carry a horizontal inset. */

const PostItem = memo(({ item, index, currentUser, openComments, onOpenMenu, onRequestRepost }: { item: Post, index: number, currentUser: any, openComments: (id: string) => void, onOpenMenu: (item: Post) => void, onRequestRepost: (item: Post, confirm: (text: string) => Promise<void>) => void }) => {
  const { width } = useWindowDimensions();
  const mediaWidth = width;
  // FlashList hands this same instance a different post when it recycles the
  // cell, so plain useState would carry the last post's like/expand state over.
  // useRecyclingState resets whenever the post changes.
  const [liked, setLiked] = useRecyclingState(
    () => !!item.liked_by?.some((u: any) => String(u) === String(currentUser?._id)),
    [item._id]
  );
  const [likeCount, setLikeCount] = useRecyclingState(item.likes || 0, [item._id]);
  const [reposted, setReposted] = useRecyclingState(
    () => !!item.repostedBy?.some((u: any) => String(u) === String(currentUser?._id)),
    [item._id]
  );
  const [repostCount, setRepostCount] = useRecyclingState(item.reposts || 0, [item._id]);

  const [resizeMode, setResizeMode] = useRecyclingState(false, [item._id]);
  // Bumped on each double-tap to replay the heart; 0 on a recycled row.
  const [burst, setBurst] = useRecyclingState(0, [item._id]);
  const [activeIndex, setActiveIndex] = useRecyclingState(0, [item._id]);
  const [isExpanded, setIsExpanded] = useRecyclingState(false, [item._id]);
  // A request that settles after the cell was recycled must not write into the
  // post now occupying it.
  const idRef = useRef(item._id);
  idRef.current = item._id;
const MAX_CHAR_LIMIT = 150;

  const navigation = useNavigation<any>();
  const [likePopStyle, popLike] = usePop();

  const displayCommentCount = item.commentCount ?? item.comments?.length ?? 0;
  // The feed carries one populated comment per post; anything unpopulated is
  // still a bare ObjectId, which has no text to show.
  const topComment = item.comments?.find((c: any) => c && typeof c === 'object' && c.text);
  const images = item.image || [];

  /**
   * Like, one tap, LinkedIn style.
   *
   * Optimistic, then reconciled from the row the server returns: `likes` is
   * derived from `liked_by` server-side, so the count here cannot drift away
   * from the membership it is meant to describe.
   */
  const handleLike = async () => {
    const id = item._id;
    const prevLiked = liked;
    if (!prevLiked) buzz();
    popLike();
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await axios.post(`/post/like/${id}`);
      const post = res.data?.post;
      if (idRef.current !== id) return;
      if (post) {
        setLiked(!!post.liked_by?.some((u: any) => String(u) === String(currentUser?._id)));
        setLikeCount(post.likes || 0);
      }
    } catch (error) {
      if (idRef.current !== id) return;
      setLiked(prevLiked);
      setLikeCount(prevCount);
    }
  };


  /**
   * Repost, one tap.
   *
   * Optimistic, then reconciled: the server returns the count it settled on,
   * so two devices sharing at once cannot leave this showing a number the
   * database never held.
   */
  const handleRepost = async (text = '') => {
    const id = item._id;
    const prevReposted = reposted;
    const prevCount = repostCount;
    setReposted(!prevReposted);
    setRepostCount(prevReposted ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await axios.post(`/post/repost/${id}`, { text });
      if (idRef.current !== id) return;
      if (res.data?.success) {
        setReposted(res.data.reposted);
        setRepostCount(res.data.reposts);
        if (res.data.reposted) {
          Toast.show({ type: 'success', text1: 'Reposted', text2: 'It is on your profile now.' });
        }
      }
    } catch (err: any) {
      if (idRef.current !== id) return;
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
    if (Number.isNaN(seconds)) return '';
    if (seconds < 60) return 'now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  // Single tap keeps the fit/fill toggle; double tap likes (never unlikes).
  const onMediaPress = useDoubleTap(
    () => setResizeMode(prev => !prev),
    () => {
      setBurst(n => n + 1);
      if (liked) tapHaptic();
      else handleLike();
    },
  );

  const renderImage = ({ item: imageUrl }: { item: string }) => (
    <ZoomableImage style={{ width: mediaWidth }}>
      <Pressable onPress={onMediaPress}>
        {/* recyclingKey is tied to the URL inside ProgressiveImage, so a
            recycled row never flashes the previous post's photo. */}
        <ProgressiveImage
          path={imageUrl}
          style={{ width: mediaWidth, height: mediaWidth }}
          contentFit={resizeMode ? "contain" : "cover"}
          priority={index === 0 ? "high" : "normal"}
        />
      </Pressable>
    </ZoomableImage>
  );

  const [sharing, setSharing] = useRecyclingState(false, [item._id]);
  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    const shareUrl = `https://fync-api.duckdns.org/view?postId=${item._id}`;
    await shareCard('post', item._id, 'Share post', () => Share.share({
      message: `Check out this post by ${item.user?.username} on Fync!\n\n${item.description || ''}\n\nView post: ${shareUrl}`,
    }));
    setSharing(false);
  };

  return (
    <Reanimated.View entering={enterAt(index)} style={{ paddingVertical: 16 }}>
      {/* Why this post is in the feed at all: someone you follow shared it. */}
      {!!item.repostMeta && (
        <View className="flex-row items-center mb-2 px-gutter">
          <Ionicons name="repeat" size={14} color={C.ink3} />
          <Text className="text-ink-3 text-xs ml-1.5" numberOfLines={1}>
            <Text className="font-semibold">
              {item.repostMeta.user?.name || item.repostMeta.user?.username || 'Someone'}
            </Text>
            {' reposted this'}
          </Text>
        </View>
      )}

      {/* Top Header Row (Reddit Style) */}
      <View className="flex-row items-center justify-between mb-3 px-gutter">
        <View className="flex-row items-center flex-1 min-w-0 mr-2">
          <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })} hitSlop={6} className="active:opacity-85" accessibilityRole="button" accessibilityLabel={`${item.user?.name || 'Author'} profile`}>
            <Avatar user={item.user as any} size={32} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("PublicProfile", { user: item.user })} className="ml-3 flex-row items-center active:opacity-85" style={{ flexShrink: 1, minWidth: 0 }}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              {/* Explicit line heights: the default leading on two stacked
                  14px lines opens a gap wide enough to read as two rows. */}
              <Text className="font-semibold text-sm text-ink" style={{ lineHeight: 16 }} numberOfLines={1}>{item.user?.name || "Unknown"}</Text>
              <Text className="text-xs text-ink-3" style={{ lineHeight: 14 }} numberOfLines={1}>{item.user?.username || "Unknown"}</Text>
            </View>
            <Text className="text-ink-3 text-sm mx-1">·</Text>
            <Text className="text-ink-3 text-sm">{timeAgo(item.createdAt)}</Text>
          </Pressable>
          {!!item.location && (
            <View className="flex-row items-center ml-2 min-w-0" style={{ flexShrink: 1 }}>
              <Ionicons name="location" size={11} color={C.brand[600]} />
              <Text className="text-ink-2 text-xs ml-0.5" numberOfLines={1}>{item.location}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => onOpenMenu(item)}
          className="items-center justify-center rounded-full active:opacity-85"
          style={{ width: 44, height: 44, marginRight: -12 }}
          accessibilityRole="button"
          accessibilityLabel="Post options"
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={C.ink} />
        </Pressable>
      </View>

      {!!item.repostMeta?.text && (
        <View className="mb-3 px-gutter">
          <Text className="font-sans text-base text-ink">{item.repostMeta.text}</Text>
        </View>
      )}

      {/* Media (Full Width) */}
      {!!item.image?.length && (
      // zIndex: a pinch-zoomed photo draws over the caption and actions below.
      <View className="relative mb-3" style={{ zIndex: 10 }}>
        {/* Most posts carry one photo: skip mounting a nested list for it.
            The carousel is keyed by post so a recycled cell starts on slide 1. */}
        {images.length === 1 ? (
          renderImage({ item: images[0] })
        ) : (
          <FlatList keyboardShouldPersistTaps="handled"
            key={item._id}
            data={images}
            keyExtractor={(url, index) => `${item._id}-img-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={renderImage}
          />
        )}
        <HeartBurst trigger={burst} />
        
        {/* Image Counter (Top Right) */}
        {(item.image?.length || 0) > 1 && (
          <View className="absolute top-3 right-3 bg-black/50 px-2 py-1 rounded-full" accessibilityLabel={`Photo ${activeIndex + 1} of ${item.image?.length || 0}`}>
            <Text className="text-white text-xs font-semibold">
              {activeIndex + 1}/{(item.image?.length || 0)}
            </Text>
          </View>
        )}
        {(item.image?.length || 0) > 1 && (
          <View className="flex-row justify-center gap-1.5 absolute bottom-4 w-full" pointerEvents="none" importantForAccessibility="no-hide-descendants">
            {(item.image || []).map((_, i) => (
              <View key={i} className={`h-1.5 rounded-full ${activeIndex === i ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </View>
        )}
      </View>
      )}

      {/* Caption sits under the media, Instagram order: photo, then words,
          then the controls. */}
      {!!item.description && (
        <View className="mb-0.5 px-gutter">
          <Text className="font-sans text-sm leading-5 text-ink">
            {isExpanded || (item.description?.length || 0) <= MAX_CHAR_LIMIT
              ? item.description
              : `${item.description?.slice(0, MAX_CHAR_LIMIT)}...`}
          </Text>
          {(item.description?.length || 0) > MAX_CHAR_LIMIT && (
            <Pressable onPress={() => setIsExpanded(!isExpanded)} className="mt-1 self-start active:opacity-85" hitSlop={8} accessibilityRole="button">
              <Text className="text-ink font-semibold text-sm">
                {isExpanded ? 'Show less' : 'Show more'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Action Bar. Flat on the page like Instagram's: no chrome, ink icons
          at full strength carry the affordance. */}
      {/* Negative top margin: the 44pt touch targets centre a 22pt icon, which
          left ~11pt of empty box above the icons on top of the caption gap. */}
      <View className="flex-row items-center gap-2 px-gutter" style={{ marginLeft: -8, marginTop: item.description ? -6 : 0 }}>
        {/* PressScale ticks on press-in; handleLike adds the success buzz on a like. */}
        <PressScale
          onPress={handleLike}
          scale={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 44 }}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={liked ? 'Unlike this post' : 'Like this post'}
        >
          <Reanimated.View style={likePopStyle}>
            <Ionicons
              name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={20}
              color={liked ? C.brand[500] : C.ink}
            />
          </Reanimated.View>
          {likeCount > 0 && (
            <View style={{ marginLeft: 6 }}>
              <AnimatedCount value={likeCount} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: liked ? C.accentText : C.ink }} />
            </View>
          )}
        </PressScale>

        <Pressable
          onPress={() => openComments(item._id)}
          className="flex-row items-center rounded-full px-2 active:opacity-85"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
          accessibilityLabel={`${displayCommentCount} comments`}
        >
          <Ionicons name="chatbubble-outline" size={20} color={C.ink} />
          <View style={{ marginLeft: 6 }}>
            <AnimatedCount value={displayCommentCount} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: C.ink }} />
          </View>
        </Pressable>

        {/* Hidden on your own posts: the endpoint refuses them, so offering
            the control would only produce an error. */}
        {item.user?._id !== currentUser?._id && (
          <Pressable
            onPress={() => (reposted ? handleRepost() : onRequestRepost(item, handleRepost))}
            className="flex-row items-center rounded-full px-2 active:opacity-85"
            style={{ minHeight: 44 }}
            accessibilityRole="button"
            accessibilityState={{ selected: !!reposted }}
            accessibilityLabel={reposted ? 'Remove your repost' : 'Repost this'}
          >
            <Ionicons name={reposted ? 'repeat' : 'repeat-outline'} size={20} color={reposted ? C.brand[500] : C.ink} />
            {repostCount > 0 && (
              <Text className={`font-semibold text-xs ml-1.5 ${reposted ? 'text-accent-text' : 'text-ink'}`}>
                {formatCount(repostCount)}
              </Text>
            )}
          </Pressable>
        )}

        <Pressable
          onPress={handleShare}
          className="flex-row items-center rounded-full px-2 active:opacity-85"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
          accessibilityLabel="Share this post"
          accessibilityState={{ busy: sharing }}
        >
          {sharing
            ? <ActivityIndicator size="small" color={C.ink} style={{ width: 20 }} />
            : <Ionicons name="paper-plane-outline" size={20} color={C.ink} />}
        </Pressable>

      </View>

      {/* Newest comment, LinkedIn style: the conversation is visible from the
          feed, and the whole block opens the sheet. */}
      {!!topComment && (
        <Pressable onPress={() => openComments(item._id)} className="mt-2 px-gutter active:opacity-85" accessibilityRole="button" accessibilityLabel="Open comments">
          <View className="flex-row">
            <Avatar user={topComment.commentor as any} size={24} />
            <View className="ml-2 flex-1">
              <Text className="font-semibold text-sm text-ink">
                {topComment.commentor?.name || topComment.commentor?.username || 'Someone'}
              </Text>
              <Text className="font-sans text-sm text-ink-2 mt-0.5" numberOfLines={2}>
                {topComment.text}
              </Text>
            </View>
          </View>
          {displayCommentCount > 1 && (
            <Text className="font-semibold text-sm text-ink-3 mt-2 ml-8">
              See {formatCount(displayCommentCount - 1)} more {displayCommentCount === 2 ? 'comment' : 'comments'}
            </Text>
          )}
        </Pressable>
      )}
    </Reanimated.View>
  );
});

// --- MAIN SCREEN ---
export default function HomeScreen() {
  const tabBarClearance = useTabBarClearance();
  const autoHideTabBar = useTabBarAutoHide();
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
  // A response for the tab you just left must not paint over the one you are on.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // onEndReached can fire again before the loadingMore state commits.
  const loadingMoreRef = useRef(false);

  const [feed, setFeed] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const { user } = useAuth();

  const [isCommentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);





  const fetchFeed = useCallback(async (pageNum: number, shouldRefresh = false) => {
    const tab = activeTab;
    const isCurrent = () => activeTabRef.current === tab;
    const currentHasMore = activeTab === 'forYou' ? forYouHasMore : followingHasMore;
    if (!currentHasMore && !shouldRefresh && pageNum !== 1) return;

    if (pageNum === 1) {
      // 1. Try to load from cache first for instant UI
      const cacheKey = `fync_feed_${activeTab}`;
      const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
      let parsed: Post[] | null = null;
      try { parsed = cached ? JSON.parse(cached) : null; } catch { parsed = null; }
      if (Array.isArray(parsed) && !shouldRefresh) {
        prefetchPostImages(parsed);
        if (activeTab === 'forYou') setForYouFeed(parsed);
        else setFollowingFeed(parsed);
        if (isCurrent()) setFeed(parsed);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    
    if (pageNum > 1) {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      let newPosts: Post[] = [];
      let serverHasMore = true;

      if (activeTab === 'following') {
        const cursorParam = (pageNum === 1 ? null : followingCursorRef.current);
        const res = await axios.get(`/post/feed/followers?${cursorParam ? `cursor=${cursorParam}` : ''}&limit=10`);
        if (res.data.success) {
          newPosts = Array.isArray(res.data.posts) ? res.data.posts : [];
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
            seenBloom: await getSeenPostsBloom(pageNum),
          }));

        if (res.data.success) {
          newPosts = Array.isArray(res.data.posts) ? res.data.posts : [];
          serverHasMore = res.data.hasMore ?? newPosts.length >= 10;
          if (newPosts.length > 0) markPostsAsSeen(newPosts.map((p: Post) => p._id));
          if (res.data.mode === 'recycled') resetSeenPosts();
        }
      }

      prefetchPostImages(newPosts);
      if (pageNum === 1 && isCurrent()) setFeedError(false);

      // Update the specific tab state and the active feed
      if (activeTab === 'forYou') {
        const have = new Set(forYouFeed.map(fp => fp._id));
        const updatedForYou = (shouldRefresh || pageNum === 1) ? newPosts : [...forYouFeed, ...newPosts.filter(p => !have.has(p._id))];
        setForYouFeed(updatedForYou);
        setForYouHasMore(serverHasMore);
        setForYouPage(pageNum);
        if (isCurrent()) {
          setFeed(updatedForYou);
          setHasMore(serverHasMore);
          setPage(pageNum);
        }
        // Cache the first page
        if (pageNum === 1) AsyncStorage.setItem(`fync_feed_forYou`, JSON.stringify(updatedForYou));
      } else {
        const have = new Set(followingFeed.map(fp => fp._id));
        const updatedFollowing = (shouldRefresh || pageNum === 1) ? newPosts : [...followingFeed, ...newPosts.filter(p => !have.has(p._id))];
        setFollowingFeed(updatedFollowing);
        setFollowingHasMore(serverHasMore);
        setFollowingPage(pageNum);
        setFollowingLoadedOnce(true);
        if (isCurrent()) {
          setFeed(updatedFollowing);
          setHasMore(serverHasMore);
          setPage(pageNum);
        }
        // Cache the first page
        if (pageNum === 1) AsyncStorage.setItem(`fync_feed_following`, JSON.stringify(updatedFollowing));
      }
    } catch (error) {
      console.log('Failed to load feed', error);
      if (pageNum === 1 && isCurrent()) setFeedError(true);
      // loadMore already advanced the page; roll back so the next scroll retries
      // this page instead of skipping it.
      if (pageNum > 1 && isCurrent()) setPage(pageNum - 1);
    } finally {
      if (pageNum > 1) loadingMoreRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [activeTab, forYouFeed, followingFeed, forYouHasMore, followingHasMore]);

  useEffect(() => {
    setProfileImage(user?.avatar);
  }, [user?.avatar]);

  useEffect(() => {
    if (user?._id) {
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
  }, [user?._id, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    DeviceEventEmitter.emit(STORIES_REFRESH);
    setPage(1);
    setHasMore(true);
    await Promise.all([
      fetchFeed(1, true),
      fetchBadges()
    ]);
  }, [fetchFeed]);

  const loadMore = useCallback(() => {
    if (!loadingMore && !loadingMoreRef.current && hasMore && !loading) {
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

  /**
   * The repost sheet is owned by the screen, not by the row.
   *
   * A modal rendered inside a recycled list row is unmounted the moment the row
   * scrolls out from under it, which on Android leaves the dimmed window behind
   * with nothing left to dismiss it. The row hands up its own confirm handler
   * so the toggle state stays where it belongs.
   */
  const [repostTarget, setRepostTarget] = useState<{ item: Post; confirm: (text: string) => Promise<void> } | null>(null);

  const handleRequestRepost = useCallback((item: Post, confirm: (text: string) => Promise<void>) => {
    setRepostTarget({ item, confirm });
  }, []);

  const handleOpenComments = useCallback((postId: string) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  }, []);

  /**
   * Set a post's comment count — and its previewed comment — to what the server
   * actually returned, so posting from the sheet updates the row behind it.
   */
  /** Apply to the visible feed and both per-tab copies, so switching tabs never brings back the old row. */
  const patchFeeds = useCallback((fn: (posts: Post[]) => Post[]) => {
    setFeed(fn);
    setForYouFeed(fn);
    setFollowingFeed(fn);
  }, []);

  const handleCommentCount = useCallback((postId: string, count: number, newest?: any) => {
    patchFeeds((currentFeed) =>
      currentFeed.map((post) =>
        post._id === postId
          ? { ...post, commentCount: count, comments: newest ? [newest] : [] }
          : post,
      ),
    );
  }, [patchFeeds]);

  // Snapshot for rollback, read through a ref so this callback stays stable and
  // a page load does not re-render every visible row.
  const feedsRef = useRef({ feed, forYouFeed, followingFeed });
  feedsRef.current = { feed, forYouFeed, followingFeed };

  const handleDeletePost = useCallback(async (postId: string) => {
    const previous = feedsRef.current;
    // Optimistic update
    patchFeeds(prev => prev.filter(p => p._id !== postId));
    
    try {
      const res = await axios.delete(`/post/${postId}`);
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Post deleted successfully' });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      // Rollback
      setFeed(previous.feed);
      setForYouFeed(previous.forYouFeed);
      setFollowingFeed(previous.followingFeed);
      console.log('Failed to delete post', error);
      Toast.show({ type: 'error', text1: 'Failed to delete post' });
    }
  }, [patchFeeds]);

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

  // PostItem only reads the id; a fresh object per setUser would re-render every row.
  const currentUser = useMemo(() => (user?._id ? { _id: user._id } : null), [user?._id]);

  // One ⋯ sheet for the whole feed: a row sets the target, the sheet builds from it.
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const renderPostItem = useCallback(({ item, index }: { item: any, index: number }) => {
    if (item.__suggestions) return <FollowSuggestions offset={item.offset} />;
    return (
      <PostItem
        item={item}
        index={index}
        currentUser={currentUser}
        openComments={handleOpenComments}
        onOpenMenu={setMenuPost}
        onRequestRepost={handleRequestRepost}
      />
    );
  }, [currentUser, handleOpenComments, handleRequestRepost]);

  // Asking what is wrong in the same step is fewer taps than a nested confirm,
  // and the only way a moderator learns anything useful from the report.
  const reportPost = async (postId: string, reason: string) => {
    try {
      await axios.post('/post/report', { postId, reason });
      Toast.show({
        type: 'success',
        text1: 'Reported',
        text2: 'Thanks — we will take a look.',
      });
    } catch {
      Alert.alert('Could not report', 'That did not send. Try again.', [{ text: 'Okay' }]);
    }
  };
  const menuActions: SheetAction[] = !menuPost ? [] : menuPost.user?._id === currentUser?._id ? [
    { label: 'Delete post', icon: 'trash-outline', danger: true, onPress: () => handleDeletePost(menuPost._id) },
  ] : [
    { label: 'Spam or scam', icon: 'flag-outline', hint: 'Report this post', onPress: () => reportPost(menuPost._id, 'Spam or scam') },
    { label: 'Harassment or abuse', icon: 'hand-left-outline', hint: 'Report this post', onPress: () => reportPost(menuPost._id, 'Harassment or abuse') },
    { label: 'Explicit content', icon: 'eye-off-outline', hint: 'Report this post', danger: true, onPress: () => reportPost(menuPost._id, 'Explicit content') },
  ];



  // Drawer avatar sits beside the title, inside the AppBar row.
  const appBarTitle = (
    <View className="flex-row items-center gap-2">
      <Pressable onPress={() => navigation.openDrawer()} hitSlop={4} className="active:opacity-85" accessibilityRole="button" accessibilityLabel="Open menu">
        {/* mockup .av.ring-student: box-shadow 0 0 0 2px card, 0 0 0 4px student.
            RN has no spread shadow, so the two rings are a 2px card-coloured
            pad inside a 2px brand border. */}
        <View className="rounded-full border-2 border-brand-500 bg-card" style={{ padding: 2 }}>
          <ExpoImage
            source={{ uri: getFullUrl(profileImage) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'U')}&background=random&color=fff` }}
            style={{ width: 28, height: 28, borderRadius: 999 }}
            cachePolicy="disk"
          />
        </View>
      </Pressable>
      <H2 style={{ flexShrink: 1 }} numberOfLines={1}>Fync</H2>
    </View>
  );

  // Narrower than IconBtn's 44pt box so the four header actions sit closer;
  // IconBtn's 4pt hitSlop brings 36 back to a 44pt tap target.
  const HEADER_ICON = { width: 36 };
  const appBarRight = (
    <>
      {/* Streak Display */}
      <Pressable
        onPress={() => setShowLeaderboard(true)}
        hitSlop={8}
        className="flex-row items-center bg-paper-2 px-2.5 py-1 rounded-full mr-1 active:opacity-85"
        accessibilityRole="button"
        accessibilityLabel={`Streak, ${(user as any)?.streakCount || 0} days. Open leaderboard`}
      >
        <Flame active={((user as any)?.streakCount || 0) > 0} />
        <Text className="font-semibold text-xs ml-0.5 text-ink">
          {(user as any)?.streakCount || 0}
        </Text>
      </Pressable>
      <IconBtn style={HEADER_ICON} name="search-outline" accessibilityLabel="Search people" onPress={() => navigation.navigate('SearchScreen')} />
      <IconBtn style={HEADER_ICON} name="heart-outline" badge={unreadCount} accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} new` : 'Notifications'} onPress={() => navigation.navigate('Notification')} />
      <IconBtn style={HEADER_ICON} name="chatbubble-ellipses-outline" badge={chatUnreadCount} accessibilityLabel={chatUnreadCount ? `Messages, ${chatUnreadCount} unread` : 'Messages'} onPress={() => navigation.navigate('ChatList')} />
    </>
  );

  const renderTabBar = () => (
    <Tabs
      fill
      items={FEED_TABS}
      value={activeTab === 'forYou' ? 'For you' : 'Following'}
      onChange={(t) => setActiveTab(t === 'For you' ? 'forYou' : 'following')}
      style={{ marginTop: -10 }}
    />
  );


  // Elements, not inline render functions: a new function each render reads to
  // the list as a new component type and remounts the header (ads, grid) on
  // every badge or paging update.
  const listFooter = useMemo(() => {
    if (!loadingMore) return <View className="h-20" />;
    return (
      <View className="py-4 h-20">
        <ActivityIndicator size="small" color={C.brand[500]} />
      </View>
    );
  }, [loadingMore]);
  const showSkeleton = loading && feed.length === 0;
  const listHeader = useMemo(() => (
    <View>
      {renderTabBar()}
      <View className="bg-transparent">
        <AdCarousel />
        <StoriesRow />
        {/* <CreatePost /> */}
        {showSkeleton && (
          <View>
            {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
          </View>
        )}
      </View>
    </View>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [activeTab, showSkeleton, user?.name, (user as any)?.streakCount, unreadCount]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />
      
      <AppBar right={appBarRight}>{appBarTitle}</AppBar>

      {/* FlashList recycles cells instead of keeping every mounted row alive,
          which is what stops the blank-cell flash on a fast scroll once the
          feed is thousands of posts long. v2 sizes cells itself, so the
          FlatList windowing props it replaces are gone. */}
      <FlashList keyboardShouldPersistTaps="handled"
        data={feedWithSuggestions}
        {...autoHideTabBar}
        keyExtractor={(item) => item._id}
        renderItem={renderPostItem}
        getItemType={(item) => (item.__suggestions ? 'suggestions' : item.image?.length ? 'media' : 'text')}
        ListHeaderComponent={listHeader}

        refreshControl={
          <FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          !loading && !refreshing ? (feedError ? (
            <View className="mt-16">
              <Empty
                icon="cloud-offline-outline"
                title="Couldn't load your feed"
                hint="Check your connection and try again."
                action={<Button title="Try again" onPress={onRefresh} />}
              />
            </View>
          ) : (
            <View className="mt-16">
              <Empty
                icon="people-outline"
                title="Welcome to Fync"
                hint="Follow people to fill your feed."
                action={<Button variant="primary" title="Find people" onPress={() => navigation.navigate('SearchScreen')} />}
              />
            </View>
          )) : null
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

      {!!repostTarget && (
        <RepostModal
          visible
          onClose={() => setRepostTarget(null)}
          onConfirm={repostTarget.confirm}
          author={repostTarget.item.user}
          preview={repostTarget.item.description}
        />
      )}

      <ActionSheet
        visible={!!menuPost}
        onClose={() => setMenuPost(null)}
        title={menuPost?.user?._id === currentUser?._id ? 'Post options' : 'Report this post'}
        subtitle={menuPost ? `${menuPost.user?.name || 'Unknown'}${menuPost.description ? ` · ${String(menuPost.description).slice(0, 60)}` : ''}` : undefined}
        actions={menuActions}
      />

      <StreakLeaderboardModal 
        isVisible={showLeaderboard} 
        onClose={() => setShowLeaderboard(false)} 
      />

    </View>
  );
}
