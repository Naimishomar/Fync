import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  Pressable,
  Image,
  ViewToken,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
  ToastAndroid,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/auth.context";
import axios from "../context/axiosConfig";
import {
  checkAndStartSession,
  getSeenShortIds,
  markShortsAsSeen,
  resetSeenShorts,
} from "../utils/feedSession";


/* ---------------- CONSTANTS ---------------- */

const SCREEN_HEIGHT = Dimensions.get("screen").height;
const SCREEN_WIDTH = Dimensions.get("screen").width;

/* ---------------- TYPES ---------------- */

interface User {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
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
}

/* ---------------- GLOBAL CACHE ---------------- */
let globalShortsCache: ShortItem[] = [];
let globalCurrentPage = 1;
let globalHasMore = true;

/* ---------------- COMPONENT ---------------- */

const SingleShort = React.memo(({
  item,
  isActive,
  currentUserId,
  navigation,
  onLike,
  onComment,
  onDelete
}: {
  item: ShortItem;
  isActive: boolean;
  currentUserId: string | undefined;
  navigation: any;
  onLike: (item: ShortItem) => void;
  onComment: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const [showIcon, setShowIcon] = useState<"play" | "pause" | null>(null);
  const videoRef = useRef<Video>(null);
  const isLiked = item.liked_by.includes(currentUserId || "");

  useEffect(() => {
    if (isActive) {
      videoRef.current?.playAsync();
      axios.get(`/shorts/view/${item._id}`).catch(() => { });
    } else {
      videoRef.current?.pauseAsync();
    }
  }, [isActive]);

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

  return (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }} className="bg-black">
      <Pressable onPress={togglePlay}>
        <Video
          ref={videoRef}
          source={{ uri: item.video }}
          style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive}
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
                navigation.navigate("PublicProfile", { userId: item.user._id });
              }
            }}
            className="flex-row items-center mb-1"
          >
            <Image
              source={{ uri: item.user.avatar }}
              className="h-10 w-10 rounded-full mr-3"
            />
            <View>
              <Text className="text-white font-semibold">{item.user.name}</Text>
              <Text className="text-gray-300 text-xs">@{item.user.username}</Text>
            </View>
          </Pressable>
          <Text className="text-gray-300">{item.title}</Text>
          <Text className="text-gray-500">{item.description}</Text>
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
              <Ionicons name="trash-outline" size={28} color="#ef4444" />
            </Pressable>
          )}

          <Pressable onPress={() => onLike(item)}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={34}
              color={isLiked ? "red" : "white"}
            />
          </Pressable>
          <Text className="text-white text-xs mb-4">{item.likes || 0}</Text>

          <Pressable onPress={() => onComment(item._id)} className="mb-4">
            <Ionicons name="chatbubble-outline" size={28} color="white" />
          </Pressable>

          <Pressable
            onPress={() => {
              if (item.user.upiId) {
                navigation.navigate("EnterAmountScreen", {
                  merchantUpiId: item.user.upiId,
                  merchantName: item.user.name
                });
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
            <View className="bg-green-500/20 p-2 rounded-full border border-green-500/30">
              <Ionicons name="cash-outline" size={26} color="#4ade80" />
            </View>
            <Text className="text-green-400 text-[10px] mt-1 font-bold">TIP</Text>
          </Pressable>

          <Ionicons name="eye-outline" size={28} color="white" />
          <Text className="text-white text-xs">{item.views || 0}</Text>
        </View>
      </View>
    </View>
  );
});

export default function Shorts() {
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;

  const [shorts, setShorts] = useState<ShortItem[]>(globalShortsCache);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(globalShortsCache.length > 0 ? globalShortsCache[0]._id : null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activeShortId, setActiveShortId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [commentLoading, setCommentLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  /* ---------------- FETCH ---------------- */

  const fetchShorts = async (page = 1, shouldRefresh = false) => {
    if (!globalHasMore && !shouldRefresh && page !== 1) return;
    if (page > 1) setLoadingMore(true);

    try {
      // ── Get seen IDs from AsyncStorage (zero DB load) ──────────
      const seenIds = await getSeenShortIds();

      // ── Call AI smart endpoint ─────────────────────────────
      const res = await axios.post(`/shorts/smart?page=${page}`, { seenIds });

      if (res.data.success) {
        const newShorts = res.data.shorts;
        if (shouldRefresh || page === 1) {
          globalShortsCache = newShorts;
          setShorts(newShorts);
          if (newShorts.length > 0 && !activeVideoId) setActiveVideoId(newShorts[0]._id);
        } else {
          globalShortsCache = [...globalShortsCache, ...newShorts];
          setShorts(globalShortsCache);
        }

        globalCurrentPage = page;
        globalHasMore = res.data.hasMore ?? newShorts.length >= 10;

        // ── Mark as seen in AsyncStorage (zero DB write) ─────────
        if (newShorts.length > 0) {
          markShortsAsSeen(newShorts.map((s: ShortItem) => s._id));
        }

        // ── Limited-content magic ─────────────────────────────────
        // Backend returns 'recycled' when user has seen all shorts.
        // Immediately clear seenIds so next swipe-refresh is fresh
        // and AI scoring gives a different order every time.
        if (res.data.mode === 'recycled') {
          resetSeenShorts();
        }
      }
    } catch (err) {
      // Graceful fallback to original endpoint
      try {
        const res = await axios.get(`/shorts/get/shorts?page=${page}`);
        if (res.data.success) {
          const newShorts = res.data.shorts;
          if (shouldRefresh || page === 1) {
            globalShortsCache = newShorts;
            setShorts(newShorts);
          } else {
            globalShortsCache = [...globalShortsCache, ...newShorts];
            setShorts(globalShortsCache);
          }
          globalCurrentPage = page;
          globalHasMore = newShorts.length >= 10;
        }
      } catch { /* silent */ }
    } finally {
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (globalShortsCache.length === 0) {
      // Session-aware: clears seen list if app was closed >30 min
      checkAndStartSession().then(() => fetchShorts(1, true));
    }
  }, []);

  const loadMore = () => {
    if (!loadingMore && globalHasMore) {
      fetchShorts(globalCurrentPage + 1);
    }
  };

  /* ---------------- VIDEO CONTROL ---------------- */

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems.length) return;
      const item = viewableItems[0].item as ShortItem;
      if (activeVideoId !== item._id) {
        setActiveVideoId(item._id);
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

  const openComments = async (shortId: string) => {
    setActiveShortId(shortId);
    setCommentModalVisible(true);

    const res = await axios.get(`/shorts/comment/all/${shortId}`);
    if (res.data.success) setComments(res.data.comments);
  };


  const addComment = async () => {
    if (!commentText.trim() || !activeShortId) return;
    await axios.post(
      `/shorts/comment/add/${activeShortId}`,
      { text: commentText }
    );
    setCommentText("");
    openComments(activeShortId);
  };

  const updateComment = async (id: string) => {
    if (!editingText.trim()) return;
    setCommentLoading(id);

    await axios.post(`/shorts/comment/update/${id}`, { text: editingText });

    setEditingId(null);
    setEditingText("");
    openComments(activeShortId!);
    setCommentLoading(null);
  };

  const deleteComment = async (id: string) => {
    setCommentLoading(id);

    await axios.post(`/shorts/comment/delete/${id}`);

    openComments(activeShortId!);
    setCommentLoading(null);
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      setActiveVideoId(null);
      await fetchShorts(1, true);
    } catch (e) {
      console.log("Refresh failed", e);
    } finally {
      setRefreshing(false);
    }
  };



  const deleteShort = async (id: string) => {
    try {
      const res = await axios.post(`/shorts/delete/${id}`);
      if (res.data.success) {
        const updatedShorts = shorts.filter(s => s._id !== id);
        setShorts(updatedShorts);
        globalShortsCache = updatedShorts;
        if (Platform.OS === 'android') {
          ToastAndroid.show("Short deleted successfully", ToastAndroid.SHORT);
        } else {
          Alert.alert("Success", "Short deleted successfully");
        }
      }
    } catch (error) {
      console.log("Delete failed", error);
      Alert.alert("Error", "Failed to delete short");
    }
  };


  /* ---------------- RENDER ---------------- */

  const renderItem = useCallback(({ item }: { item: ShortItem }) => {
    return (
      <SingleShort
        item={item}
        isActive={item._id === activeVideoId}
        currentUserId={currentUserId}
        navigation={navigation}
        onLike={toggleLike}
        onComment={openComments}
        onDelete={deleteShort}
      />
    );
  }, [activeVideoId, currentUserId]);

  /* ---------------- UI ---------------- */

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
        maxToRenderPerBatch={1}
        removeClippedSubviews={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />

      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end"
        >
          {/* Backdrop */}
          <Pressable
            className="flex-1"
            onPress={() => setCommentModalVisible(false)}
          />

          {/* Sheet */}
          <View className="bg-neutral-900 rounded-t-2xl h-[75%] px-4 pt-4">
            {/* Header */}
            <View className="items-center mb-3">
              <View className="h-1 w-10 bg-gray-600 rounded-full mb-2" />
              <Text className="text-white font-semibold text-base">Comments</Text>
            </View>

            {/* Comments List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 80 }}
            >
              {comments.length === 0 && (
                <Text className="text-gray-400 text-center mt-10">
                  No comments yet
                </Text>
              )}

              {comments.map((c: any) => (
                <View key={c._id} className="flex-row mb-4">
                  <Image
                    source={{ uri: c.commentor?.avatar }}
                    className="h-9 w-9 rounded-full mr-3"
                  />

                  <View className="flex-1">
                    <View className="flex flex-row items-center gap-1">
                      <Text className="text-white font-semibold">{c.commentor?.name}</Text>
                      <Text className="text-gray-400 text-sm">@{c.commentor?.username}</Text>
                    </View>

                    {editingId === c._id ? (
                      <TextInput
                        value={editingText}
                        onChangeText={setEditingText}
                        className="text-white border-b border-gray-600 pb-1"
                        autoFocus
                      />
                    ) : (
                      <Text className="text-gray-300">{c.text}</Text>
                    )}

                    {/* Actions */}
                    {c.user?._id === currentUserId && (
                      <View className="flex-row mt-1">
                        {editingId === c._id ? (
                          <Pressable
                            onPress={() => updateComment(c._id)}
                            className="mr-4"
                          >
                            {commentLoading === c._id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text className="text-blue-400 text-xs">Save</Text>
                            )}
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => {
                              setEditingId(c._id);
                              setEditingText(c.text);
                            }}
                            className="mr-4"
                          >
                            <Text className="text-gray-400 text-xs">Edit</Text>
                          </Pressable>
                        )}

                        <Pressable onPress={() => deleteComment(c._id)}>
                          {commentLoading === c._id ? (
                            <ActivityIndicator size="small" color="red" />
                          ) : (
                            <Text className="text-red-400 text-xs">Delete</Text>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Input */}
            <View className="absolute bottom-0 left-0 right-0 border-t border-gray-800 bg-neutral-900 px-3 py-2 flex-row items-center">
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor="#888"
                className="flex-1 text-white bg-neutral-800 rounded-full px-4 py-3 mr-2"
              />
              <Pressable onPress={addComment}>
                <Text className="text-pink-300 font-semibold">Post</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </>
  );
}
