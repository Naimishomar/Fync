import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {View, Text, FlatList, Dimensions, Pressable, ViewToken, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, ToastAndroid, Share, Linking, StatusBar} from 'react-native'
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useIsFocused } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/auth.context";
import axios from "../context/axiosConfig";
import Avatar from "./Avatar";
import { ShortsSkeleton } from "./Skeleton";
import { getFullUrl } from "../utils/imageUtils";
import { queueShortView, flushShortViews } from "../utils/shortViews";
import {
  checkAndStartSession,
  getSeenShortsBloom,
  markShortsAsSeen,
  resetSeenShorts,
} from "../utils/feedSession";
import { useTabBarClearance, useTabBarAutoHide } from '../constants/layout';
import { Alert } from './ui/AlertModal';
import CommentsSheet from './ui/CommentsSheet';
import RepostModal from './ui/RepostModal';
import { C } from '../constants/colors';
import { isFeatureOn } from '../constants/features';
import { Button } from './ui/kit';
import { HeartBurst, useDoubleTap } from './ui/HeartBurst';
import { tapHaptic } from '../utils/haptics';


/* ---------------- CONSTANTS ---------------- */

const SCREEN_HEIGHT = Dimensions.get("screen").height;
const SCREEN_WIDTH = Dimensions.get("screen").width;

/* ---------------- TYPES ---------------- */

interface User {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
  user_access?: 'admin' | 'user' | 'alumni';
  upiId?: string;
}

interface ShortItem {
  _id: string;
  video: string;
  title: string;
  description: string;
  likes: number;
  liked_by: string[];
  views: number;
  reposts?: number;
  repostedBy?: string[];
  user: User;
}

/* ---------------- GLOBAL CACHE ---------------- */
let globalShortsCache: ShortItem[] = [];
let globalShortsPage = 0;
let globalHasMore = true;

/* ---------------- COMPONENT ---------------- */

const SingleShort = React.memo(({
  item,
  isActive,
  isPreBuffer,
  height,
  currentUserId,
  navigation,
  onLike,
  onRepost,
  onComment,
  onDelete
}: {
  item: ShortItem;
  isActive: boolean;
  isPreBuffer?: boolean;
  height: number;
  currentUserId: string | undefined;
  navigation: any;
  onLike: (item: ShortItem) => void;
  onRepost: (item: ShortItem) => void;
  onComment: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const [showIcon, setShowIcon] = useState<"play" | "pause" | null>(null);
  const [showFullText, setShowFullText] = useState(false);
  const videoRef = useRef<Video>(null);
  const isLiked = useMemo(() => {
    if (!currentUserId || !item.liked_by) return false;
    return item.liked_by.some(id => String(id) === String(currentUserId));
  }, [item.liked_by, currentUserId]);

  const isFocused = useIsFocused();
  // A short whose author was deleted arrives with user: null.
  const author = item.user ?? ({} as User);
  const title = item.title || '';
  const description = item.description || '';

  useEffect(() => {
    // These reject while the source is still loading; the shouldPlay prop
    // covers that case, so the rejection is noise.
    if (isActive && isFocused) {
      videoRef.current?.playAsync().catch(() => {});
      queueShortView(item._id);
    } else if (isPreBuffer) {
      // 🚀 Pre-buffer but don't play
      videoRef.current?.setStatusAsync({ shouldPlay: false, positionMillis: 0 }).catch(() => {});
    } else {
      videoRef.current?.pauseAsync().catch(() => {});
    }
  }, [isActive, isFocused, isPreBuffer]);

  const togglePlay = async () => {
    if (!videoRef.current) return;
    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await videoRef.current.pauseAsync();
        setShowIcon("play");
      } else {
        await videoRef.current.playAsync();
        setShowIcon("pause");
      }
      setTimeout(() => setShowIcon(null), 600);
    } catch { /* still loading or already unloaded: a tap must not raise */ }
  };

  // Single tap pauses/plays; double tap likes (never unlikes) with a heart burst.
  const [burst, setBurst] = useState(0);
  const onVideoPress = useDoubleTap(togglePlay, () => {
    setBurst(n => n + 1);
    if (isLiked) tapHaptic();
    else onLike(item);
  });

  const handleShare = async () => {
    try {
      const shareUrl = `https://fync-api.duckdns.org/view?shortId=${item._id}`;
      const playStoreUrl = "https://play.google.com/store/apps/details?id=com.naimishomar.fync";

      await Share.share({
        message: `Check out this short "${item.title}" by ${author.username ?? 'a student'} on Fync!\n\nWatch here: ${shareUrl}\n\nDon't have Fync? Get it on Play Store: ${playStoreUrl}`,
      });
    } catch (error: any) {
      console.log('Share error:', error.message);
    }
  };

  return (
    <View style={{ height, width: SCREEN_WIDTH }} className="bg-night">
      <Pressable onPress={onVideoPress}>
        <Video
          ref={videoRef}
          source={{ uri: getFullUrl(item.video) || '' }}
          style={{ height, width: SCREEN_WIDTH }}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive && isFocused}
          isMuted={false}
          useNativeControls={false}
        />
      </Pressable>

      {showIcon && (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <Ionicons
            name={showIcon === "play" ? "play" : "pause"}
            size={72}
            color="white"
          />
        </View>
      )}

      <HeartBurst trigger={burst} size={110} />

      {/* -------- BOTTOM OVERLAY -------- */}
      <View className="absolute bottom-32 left-4 right-4 flex-row justify-between items-end">
        {/* LEFT */}
        <View className="flex-1 pr-6">
          <Pressable
            onPress={() => {
              if (!author._id) return;
              if (author._id === currentUserId) {
                navigation.navigate("Profile");
              } else {
                navigation.navigate("PublicProfile", { user: author });
              }
            }}
            className="flex-row items-center mb-1"
          >
            <Avatar 
              user={author as any} 
              size={40} 
            />
            <View className="ml-3 flex-1" style={{ minWidth: 0 }}>
              <Text className="font-semibold text-base text-white" numberOfLines={1}>{author.name}</Text>
              <Text className="font-sans text-sm text-night-3" numberOfLines={1}>@{author.username}</Text>
            </View>
          </Pressable>

          {/* Truncated Title & Description */}
          <View>
            <Text className="font-display text-base text-white mb-1">
              {(!showFullText && title.length > 50) 
                ? title.substring(0, 50) + "..." 
                : title}
            </Text>
            <Text className="font-sans text-sm text-night-ink">
              {(!showFullText && description.length > 50) 
                ? description.substring(0, 50) + "..." 
                : description}
            </Text>
            
            {(title.length > 50 || description.length > 50) && (
              <Pressable onPress={() => setShowFullText(!showFullText)} className="mt-1">
                <Text className="font-semibold text-sm text-brand-400">
                  {showFullText ? "Show Less" : "Show More"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* RIGHT */}
        <View className="items-center">
          {!!author._id && author._id === currentUserId && (
            <Pressable
              onPress={() => {
                Alert.alert(
                  "Delete Short",
                  "Are you sure you want to delete this short?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => onDelete(item._id) }
                  ]
                );
              }}
              className="mb-4"
            >
              <Ionicons name="trash-outline" size={28} color={C.danger} />
            </Pressable>
          )}

          <Pressable onPress={() => onLike(item)}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={34}
              color={isLiked ? C.brand[500] : "#FFFFFF"}
            />
          </Pressable>
          <Text className="font-display text-label text-white mb-4">{item.likes || 0}</Text>

          <Pressable onPress={() => onComment(item._id)} className="mb-4">
            <Ionicons name="chatbubble-outline" size={28} color="white" />
          </Pressable>

          {/* UPI tips are off for the store launch (Play billing review). */}
          {isFeatureOn('creatorTips') && (
          <Pressable
            onPress={async () => {
              if (author.upiId) {
                // Opens the phone's UPI app with the creator's ID filled in.
                // This used to navigate to "EnterAmountScreen", which is not
                // registered in any navigator and has never existed — every tap
                // threw "not handled by any navigator". The amount and the
                // confirmation belong to the UPI app anyway; nothing is
                // authorised here.
                const url =
                  `upi://pay?pa=${encodeURIComponent(author.upiId)}` +
                  `&pn=${encodeURIComponent(author.name ?? 'Creator')}&cu=INR`;
                const ok = await Linking.canOpenURL(url).catch(() => false);
                if (ok) {
                  Linking.openURL(url);
                } else {
                  Alert.alert(
                    "No UPI app found",
                    `Install a UPI app to tip ${author.name}, or send to ${author.upiId}.`,
                    [{ text: "Okay" }]
                  );
                }
              } else {
                Alert.alert(
                  "Payments Not Setup",
                  `${author.name ?? 'This creator'} hasn't added their UPI ID yet.`,
                  [{ text: "Okay" }]
                );
              }
            }}
            className="mb-4 items-center"
          >
            <View className="bg-brand-500/20 p-2 rounded-full border border-brand-500/40">
              <Ionicons name="cash-outline" size={26} color={C.brand[500]} />
            </View>
            <Text className="font-display text-label text-brand-400 mt-1 uppercase">Tip</Text>
          </Pressable>
          )}

          {/* Not offered on your own short — the endpoint refuses it. */}
          {author._id !== currentUserId && (
            <Pressable
              onPress={() => onRepost(item)}
              className="mb-4 items-center"
              accessibilityRole="button"
              accessibilityLabel="Repost this short"
            >
              <Ionicons
                name={item.repostedBy?.some((u: any) => String(u) === String(currentUserId)) ? 'repeat' : 'repeat-outline'}
                size={28}
                color={item.repostedBy?.some((u: any) => String(u) === String(currentUserId)) ? C.brand[500] : 'white'}
              />
              {!!item.reposts && (
                <Text className="font-display text-label text-white mt-1">{item.reposts}</Text>
              )}
            </Pressable>
          )}

          <Pressable onPress={handleShare} className="mb-4">
            <Ionicons name="paper-plane-outline" size={28} color="white" />
          </Pressable>

          <Ionicons name="eye-outline" size={28} color="white" />
          <Text className="font-display text-label text-white">{item.views || 0}</Text>
        </View>
      </View>
    </View>
  );
});


export default function Shorts() {
  const tabBarClearance = useTabBarClearance();
  const autoHideTabBar = useTabBarAutoHide();
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;

  const [shorts, setShorts] = useState<ShortItem[]>(globalShortsCache);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(globalShortsCache.length > 0 ? globalShortsCache[0]._id : null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(globalShortsCache.length === 0);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  /** The short awaiting repost confirmation, or null. */
  const [repostTarget, setRepostTarget] = useState<ShortItem | null>(null);
  const [activeShortId, setActiveShortId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Pages must match the list's real height, not the device's: the screen
  // height includes system bars the list never gets, and paging by a height
  // the viewport doesn't have leaves each page a sliver off the last.
  const [pageH, setPageH] = useState(SCREEN_HEIGHT);
  const loadingMoreRef = useRef(false);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();

  /* ---------------- FETCH ---------------- */

  const fetchShorts = async (page = 0, shouldRefresh = false) => {
    const isFirstPage = page <= 1;
    if (!globalHasMore && !shouldRefresh && !isFirstPage) return;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    try {
      const seenBloom = await getSeenShortsBloom(page);

      const res = await axios.post(`/shorts/smart?page=${Math.max(page, 1)}`, { seenBloom });

      if (res.data.success) {
        const newShorts: ShortItem[] = Array.isArray(res.data.shorts) ? res.data.shorts : [];
        // 'recycled' means the campus feed has nothing new left and is about to
        // replay what the user has already watched. The server still reports
        // hasMore: true, because it ranks against the refilled pool, so the
        // feed ends here instead of looping.
        const campusExhausted = res.data.mode === 'recycled';

        if (shouldRefresh || isFirstPage) {
          globalShortsCache = newShorts;
          setShorts(newShorts);
          // Always: a refresh clears the active id, and the viewability
          // callback won't fire again if the list still starts at index 0.
          setActiveVideoId(newShorts[0]?._id ?? null);
        } else if (campusExhausted) {
          // Deliberately not appended: these are repeats.
        } else {
          globalShortsCache = [...globalShortsCache, ...newShorts.filter((s: ShortItem) => !globalShortsCache.find(x => x._id === s._id))];
          setShorts(globalShortsCache);
        }

        globalShortsPage = isFirstPage ? 1 : page;
        globalHasMore = campusExhausted ? false : (res.data.hasMore ?? newShorts.length >= 10);

        if (!campusExhausted && newShorts.length > 0) {
          markShortsAsSeen(newShorts.map((s: ShortItem) => s._id));
        }

        if (campusExhausted) {
          // Clear the history so the next session's campus feed feels fresh again.
          resetSeenShorts();
        }
      }
    } catch (err) {
      try {
        const cursor = isFirstPage ? '' : globalShortsCache[globalShortsCache.length - 1]?._id;
        const res = await axios.get(`/shorts/all?cursor=${cursor || ''}`);
        if (res.data.success) {
          const newShorts: ShortItem[] = Array.isArray(res.data.shorts) ? res.data.shorts : [];
          if (shouldRefresh || isFirstPage) {
            globalShortsCache = newShorts;
            setShorts(newShorts);
            setActiveVideoId(newShorts[0]?._id ?? null);
          } else {
            globalShortsCache = [...globalShortsCache, ...newShorts.filter((s: ShortItem) => !globalShortsCache.find(x => x._id === s._id))];
            setShorts(globalShortsCache);
          }
          globalShortsPage = isFirstPage ? 1 : page;
          globalHasMore = res.data.hasMore;
        }
      } catch { /* silent */ }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (globalShortsCache.length === 0) {
      checkAndStartSession().then(() => fetchShorts(0, true));
    }
  }, []);

  // Navigating away ends a viewing session, so send whatever is still queued
  // rather than waiting out the timer on a screen nobody is looking at.
  useFocusEffect(
    useCallback(() => {
      return () => { void flushShortViews(); };
    }, [])
  );

  /** Reference-style: the short surfaces on your profile, credited to its author. */
  const handleRepost = useCallback(async (short: ShortItem, text = '') => {
    const mine = short.repostedBy?.some((u) => String(u) === String(currentUserId));
    // Applied locally first so the icon responds to the tap, then corrected
    // from whatever the server actually stored.
    const apply = (reposted: boolean, count: number) => {
      globalShortsCache = globalShortsCache.map((s) =>
        s._id === short._id
          ? {
              ...s,
              reposts: count,
              repostedBy: reposted
                ? [...(s.repostedBy ?? []), String(currentUserId)]
                : (s.repostedBy ?? []).filter((u) => String(u) !== String(currentUserId)),
            }
          : s,
      );
      setShorts(globalShortsCache);
    };
    apply(!mine, Math.max(0, (short.reposts ?? 0) + (mine ? -1 : 1)));

    try {
      const res = await axios.post(`/shorts/repost/${short._id}`, { text });
      if (res.data?.success) apply(res.data.reposted, res.data.reposts);
    } catch (err: any) {
      apply(!!mine, short.reposts ?? 0);
      const msg = err?.response?.data?.message;
      if (msg) ToastAndroid?.show?.(msg, ToastAndroid.SHORT);
    }
  }, [currentUserId]);

  // Guarded by a ref, not the loadingMore state: onEndReached and the
  // viewability prefetch both fire in the same frame, before state updates.
  const loadMore = async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      if (globalHasMore) await fetchShorts(globalShortsPage + 1);
    } finally {
      loadingMoreRef.current = false;
    }
  };
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  /* ---------------- VIDEO CONTROL ---------------- */

  // Created once, so it must not read component state — it would see the
  // first render's forever. The module cache and loadMoreRef stay current.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems.length) return;
      const item = viewableItems[0].item as ShortItem;
      const index = viewableItems[0].index;
      setActiveVideoId(item._id);
      
      // 🚀 PRE-FETCH Logic: If we are within 4 items of the end, start loading the next batch now
      if (index !== null && index >= globalShortsCache.length - 4) {
        loadMoreRef.current();
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  /* ---------------- LIKE ---------------- */

  // Stable callbacks read the module cache (always in sync with `shorts`) so
  // the memoised rows don't all re-render on every like or swipe.
  const toggleLike = useCallback((short: ShortItem) => {
    if (!currentUserId) return;
    const uid = String(currentUserId);
    const wasLiked = (short.liked_by ?? []).some(id => String(id) === uid);
    tapHaptic();

    const apply = (liked: boolean) => {
      globalShortsCache = globalShortsCache.map(s =>
        s._id === short._id
          ? {
            ...s,
            likes: Math.max(0, (s.likes || 0) + (liked ? 1 : -1)),
            liked_by: liked
              ? [...(s.liked_by ?? []), uid]
              : (s.liked_by ?? []).filter(id => String(id) !== uid),
          }
          : s
      );
      setShorts(globalShortsCache);
    };

    apply(!wasLiked);
    axios.post(`/shorts/like/${short._id}`).catch(() => apply(wasLiked));
  }, [currentUserId]);

  /**
   * Open the comment sheet for a short.
   *
   * This used to fetch comments into local state and stop there — it never set
   * the active short or made the modal visible, so the comment button did
   * nothing at all. The sheet loads its own data, so opening it is the whole job.
   */
  const openComments = useCallback((shortId: string) => {
    setActiveShortId(shortId);
    setCommentModalVisible(true);
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      setActiveVideoId(null);
      await fetchShorts(0, true);
    } catch (e) {
      console.log("Refresh failed", e);
    } finally {
      setRefreshing(false);
    }
  };

  const deleteShort = useCallback(async (id: string) => {
    const previousShorts = globalShortsCache;
    // Optimistic update
    const updatedShorts = previousShorts.filter(s => s._id !== id);
    setShorts(updatedShorts);
    globalShortsCache = updatedShorts;

    try {
      const res = await axios.post(`/shorts/delete/${id}`);
      if (res.data.success) {
        if (Platform.OS === 'android') {
          ToastAndroid.show("Short deleted successfully", ToastAndroid.SHORT);
        } else {
          Alert.alert("Success", "Short deleted successfully");
        }
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      // Rollback
      setShorts(previousShorts);
      globalShortsCache = previousShorts;
      console.log("Delete failed", error);
      Alert.alert("Error", "Failed to delete short");
    }
  }, []);

  const onRepost = useCallback((short: ShortItem) =>
    short.repostedBy?.some((u) => String(u) === String(currentUserId))
      ? handleRepost(short)
      : setRepostTarget(short),
  [currentUserId, handleRepost]);

  const activeIndex = useMemo(
    () => shorts.findIndex(s => s._id === activeVideoId),
    [shorts, activeVideoId]
  );

  const renderItem = useCallback(({ item, index }: { item: ShortItem, index: number }) => {
    // 🚀 Look-Ahead Buffer: We play the active one, and PRE-BUFFER the next one
    const isNext = index === activeIndex + 1;

    return (
      <SingleShort
        item={item}
        isActive={item._id === activeVideoId}
        isPreBuffer={isNext}
        height={pageH}
        currentUserId={currentUserId}
        navigation={navigation}
        onLike={toggleLike}
        onRepost={onRepost}
        onComment={openComments}
        onDelete={deleteShort}
      />
    );
  }, [isFocused, activeVideoId, activeIndex, pageH, currentUserId, navigation, toggleLike, onRepost, openComments, deleteShort]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: pageH,
    offset: pageH * index,
    index,
  }), [pageH]);


  if (loading && shorts.length === 0) {
    return <ShortsSkeleton />;
  }

  return (
    <>
      {isFocused && <StatusBar barStyle="light-content" />}
      <FlatList keyboardShouldPersistTaps="handled"
        data={shorts}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageH}
        getItemLayout={getItemLayout}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - pageH) > 0.5) setPageH(h);
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        {...autoHideTabBar}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={{ height: pageH, backgroundColor: C.night }} className="items-center justify-center px-gutter">
            <Text className="text-night-3 text-center mb-4">{"Couldn't load shorts."}</Text>
            <Button title="Try again" onPress={onRefresh} />
          </View>
        }
      />

      {/* One shared sheet, not a fourth copy of it. */}
      <CommentsSheet
        visible={commentModalVisible}
        onClose={() => setCommentModalVisible(false)}
        resource="shorts"
        targetId={activeShortId}
        currentUser={user}
      />

      {!!repostTarget && (
        <RepostModal
          visible
          onClose={() => setRepostTarget(null)}
          onConfirm={(text) => handleRepost(repostTarget, text)}
          author={repostTarget.user}
          preview={repostTarget.description || repostTarget.title}
        />
      )}
    </>
  );
}
