import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
  ViewToken,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/auth.context";

/* ---------------- CONSTANTS ---------------- */

const SCREEN_HEIGHT = Dimensions.get("screen").height;
const SCREEN_WIDTH = Dimensions.get("screen").width;

/* ---------------- TYPES ---------------- */

interface User {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
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

/* ---------------- COMPONENT ---------------- */

export default function Shorts() {
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;

  const videoRefs = useRef<Map<string, Video>>(new Map());
  const activeVideoId = useRef<string | null>(null);

  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [showIcon, setShowIcon] = useState<{
    id: string;
    type: "play" | "pause";
  } | null>(null);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activeShortId, setActiveShortId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [commentLoading, setCommentLoading] = useState<string | null>(null);

  /* ---------------- FETCH ---------------- */

  const fetchShorts = async () => {
    const token = await AsyncStorage.getItem("token");
    const res = await fetch("http://192.168.28.151:3000/shorts/get/shorts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setShorts(data.shorts);
  };

  useEffect(() => {
    fetchShorts();
  }, []);

  /* ---------------- VIDEO CONTROL ---------------- */

  const pauseAll = async () => {
    for (const [, ref] of videoRefs.current) {
      try {
        await ref.pauseAsync();
      } catch {}
    }
  };

  const onViewableItemsChanged = useRef(
    async ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems.length) return;

      const item = viewableItems[0].item as ShortItem;

      if (activeVideoId.current === item._id) return;

      activeVideoId.current = item._id;

      await pauseAll();

      const ref = videoRefs.current.get(item._id);
      if (ref) {
        await ref.playAsync();
      }

      // register view
      const token = await AsyncStorage.getItem("token");
      fetch(`http://192.168.28.151:3000/shorts/view/${item._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  ).current;

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 90,
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        pauseAll();
      };
    }, [])
  );

  /* ---------------- PLAY / PAUSE ---------------- */

  const togglePlay = async (id: string) => {
    const ref = videoRefs.current.get(id);
    if (!ref) return;

    const status = await ref.getStatusAsync();
    if (status.isPlaying) {
      await ref.pauseAsync();
      setShowIcon({ id, type: "play" });
    } else {
      await pauseAll();
      await ref.playAsync();
      setShowIcon({ id, type: "pause" });
    }
    setTimeout(() => setShowIcon(null), 600);
  };

  /* ---------------- LIKE ---------------- */

  const toggleLike = async (short: ShortItem) => {
    if (!currentUserId) return;

    const token = await AsyncStorage.getItem("token");
    const isLiked = short.liked_by.includes(currentUserId);

    setShorts(prev =>
      prev.map(s =>
        s._id === short._id
          ? {
              ...s,
              likes: isLiked ? s.likes - 1 : s.likes + 1,
              liked_by: isLiked
                ? s.liked_by.filter(id => id !== currentUserId)
                : [...s.liked_by, currentUserId],
            }
          : s
      )
    );

    fetch(`http://192.168.28.151:3000/shorts/like/${short._id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  };

const openComments = async (shortId: string) => {
  setActiveShortId(shortId);
  setCommentModalVisible(true);

  const token = await AsyncStorage.getItem("token");
  const res = await fetch(
    `http://192.168.28.151:3000/shorts/comment/all/${shortId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.success) setComments(data.comments);
};

const addComment = async () => {
  if (!commentText.trim() || !activeShortId) return;

  const token = await AsyncStorage.getItem("token");
  await fetch(
    `http://192.168.28.151:3000/shorts/comment/add/${activeShortId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: commentText }),
    }
  );

  setCommentText("");
  openComments(activeShortId);
};

const updateComment = async (id: string) => {
  if (!editingText.trim()) return;
  setCommentLoading(id);

  const token = await AsyncStorage.getItem("token");
  await fetch(
    `http://192.168.28.151:3000/shorts/comment/update/${id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: editingText }),
    }
  );

  setEditingId(null);
  setEditingText("");
  openComments(activeShortId!);
  setCommentLoading(null);
};

const deleteComment = async (id: string) => {
  setCommentLoading(id);

  const token = await AsyncStorage.getItem("token");
  await fetch(
    `http://192.168.28.151:3000/shorts/comment/delete/${id}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  openComments(activeShortId!);
  setCommentLoading(null);
};


  /* ---------------- RENDER ---------------- */

  const renderItem = ({ item }: { item: ShortItem }) => {
    const isLiked = item.liked_by.includes(currentUserId || "");

    return (
      <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }}>
        <Pressable onPress={() => togglePlay(item._id)}>
          <Video
            ref={ref => ref && videoRefs.current.set(item._id, ref)}
            source={{ uri: item.video }}
            style={{
              height: SCREEN_HEIGHT,
              width: SCREEN_WIDTH,
            }}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={false}
          />
        </Pressable>

        {showIcon?.id === item._id && (
          <View className="absolute inset-0 items-center justify-center">
            <Ionicons
              name={showIcon.type === "play" ? "play" : "pause"}
              size={72}
              color="white"
            />
          </View>
        )}

        {/* -------- BOTTOM OVERLAY -------- */}
        <View className="absolute bottom-32 left-4 right-4 flex-row justify-between items-end">
          {/* LEFT */}
          <View className="flex-1 pr-6">
            <View className="flex-row items-center mb-1">
              <Image
                source={{ uri: item.user.avatar }}
                className="h-10 w-10 rounded-full mr-3"
              />
              <View>
                <Text className="text-white font-semibold">
                  {item.user.name}
                </Text>
                <Text className="text-gray-300 text-xs">
                  @{item.user.username}
                </Text>
              </View>
            </View>
            <Text className="text-gray-300">{item.title}</Text>
            <Text className="text-gray-500">{item.description}</Text>
          </View>

          {/* RIGHT */}
          <View className="items-center">
            <TouchableOpacity onPress={() => toggleLike(item)}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={34}
                color={isLiked ? "red" : "white"}
              />
            </TouchableOpacity>
            <Text className="text-white text-xs mb-4">{item.likes || 0}</Text>

            <TouchableOpacity onPress={() => openComments(item._id)} className="mb-4">
              <Ionicons name="chatbubble-outline" size={28} color="white" />
            </TouchableOpacity>

            <Ionicons name="eye-outline" size={28} color="white" />
            <Text className="text-white text-xs">{item.views || 0}</Text>
          </View>
        </View>
      </View>
    );
  };

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
      removeClippedSubviews
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
            <TouchableOpacity onPress={addComment}>
              <Text className="text-pink-300 font-semibold">Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    </>
  );
}
