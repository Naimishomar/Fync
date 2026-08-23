import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {View, Text, FlatList, Dimensions, Pressable, Image, ViewToken, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, ToastAndroid, Share, Linking} from 'react-native'
import { Video, ResizeMode } from "expo-av";
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  getSeenShortIds,
  markShortsAsSeen,
  resetSeenShorts,
} from "../utils/feedSession";
import { useTabBarClearance } from '../constants/layout';
import { Alert } from './ui/AlertModal';
import CommentsSheet from './ui/CommentsSheet';
import YouTubeShort from './YouTubeShort';


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
  user: User;
  /* Discover items: aggregated tech content that fills the feed once the campus
     shorts run out. They live only in this array — nothing is stored. */
  discover?: boolean;
  videoId?: string;
  url?: string;
  source?: string;
  thumbnail?: string;
  account?: string;
}

/* ---------------- GLOBAL CACHE ---------------- */
let globalShortsCache: ShortItem[] = [];
let globalShortsPage = 0;
let globalHasMore = true;
// Discover takes over when the campus feed is exhausted, so the scroll never
// dead-ends in the early days when few students have posted.
let globalDiscoverCursor = 0;
let globalDiscoverExhausted = false;

/* ---------------- COMPONENT ---------------- */

const SingleShort = React.memo(({
  item,
  isActive,
  isPreBuffer,
  currentUserId,
  navigation,
  onLike,
  onComment,
  onDelete
}: {
  item: ShortItem;
  isActive: boolean;
  isPreBuffer?: boolean;
  currentUserId: string | undefined;
  navigation: any;
  onLike: (item: ShortItem) => void;
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

  useEffect(() => {
    if (isActive && isFocused) {
      videoRef.current?.playAsync();
      queueShortView(item._id);
    } else if (isPreBuffer) {
      // 🚀 Pre-buffer but don't play
      videoRef.current?.setStatusAsync({ shouldPlay: false, positionMillis: 0 });
    } else {
      videoRef.current?.pauseAsync();
    }
  }, [isActive, isFocused, isPreBuffer]);

  const togglePlay = async () => {
    if (!videoRef.current) return;
    const status = await videoRef.current.getStatusAsync();
    if (status.isLoaded && status.isPlaying) {
      await videoRef.current.pauseAsync();
      setShowIcon("play");
    } else {
      await videoRef.current.playAsync();
      setShowIcon("pause");
    }
    setTimeout(() => setShowIcon(null), 600);
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://fync-api.duckdns.org/view?shortId=${item._id}`;
      const playStoreUrl = "https://play.google.com/store/apps/details?id=com.fync.app";

      await Share.share({
        message: `Check out this short "${item.title}" by ${item.user.username} on Fync!\n\nWatch here: ${shareUrl}\n\nDon't have Fync? Get it on Play Store: ${playStoreUrl}`,
      });
    } catch (error: any) {
      console.log('Share error:', error.message);
    }
  };

  return (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }} className="bg-ink">
      <Pressable onPress={togglePlay}>
        <Video
          ref={videoRef}
          source={{ uri: getFullUrl(item.video) || '' }}
          style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }}
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

      {/* -------- BOTTOM OVERLAY -------- */}
      <View className="absolute bottom-32 left-4 right-4 flex-row justify-between items-end">
        {/* LEFT */}
        <View className="flex-1 pr-6">
          <Pressable
            onPress={() => {
              if (item.user._id === currentUserId) {
                navigation.navigate("Profile");
              } else {
                navigation.navigate("PublicProfile", { user: item.user });
              }
            }}
            className="flex-row items-center mb-1"
          >
            <Avatar 
              user={item.user as any} 
              size={40} 
            />
            <View className="ml-3">
              <Text className="font-semibold text-base text-white">{item.user.name}</Text>
              <Text className="font-sans text-sm text-night-3">@{item.user.username}</Text>
            </View>
          </Pressable>

          {/* Truncated Title & Description */}
          <View>
            <Text className="font-display text-base text-white mb-1">
              {(!showFullText && item.title.length > 50) 
                ? item.title.substring(0, 50) + "..." 
                : item.title}
            </Text>
            <Text className="font-sans text-sm text-night-ink">
              {(!showFullText && item.description.length > 50) 
                ? item.description.substring(0, 50) + "..." 
                : item.description}
            </Text>
            
            {(item.title.length > 50 || item.description.length > 50) && (
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
          {item.user._id === currentUserId && (
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
              <Ionicons name="trash-outline" size={28} color="#DC2626" />
            </Pressable>
          )}

          <Pressable onPress={() => onLike(item)}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={34}
              color={isLiked ? "#F97316" : "#FFFFFF"}
            />
          </Pressable>
          <Text className="font-display text-label text-white mb-4">{item.likes || 0}</Text>

          <Pressable onPress={() => onComment(item._id)} className="mb-4">
            <Ionicons name="chatbubble-outline" size={28} color="white" />
          </Pressable>

          <Pressable
            onPress={async () => {
              if (item.user.upiId) {
                // Opens the phone's UPI app with the creator's ID filled in.
                // This used to navigate to "EnterAmountScreen", which is not
                // registered in any navigator and has never existed — every tap
                // threw "not handled by any navigator". The amount and the
                // confirmation belong to the UPI app anyway; nothing is
                // authorised here.
                const url =
                  `upi://pay?pa=${encodeURIComponent(item.user.upiId)}` +
                  `&pn=${encodeURIComponent(item.user.name ?? 'Creator')}&cu=INR`;
                const ok = await Linking.canOpenURL(url).catch(() => false);
                if (ok) {
                  Linking.openURL(url);
                } else {
                  Alert.alert(
                    "No UPI app found",
                    `Install a UPI app to tip ${item.user.name}, or send to ${item.user.upiId}.`,
                    [{ text: "Okay" }]
                  );
                }
              } else {
                Alert.alert(
                  "Payments Not Setup",
                  `${item.user.name} hasn't added their UPI ID yet.`,
                  [{ text: "Okay" }]
                );
              }
            }}
            className="mb-4 items-center"
          >
            <View className="bg-brand-500/20 p-2 rounded-full border border-brand-500/40">
              <Ionicons name="cash-outline" size={26} color="#F97316" />
            </View>
            <Text className="font-display text-label text-brand-400 mt-1 uppercase">Tip</Text>
          </Pressable>

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


/* ---------------- DISCOVER CARD ---------------- */
/**
 * Creative Commons video from YouTube, shown once students' own shorts run out.
 *
 * Playback is YouTube's player with its chrome switched off; everything the
 * user touches is ours. See YouTubeShort for why it never receives a gesture.
 */
const DiscoverCard = React.memo(({
  item,
  isActive,
  isNear,
  handleUnplayable,
}: {
  item: ShortItem;
  isActive: boolean;
  isNear: boolean;
  handleUnplayable: (videoId: string, code: number) => void;
}) => {
  // A WebView is expensive in a way a native view is not, so one is created
  // only for the video on screen and its immediate neighbours. The thumbnail
  // stands in for the rest, which is all the user ever sees of them.
  if (!isNear) {
    return (
      <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }} className="bg-ink">
        {!!item.thumbnail && (
          <Image
            source={{ uri: item.thumbnail }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            resizeMode="cover"
            blurRadius={6}
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }}>
      <YouTubeShort
        videoId={item.videoId!}
        isActive={isActive}
        thumbnail={item.thumbnail}
        onUnplayable={handleUnplayable}
      />
      <DiscoverAttribution item={item} />
    </View>
  );
});

/**
 * Channel credit. Not a licence condition any more, but the viewer should still
 * be able to see whose video they are watching without leaving the feed.
 */
const DiscoverAttribution = ({ item }: { item: ShortItem }) => (
  <View className="absolute bottom-32 left-4 right-4" pointerEvents="none">
    <View className="flex-row items-center mb-2">
      <View className="bg-brand-500 px-2 py-1 rounded-sm">
        <Text className="font-display text-label text-ink uppercase">Tech</Text>
      </View>
      <Text className="font-sans text-sm text-white ml-2" numberOfLines={1}>
        {item.source}
      </Text>
    </View>
    <Text className="font-display text-base text-white mb-1" numberOfLines={2}>
      {item.title}
    </Text>
    <Text className="font-sans text-night-3" style={{ fontSize: 11 }} numberOfLines={1}>
      YouTube
    </Text>
  </View>
);

export default function Shorts() {
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;

  const [shorts, setShorts] = useState<ShortItem[]>(globalShortsCache);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(globalShortsCache.length > 0 ? globalShortsCache[0]._id : null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(globalShortsCache.length === 0);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activeShortId, setActiveShortId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  /* ---------------- FETCH ---------------- */

  const fetchShorts = async (page = 0, shouldRefresh = false) => {
    const isFirstPage = page <= 1;
    if (!globalHasMore && !shouldRefresh && !isFirstPage) return;
    // A refresh rebuilds the cache from scratch, so the discover cursor has to
    // go back with it — otherwise it stays parked past the end and the feed
    // never refills after the first pull-to-refresh.
    if (shouldRefresh || isFirstPage) {
      globalDiscoverCursor = 0;
      globalDiscoverExhausted = false;
    }
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    try {
      const seenIds = await getSeenShortIds();

      const res = await axios.post(`/shorts/smart?page=${Math.max(page, 1)}`, { seenIds });

      if (res.data.success) {
        const newShorts = res.data.shorts;
        // 'recycled' means the campus feed has nothing new left and is about to
        // replay what the user has already watched. The server still reports
        // hasMore: true, because it ranks against the refilled pool — so
        // trusting it here is what kept the feed looping on students' shorts
        // and never reaching Discover.
        const campusExhausted = res.data.mode === 'recycled';

        if (shouldRefresh || isFirstPage) {
          globalShortsCache = newShorts;
          setShorts(newShorts);
          if (newShorts.length > 0 && !activeVideoId) setActiveVideoId(newShorts[0]._id);
        } else if (campusExhausted) {
          // Deliberately not appended: these are repeats, and Discover has
          // genuinely new material to show instead.
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
          // Clear the history so the next session's campus feed feels fresh
          // again, then hand straight over rather than waiting for another
          // scroll to trigger it.
          resetSeenShorts();
          if (!globalDiscoverExhausted) void fetchDiscover();
        }
      }
    } catch (err) {
      try {
        const cursor = isFirstPage ? '' : globalShortsCache[globalShortsCache.length - 1]?._id;
        const res = await axios.get(`/shorts/all?cursor=${cursor || ''}`);
        if (res.data.success) {
          const newShorts = res.data.shorts;
          if (shouldRefresh || isFirstPage) {
            globalShortsCache = newShorts;
            setShorts(newShorts);
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

  /* Campus shorts are finite; this is what keeps scrolling. Items are fetched
     live from the backend aggregator and appended in place — they are never
     written to our database, so the feed costs storage nothing. */
  const fetchDiscover = async () => {
    setLoadingMore(true);
    try {
      const seen = globalShortsCache.filter(s => s.discover).map(s => s._id).slice(-120);
      const res = await axios.get('/shorts/discover', {
        params: { cursor: globalDiscoverCursor, limit: 10, seen: seen.join(',') },
      });
      if (!res.data.success) return;

      const mapped: ShortItem[] = res.data.items.map((i: any) => ({
        _id: i.id,
        video: '',
        title: i.title,
        description: i.description || '',
        likes: 0,
        liked_by: [],
        views: 0,
        user: { _id: i.id, name: i.source, username: i.source },
        discover: true,
        videoId: i.videoId,
        url: i.url,
        source: i.source,
        thumbnail: i.thumbnail,
        account: i.account,
      }));

      globalShortsCache = [
        ...globalShortsCache,
        ...mapped.filter(m => !globalShortsCache.find(x => x._id === m._id)),
      ];
      setShorts(globalShortsCache);
      globalDiscoverCursor = res.data.nextCursor;
      globalDiscoverExhausted = !res.data.hasMore && !res.data.recycled;
    } catch { /* a dead source must not break the campus feed above it */ }
    finally { setLoadingMore(false); }
  };

  /**
   * Drop a dead video and tell the server.
   *
   * Removed from the list rather than left showing an error card: a student
   * swiping a feed should never have to read an error code.
   */
  const handleUnplayable = useCallback((videoId: string, code: number) => {
    globalShortsCache = globalShortsCache.filter(s => s.videoId !== videoId);
    setShorts(globalShortsCache);
    axios.post('/shorts/discover/unplayable', { videoId, code }).catch(() => {});
  }, []);

  const loadMore = () => {
    if (loadingMore) return;
    if (globalHasMore) {
      fetchShorts(globalShortsPage + 1);
    } else if (!globalDiscoverExhausted) {
      fetchDiscover();
    }
  };

  /* ---------------- VIDEO CONTROL ---------------- */

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems.length) return;
      const item = viewableItems[0].item as ShortItem;
      const index = viewableItems[0].index;
      if (activeVideoId !== item._id) {
        setActiveVideoId(item._id);
      }
      
      // 🚀 PRE-FETCH Logic: If we are within 4 items of the end, start loading the next batch now
      if (index !== null && index >= shorts.length - 4 && globalHasMore && !loadingMore) {
        loadMore();
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  /* ---------------- LIKE ---------------- */

  const toggleLike = async (short: ShortItem) => {
    if (!currentUserId) return;

    const token = await AsyncStorage.getItem("token");
    const isLiked = short.liked_by.includes(currentUserId);

    const updatedShorts = shorts.map(s =>
      s._id === short._id
        ? {
          ...s,
          likes: isLiked ? s.likes - 1 : s.likes + 1,
          liked_by: isLiked
            ? s.liked_by.filter(id => id !== currentUserId)
            : [...s.liked_by, currentUserId],
        }
        : s
    );

    setShorts(updatedShorts);
    globalShortsCache = updatedShorts;

    axios.post(`/shorts/like/${short._id}`);
  };

  /**
   * Open the comment sheet for a short.
   *
   * This used to fetch comments into local state and stop there — it never set
   * the active short or made the modal visible, so the comment button did
   * nothing at all. The sheet loads its own data, so opening it is the whole job.
   */
  const openComments = (shortId: string) => {
    setActiveShortId(shortId);
    setCommentModalVisible(true);
  };

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

  const deleteShort = async (id: string) => {
    const previousShorts = shorts;
    // Optimistic update
    const updatedShorts = shorts.filter(s => s._id !== id);
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
  };

  const renderItem = useCallback(({ item, index }: { item: ShortItem, index: number }) => {
    // 🚀 Look-Ahead Buffer: We play the active one, and PRE-BUFFER the next one
    const isNext = index === shorts.findIndex(s => s._id === activeVideoId) + 1;

    if (item.discover) {
      return (
        <DiscoverCard
          item={item}
          isActive={item._id === activeVideoId}
          isNear={Math.abs(index - shorts.findIndex(s => s._id === activeVideoId)) <= 1}
          handleUnplayable={handleUnplayable}
        />
      );
    }

    return (
      <SingleShort
        item={item}
        isActive={item._id === activeVideoId}
        isPreBuffer={isNext}
        currentUserId={currentUserId}
        navigation={navigation}
        onLike={toggleLike}
        onComment={openComments}
        onDelete={deleteShort}
      />
    );
  }, [activeVideoId, currentUserId, navigation, toggleLike, deleteShort, shorts]);


  if (loading && shorts.length === 0) {
    return <ShortsSkeleton />;
  }

  return (
    <>
      <FlatList
        data={shorts}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        scrollEventThrottle={16}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />

      {/* One shared sheet, not a fourth copy of it. */}
      <CommentsSheet
        visible={commentModalVisible}
        onClose={() => setCommentModalVisible(false)}
        resource="shorts"
        targetId={activeShortId}
        currentUser={user}
      />
    </>
  );
}
