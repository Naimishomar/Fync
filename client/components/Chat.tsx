import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import io from "socket.io-client";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { SafeAreaView } from "react-native-safe-area-context";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const socket = io(BACKEND_URL);

const Chat = ({ route, navigation }: any) => {
  const conversationId = route?.params?.conversationId;
  const { user } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [otherUser, setOtherUser] = useState<any>(null);

  // ✅ NEW STATES
  const [isTyping, setIsTyping] = useState(false);
  const [seen, setSeen] = useState(false);

  const typingTimeout = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);

  /* ---------- SAFETY ---------- */
  if (!conversationId) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-500">No conversation selected</Text>
      </SafeAreaView>
    );
  }

  /* ---------- FETCH USER ---------- */
  const fetchConversationUser = async () => {
    try {
      const res = await axios.get(`/chat/conversations`);
      const convo = res.data.conversations.find(
        (c: any) => c._id === conversationId
      );

      const other = convo?.participants.find(
        (p: any) => p._id !== user._id
      );

      setOtherUser(other);
    } catch (e) {
      console.log("Error fetching convo user", e);
    }
  };

  const sortedMessages = [...messages].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );

  /* ---------- SOCKET INIT ---------- */
  useEffect(() => {
    fetchConversationUser();

    socket.emit("join", { conversationId });

    socket.emit("markSeen", {
      conversationId,
      userId: user._id,
    });

    socket.on("newMessage", (msg) => {
      if (
        msg.sender === user._id ||
        msg.sender?._id === user._id
      ) return;

      setMessages((prev) => [msg, ...prev]);
    });

    // ✅ typing listeners
    socket.on("userTyping", () => setIsTyping(true));
    socket.on("userStopTyping", () => setIsTyping(false));

    // ✅ seen listener
    socket.on("messagesSeen", () => setSeen(true));

    loadMessages();

    return () => {
      socket.off("newMessage");
      socket.off("userTyping");
      socket.off("userStopTyping");
      socket.off("messagesSeen");
    };
  }, [conversationId]);

  /* ---------- LOAD ---------- */
  const loadMessages = async () => {
    if (loadingMore) return;
    setLoadingMore(true);

    try {
      const res = await axios.get(
        `/chat/${conversationId}/messages?page=${page}`
      );

      setMessages((prev) => [...prev, ...res.data.messages]);
      setPage((prev) => prev + 1);
    } catch (error) {
      console.log("Error loading messages", error);
    } finally {
      setLoadingMore(false);
    }
  };

  /* ---------- SEND ---------- */
  const sendMessage = () => {
    if (!text.trim()) return;

    const tempMessage = {
      _id: Date.now().toString(),
      sender: user._id,
      message: text,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };

    setMessages((prev) => [tempMessage, ...prev]);

    socket.emit("sendMessage", {
      conversationId,
      senderId: user._id,
      text,
    });

    // stop typing when sent
    socket.emit("stopTyping", {
      conversationId,
      userId: user._id,
    });

    setText("");
  };

  /* ---------- TYPING ---------- */
  const handleTyping = (value: string) => {
    setText(value);

    socket.emit("typing", {
      conversationId,
      userId: user._id,
    });

    clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => {
      socket.emit("stopTyping", {
        conversationId,
        userId: user._id,
      });
    }, 1000);
  };

  /* ---------- MESSAGE UI ---------- */
  const renderItem = ({ item, index }: any) => {
    const isMe =
      item.sender === user._id ||
      item.sender?._id === user._id;

    const isLastMessage = index === 0;

    return (
      <View className={`flex-row w-full ${isMe ? "justify-end" : "justify-start"} items-center py-1`}>
        {isMe ? (
          <>
            <View className="max-w-[75%] px-4 py-2 rounded-3xl bg-blue-500">
              <Text className="text-white">{item.message}</Text>
            </View>
            <Image
              source={{
                uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}&background=random&color=fff`,
              }}
              className="h-6 w-6 rounded-full ml-2"
            />
          </>
        ) : (
          <>
            <Image
              source={{
                uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}&background=random&color=fff`,
              }}
              className="h-6 w-6 rounded-full mr-2"
            />
            <View className="max-w-[75%] px-4 py-2 rounded-3xl bg-gray-200">
              <Text className="text-black">{item.message}</Text>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* HEADER — unchanged */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <View className="flex-row items-center">
            <Pressable onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="black" />
            </Pressable>

            {otherUser && (
              <Pressable
                className="flex-row items-center ml-4"
                onPress={() =>
                  navigation.navigate("PublicProfile", {
                    user: otherUser,
                  })
                }
              >
                <Image
                  source={{
                    uri:
                      otherUser.avatar ||
                      `https://ui-avatars.com/api/?name=${otherUser.username}`,
                  }}
                  className="h-10 w-10 rounded-full"
                />

                <View className="ml-3">
                  <Text className="font-semibold text-base">
                    {otherUser.name}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    @{otherUser.username}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {/* MESSAGES */}
        <FlatList
          ref={flatListRef}
          data={sortedMessages}
          inverted
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          onEndReached={loadMessages}
          contentContainerStyle={{ padding: 12 }}
          showsVerticalScrollIndicator={false}
        />

        {/* ✅ typing indicator */}
        {isTyping && (
          <>
          <Text className="px-4 pb-1 text-gray-500 text-sm">
            typing...
          </Text>
          </>
        )}

        {/* INPUT — unchanged */}
        <View className="flex-row items-center px-3 py-2 border-t border-gray-200 bg-white">
          <TextInput
            value={text}
            onChangeText={handleTyping}
            placeholder="Message..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-base"
          />
          <Pressable
            onPress={sendMessage}
            className="ml-3 bg-blue-500 p-2 rounded-full"
          >
            <Ionicons name="send" size={18} color="white" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Chat;
