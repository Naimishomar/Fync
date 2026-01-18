import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  StatusBar
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

const ChatList = ({ navigation } : any) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Create a Ref to store the timer ID
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  const loadChats = async () => {
    try {
      const res = await axios.get("/chat/conversations");
      setConversations(res.data.conversations || []);
    } catch (e) {
      console.log("Error loading chats",e);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      return;
    }
    try {
      console.log("Searching for:", text);
      const res = await axios.get(`/chat/search?q=${text.trim()}`);
      setResults(res.data.users || []);
    } catch (e) {
      console.log("Search error",e);
    }
  };

  /* ---------- 3. INPUT HANDLER (DEBOUNCED) ---------- */
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (text.trim() === "") {
        setResults([]);
        return;
    }
    typingTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 1000); 
  };

  const startChat = async (targetUser: any) => {
    try {
      const res = await axios.post("/chat/start", {
        userId: targetUser._id,
      });
      navigation.navigate("Chat", {
        conversationId: res.data.conversation._id,
      });
      setSearch("");
      setResults([]);
    } catch (e) {
      console.log("Start chat error",e);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderConversation = ({ item }: any) => {
    const otherUser = item.participants.find(
      (p: any) => p._id !== user._id
    );
    const unread = item.unreadCount?.[user._id] || 0;
    const isLastMsgMine = item.lastMessage?.sender === user._id;

    return (
      <Pressable
        className="flex-row items-center px-4 py-4 mb-1"
        onPress={() =>
          navigation.navigate("Chat", { conversationId: item._id })
        }
      >
        <View className="relative">
            <Image
            source={{
                uri: otherUser?.avatar?.trim() || `https://ui-avatars.com/api/?name=${otherUser?.username}&background=random&color=fff`,
            }}
            className="h-14 w-14 rounded-full border border-gray-800"
            />
        </View>

        <View className="ml-4 flex-1 justify-center">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-base text-white">
              {otherUser?.username || "Unknown"}
            </Text>
            <Text className="text-xs text-gray-500 font-medium">
              {formatTime(item.updatedAt || new Date())}
            </Text>
          </View>

          <View className="flex-row items-center justify-between mt-1">
            <Text
              className={`flex-1 text-sm mr-4 ${unread > 0 ? 'text-white font-semibold' : 'text-gray-400'}`}
              numberOfLines={1}
            >
              {isLastMsgMine ? "You: " : ""}{item.lastMessage?.message || "Started a chat"}
            </Text>

            {unread > 0 && (
              <View className="bg-blue-500 min-w-[20px] h-5 px-1.5 flex justify-center items-center rounded-full">
                <Text className="text-white text-[10px] font-bold text-center">
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderUser = ({ item }: any) => (
    <Pressable
      className="flex-row items-center px-4 py-3"
      onPress={() => startChat(item)}
    >
      <Image
        source={{
          uri: item.avatar?.trim() || `https://ui-avatars.com/api/?name=${item.username}&background=random&color=fff`,
        }}
        className="h-12 w-12 rounded-full border border-gray-800"
      />
      <View className="ml-4 flex-1 border-b border-gray-900 pb-3">
        <Text className="font-bold text-white text-base">
          {item.username}
        </Text>
        <Text className="text-gray-500 text-sm">
          {item.name}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      
      {/* HEADER */}
      <View className="px-4 py-2 mb-2 flex-row gap-1 items-center">
        <Pressable  className="p-2" onPress={() => {navigation.goBack()}}>
            <Ionicons name="arrow-back-outline" size={24} color="#fff" />
        </Pressable>
        <Text className="text-3xl font-bold text-white">
          Messages
        </Text>
      </View>

      {/* SEARCH BAR */}
      <View className="px-4 mb-4">
        <View className="flex-row items-center bg-gray-900 rounded-xl px-4 border border-gray-800">
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            value={search}
            onChangeText={handleSearchChange} // 4. Use the new handler
            placeholder="Search friends..."
            placeholderTextColor="#6b7280"
            className="ml-3 flex-1 text-base text-white"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => handleSearchChange("")}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      </View>

      {/* LIST CONTENT */}
      {loading ? (
          <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#3b82f6" />
          </View>
      ) : (
          <FlatList
            data={search.length > 0 ? results : conversations}
            keyExtractor={(item) => item._id}
            renderItem={search.length > 0 ? renderUser : renderConversation}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center mt-20 opacity-50">
                <Ionicons 
                    name={search.length > 0 ? "person-remove-outline" : "chatbubbles-outline"} 
                    size={64} 
                    color="gray" 
                />
                <Text className="text-center text-gray-500 mt-4 text-lg font-medium">
                  {search.length > 0
                    ? "No users found"
                    : "No conversations yet"}
                </Text>
                {search.length === 0 && (
                    <Text className="text-gray-600 text-sm mt-2">Start searching to chat!</Text>
                )}
              </View>
            }
          />
      )}
    </SafeAreaView>
  );
};

export default ChatList;