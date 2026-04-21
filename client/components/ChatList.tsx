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
import socket from "../utils/socket";
import Avatar from "./Avatar";
import { ChatListSkeleton } from "./Skeleton";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const ChatList = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());


  // 1. Create a Ref to store the timer ID
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadChats();
      socket.emit("register", user._id);

      socket.on("statusUpdate", ({ userId, status }: { userId: string, status: string }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          if (status === "online") next.add(userId);
          else next.delete(userId);
          return next;
        });
      });

      socket.on("initialOnlineList", (list: string[]) => {
        setOnlineUsers(new Set(list));
      });

      // ✅ REAL-TIME UNREAD UPDATES
      socket.on("unreadUpdate", (payload) => {
        setConversations(prev => {
          let updatedConvos = [...prev];
          const convoIndex = updatedConvos.findIndex(c => c._id === payload.conversationId);

          if (convoIndex > -1) {
            const convo = updatedConvos[convoIndex];
            const currentUnread = convo.unreadCount?.[user._id] || 0;

            updatedConvos[convoIndex] = {
              ...convo,
              lastMessage: payload.lastMessage || convo.lastMessage,
              updatedAt: payload.lastMessage ? payload.lastMessage.createdAt : convo.updatedAt,
              unreadCount: {
                ...convo.unreadCount,
                [user._id]: payload.type === 'reset' ? 0 : payload.type === 'sent' ? currentUnread : currentUnread + 1
              }
            };

            // Move to top if there's a new message
            if (payload.lastMessage) {
              const updatedConvo = updatedConvos.splice(convoIndex, 1)[0];
              updatedConvos.unshift(updatedConvo);
            }
          } else if (payload.lastMessage) {
            // New conversation scenario
            loadChats();
          }

          return updatedConvos;
        });
      });


      return () => {
        socket.off("statusUpdate");
        socket.off("initialOnlineList");
        socket.off("unreadUpdate");
      };


    }, [user._id])
  );


  const loadChats = async () => {
    try {
      // Force non-cached request to get accurate unread counts
      const res = await axios.get("/chat/conversations", { params: { noCache: true } });
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
        otherUser: targetUser
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
        className="flex-row items-center px-4 py-4 mx-4 mb-3 bg-white rounded-2xl border border-gray-100 shadow-sm"
        onPress={() => navigation.navigate("Chat", { 
          conversationId: item._id,
          otherUser: otherUser
        })}
        activeOpacity={0.7}
      >
        <View className="relative">
          <Avatar 
            user={otherUser as any} 
            size={38} 
          />
          {onlineUsers.has(otherUser?._id) && (
            <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
          )}
        </View>

        <View className="ml-4 flex-1 justify-center">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-bold text-base text-zinc-900">
              {otherUser?.username || "Unknown"}
            </Text>
            <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {formatTime(item.updatedAt || new Date())}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text
              className={`flex-1 text-sm mr-4 ${unread > 0 ? 'text-zinc-900 font-bold' : 'text-gray-500'}`}
              numberOfLines={1}
            >
              {isLastMsgMine ? "You: " : ""}{item.lastMessage?.message || "Started a chat"}
            </Text>

            {unread > 0 && (
              <View className="bg-pink-500 min-w-[20px] h-5 px-1.5 flex justify-center items-center rounded-full">
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
      className="flex-row items-center px-4 py-4 mx-4 mb-3 bg-white rounded-2xl border border-gray-100 shadow-sm"
      onPress={() => startChat(item)}
      activeOpacity={0.7}
    >
      <View className="relative">
      <Avatar 
        user={item as any} 
        size={48} 
      />
        {onlineUsers.has(item._id) && (
          <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        )}
      </View>

      <View className="ml-4 flex-1">
        <Text className="font-bold text-zinc-900 text-base">
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
    <View className="flex-1 bg-[#F5F7FA]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">

        {/* HEADER */}
        <View className="flex-row items-center px-6 pt-4 mb-5">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="p-2 bg-white rounded-full mr-2 border border-gray-100 shadow-sm"
          >
            <Ionicons name="chevron-back" size={20} color="black" />
          </TouchableOpacity>
          <Text className="text-zinc-900 text-2xl font-black tracking-tighter">
            DIRECT<Text className="text-pink-500"> MESSAGES</Text>
          </Text>
        </View>

        {/* SEARCH BAR */}
        <View className="px-6 mb-4">
          <View className="flex-row items-center bg-white rounded-2xl px-4 border border-gray-100 shadow-sm mb-3">
            <Ionicons name="search" size={20} color="#ec4899" />
            <TextInput
              value={search}
              onChangeText={handleSearchChange}
              placeholder="Search friends..."
              placeholderTextColor="#9ca3af"
              className="ml-1 flex-1 text-base text-zinc-900 font-medium"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* College Community Chat Button — Only for Students */}
          {user?.college && search.length === 0 && user?.user_access === 'user' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate("CollegeChatScreen")}
              className="flex-row items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-pink-50 items-center justify-center border border-pink-100 mr-4">
                  <Ionicons name="school" size={24} color="#ec4899" />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-900 font-bold text-lg">{user.college} Campus Area</Text>
                  <Text className="text-gray-500 text-xs mt-0.5">24hr automatically expiring group chat</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}

          {/* Professional Hub — Only for Students and Alumni */}
          {user?.college && search.length === 0 && (user?.user_access === 'user' || user?.user_access === 'alumni') && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate("ProfessionalHub")}
              className="flex-row items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mt-3"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center border border-blue-100 mr-4">
                  <Ionicons name="briefcase" size={24} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-900 font-bold text-lg">Professional Hub</Text>
                  <Text className="text-gray-500 text-xs mt-0.5">Connect with batchmates & alumni</Text>
                </View>
              </View>
              <View className="bg-blue-600 px-2 py-0.5 rounded-full">
                <Text className="text-[8px] text-white font-black italic">PRO</Text>
              </View>
            </TouchableOpacity>
          )}

        </View>

        {/* LIST CONTENT */}
        {loading ? (
          <View className="flex-1 px-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <View key={i} className="mx-4 mb-3 bg-white rounded-2xl border border-gray-100 p-2 overflow-hidden">
                <ChatListSkeleton />
              </View>
            ))}
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