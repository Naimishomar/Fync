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
import socket from "../utils/socket";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { SafeAreaView } from "react-native-safe-area-context";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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

    socket.emit("register", user._id);
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

      setMessages((prev) => {
        if (prev.find((m) => m._id === msg._id)) return prev;
        return [msg, ...prev];
      });

      // ✅ AUTOMATICALLY SEEN: If screen is open, tell server we've read it

      socket.emit("markSeen", {
        conversationId,
        userId: user._id,
      });
    });


    // ✅ typing listeners
    socket.on("userTyping", () => setIsTyping(true));
    socket.on("userStopTyping", () => setIsTyping(false));

    // ✅ seen listener
    socket.on("messagesSeen", ({ conversationId: seenId }) => {
      if (seenId === conversationId) {
        setMessages((prev) =>
          prev.map(msg => ({ ...msg, seen: true }))
        );
      }
    });


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
        `/chat/${conversationId}/messages`,
        { params: { page, noCache: true } }
      );


      setMessages((prev) => {
        const prevIds = new Set(prev.map(m => m._id));
        const newUnique = res.data.messages.filter((m: any) => !prevIds.has(m._id));
        return [...prev, ...newUnique];
      });
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
      <View className={`flex-row w-full ${isMe ? "justify-end" : "justify-start"} items-end pb-2`}>
        {!isMe && (
          <Image
            source={{
              uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}&background=random&color=fff`,
            }}
            className="h-8 w-8 rounded-full mr-2"
          />
        )}

        <View className={isMe ? "items-end" : "items-start"}>
          <View className={`max-w-[250px] px-4 py-2.5 rounded-2xl ${isMe ? "bg-blue-600 rounded-tr-none" : "bg-gray-100 rounded-tl-none border border-gray-200"}`}>
            <Text className={`${isMe ? "text-white" : "text-black"} text-base`}>{item.message}</Text>
          </View>


          {isMe && isLastMessage && (
            <View className="flex-row items-center mt-1">
              <Ionicons
                name={item.seen ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.seen ? "#3b82f6" : "#9ca3af"}
              />
              <Text className="text-[10px] text-gray-500 ml-1">
                {item.seen ? "Seen" : "Sent"}
              </Text>
            </View>
          )}
        </View>

        {isMe && (
          <Image
            source={{
              uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}&background=random&color=fff`,
            }}
            className="h-8 w-8 rounded-full ml-2"
          />
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
