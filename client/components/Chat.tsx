import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import io from "socket.io-client";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { SafeAreaView } from "react-native-safe-area-context";


const socket = io("http://192.168.28.112:3000");

const Chat = ({ route, navigation }) => {
  const conversationId = route?.params?.conversationId;
  const { user } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [otherUser, setOtherUser] = useState<any>(null);

  const flatListRef = useRef<FlatList>(null);

  /* ---------- SAFETY ---------- */
  if (!conversationId) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-500">No conversation selected</Text>
      </SafeAreaView>
    );
  }

  const tempMessage = {
    _id: Date.now().toString(),
    sender: user._id,
    message: text,
    createdAt: new Date().toISOString(),
    optimistic: true,
  };

  /* ---------- FETCH CONVERSATION USER ---------- */
  const fetchConversationUser = async () => {
    const res = await axios.get(`/chat/conversations`);
    const convo = res.data.conversations.find(
      (c: any) => c._id === conversationId
    );

    const other = convo?.participants.find(
      (p: any) => p._id !== user._id
    );

    setOtherUser(other);
  };

  const sortedMessages = [...messages].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );


  /* ---------- SOCKET ---------- */
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
      ) {
        return;
      }

      setMessages((prev) => [msg, ...prev]);
    });

    loadMessages();

    return () => {
      socket.off("newMessage");
    };
  }, [conversationId]);

  /* ---------- LOAD OLDER ---------- */
  const loadMessages = async () => {
    if (loadingMore) return;
    setLoadingMore(true);

    const res = await axios.get(
      `/chat/${conversationId}/messages?page=${page}`
    );

    setMessages((prev) => [...prev, ...res.data.messages]);
    setPage((prev) => prev + 1);
    setLoadingMore(false);
  };

  /* ---------- SEND ---------- */
  const sendMessage = () => {
    if (!text.trim()) return;

    const tempMessage = {
      _id: Date.now().toString(),
      sender: user._id,
      message: text,
      optimistic: true,
    };

    setMessages((prev) => [tempMessage, ...prev]);

    socket.emit("sendMessage", {
      conversationId,
      senderId: user._id,
      text,
    });

    setText("");
  };

  /* ---------- MESSAGE UI ---------- */
  const renderItem = ({ item }: any) => {
    const isMe =
      item.sender === user._id ||
      item.sender?._id === user._id;

    return (
      <View
        className={`max-w-[75%] px-4 py-2 my-1 rounded-2xl ${
          isMe
            ? "self-end bg-blue-500"
            : "self-start bg-gray-200"
        }`}
      >
        <Text className={isMe ? "text-white" : "text-black"}>
          {item.message}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* ---------- HEADER ---------- */}
        <View className="flex-row items-center px-4 py-3 border-b border-gray-200 bg-white">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} />
          </TouchableOpacity>

          {otherUser && (
            <TouchableOpacity
              className="flex-row items-center ml-4"
              onPress={() =>
                navigation.navigate("PublicProfile", {
                  user: otherUser,
                })
              }
            >
              <Image
                source={{ uri: otherUser.avatar || `https://ui-avatars.com/api/?name=${otherUser.username}&background=random&color=fff` }}
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
            </TouchableOpacity>
          )}
        </View>

        {/* ---------- MESSAGES ---------- */}
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

        {/* ---------- INPUT ---------- */}
        <View className="flex-row items-center px-3 py-2 border-t border-gray-200 bg-white">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-base"
          />
          <TouchableOpacity
            onPress={sendMessage}
            className="ml-3 bg-blue-500 p-2 rounded-full"
          >
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Chat;
