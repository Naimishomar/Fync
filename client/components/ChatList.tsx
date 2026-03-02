import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const ChatList = () => {
  const navigation = useNavigation<any>();
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
      console.log("Error loading chats", e);
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
      console.log("Search error", e);
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
      console.log("Start chat error", e);
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
      <TouchableOpacity
        className="flex-row items-center px-6 py-4 border-b border-white/5"
        onPress={() => navigation.navigate("Chat", { conversationId: item._id })}
        activeOpacity={0.7}
      >
        <View className="relative">
            <View className="h-14 w-14 rounded-full border border-white/10 bg-gray-800 justify-center items-center overflow-hidden">
                <Image
                    source={{ uri: otherUser?.avatar?.trim() || `https://ui-avatars.com/api/?name=${otherUser?.username}&background=random&color=fff` }}
                    className="h-full w-full"
                />
            </View>
        </View>

        <View className="ml-4 flex-1 justify-center">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-bold text-base text-white">
              {otherUser?.username || "Unknown"}
            </Text>
            <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              {formatTime(item.updatedAt || new Date())}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text
              className={`flex-1 text-sm mr-4 ${unread > 0 ? 'text-white font-bold' : 'text-gray-400'}`}
              numberOfLines={1}
            >
              {isLastMsgMine ? "You: " : ""}{item.lastMessage?.message || "Started a chat"}
            </Text>

            {unread > 0 && (
              <View className="bg-pink-600 min-w-[20px] h-5 px-1.5 flex justify-center items-center rounded-full border border-pink-500/50 shadow-lg shadow-pink-500/50">
                <Text className="text-white text-[10px] font-black text-center">
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUser = ({ item }: any) => (
    <TouchableOpacity
      className="flex-row items-center px-6 py-4 border-b border-white/5"
      onPress={() => startChat(item)}
      activeOpacity={0.7}
    >
      <View className="h-12 w-12 rounded-full border border-white/10 bg-gray-800 justify-center items-center overflow-hidden">
          <Image
            source={{ uri: item.avatar?.trim() || `https://ui-avatars.com/api/?name=${item.username}&background=random&color=fff` }}
            className="h-full w-full"
          />
      </View>
      <View className="ml-4 flex-1">
        <Text className="font-bold text-white text-base">
          {item.username}
        </Text>
        <Text className="text-gray-500 text-sm mt-0.5">
          {item.name}
        </Text>
      </View>
      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#ec4899" />
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      
      {/* Background Gradient */}
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1">
        
        {/* HEADER */}
        <View className="flex-row items-center px-6 pt-4 mb-6">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="p-2 bg-white/10 rounded-full mr-4 border border-white/10"
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-3xl font-black italic tracking-tighter">
            DIRECT<Text className="text-pink-500">MESSAGES</Text> 💬
          </Text>
        </View>

        {/* SEARCH BAR */}
        <View className="px-6 mb-4">
          <View className="flex-row items-center bg-[#2a2a2a] rounded-2xl px-4 py-3.5 border border-white/10 shadow-lg">
            <Ionicons name="search" size={20} color="#ec4899" />
            <TextInput
              value={search}
              onChangeText={handleSearchChange}
              placeholder="Search friends..."
              placeholderTextColor="#6b7280"
              className="ml-3 flex-1 text-base text-white font-medium"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* LIST CONTENT */}
        {loading ? (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#ec4899" />
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
                  <Text className="text-center text-gray-400 mt-4 text-lg font-bold">
                    {search.length > 0
                      ? "No users found"
                      : "No conversations yet"}
                  </Text>
                  {search.length === 0 && (
                      <Text className="text-gray-500 text-sm mt-2 font-medium">Start searching to chat!</Text>
                  )}
                </View>
              }
            />
        )}
      </SafeAreaView>
    </View>
  );
};

export default ChatList;