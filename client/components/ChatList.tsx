import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import socket from "../utils/socket";
import { supabase } from "../utils/supabase";
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
  const [typingStates, setTypingStates] = useState<{ [key: string]: boolean }>({});


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

      // ✅ SUPABASE REALTIME LISTENER FOR CONVERSATIONS
      const channel = supabase
        .channel('conversations')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversations' },
          (payload) => {
            loadChats(); // Reload when any conversation updates
          }
        )
        .subscribe();

      return () => {
        socket.off("statusUpdate");
        socket.off("initialOnlineList");
        supabase.removeChannel(channel);
      };

    }, [user._id])
  );


  const loadChats = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', `[{"_id": "${user._id}"}]`)
        .order('updatedAt', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setConversations(data);
      }
    } catch (e) {
      console.log("Error loading chats from Supabase", e);
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

  const formatDateTime = (dateString: string) => {
    if (!dateString) return { date: "", time: "" };
    const date = new Date(dateString);
    const now = new Date();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let dateStr = "";

    if (date.toDateString() === now.toDateString()) {
      dateStr = "Today";
    } else {
      dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    return { date: dateStr, time: timeStr };
  };

  // Memoized render functions to prevent unnecessary re-renders
  const renderConversationItem = useCallback(({ item }: any) => {
    const otherUser = item.participants.find(
      (p: any) => p._id !== user._id
    );
    const unread = item.unreadCount?.[user._id] || 0;
    const isLastMsgMine = item.lastMessage?.sender === user._id;

    return (
      <TouchableOpacity
        className="flex-row items-center p-5 mb-4 bg-white rounded-[24px] border border-slate-100 shadow-sm"
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
            <Text className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">
              {formatDateTime(item.updatedAt || new Date()).time}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text
              className={`flex-1 text-sm mr-4 ${typingStates[item._id] ? 'text-green-500 font-bold italic' : (unread > 0 ? 'text-zinc-900 font-bold' : 'text-gray-500')}`}
              numberOfLines={1}
            >
              {typingStates[item._id] ? "typing..." : (isLastMsgMine ? "You: " : "") + (item.lastMessage || "Started a chat")}
            </Text>

            <View className="flex-row items-center">
              <Text className="text-[9px] text-gray-400 font-black uppercase tracking-widest mr-2">
                {formatDateTime(item.updatedAt || new Date()).date}
              </Text>
              
              {unread > 0 && (
                <View className="bg-orange-500 min-w-[18px] h-4 px-1 flex justify-center items-center rounded-full">
                  <Text className="text-white text-[8px] font-black">
                    {unread > 9 ? '9+' : unread}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [user._id, onlineUsers, navigation]);

  const renderUserItem = useCallback(({ item }: any) => (
    <TouchableOpacity
      className="flex-row items-center p-5 mb-4 bg-white rounded-[24px] border border-slate-100 shadow-sm"
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
      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#f97316" />
    </TouchableOpacity>
  ), [onlineUsers]);

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#f97316', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Arena Header */}
        <View className="px-8 pt-2 bg-transparent">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                  Inbox <Text className="text-orange-500">Center</Text>
                </Text>
              </View>
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1px]">Real-time Encrypted Protocol</Text>
            </View>
          </View>

          {/* SEARCH DOCK */}
          <View className="flex-row items-center bg-white px-5 py-1 rounded-2xl border border-slate-100 shadow-xl shadow-black/5 mb-5">
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              placeholder="Search contacts..."
              placeholderTextColor="#CBD5E1"
              value={search}
              onChangeText={handleSearchChange}
              className="flex-1 text-zinc-900 font-bold text-sm tracking-tight p-3"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange("")}>
                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* LIST CONTENT */}
        {loading ? (
          <View className="flex-1 px-8">
            {[1, 2, 3, 4].map(i => (
              <View key={i} className="mb-4 bg-white rounded-[24px] border border-slate-100 p-4 shadow-sm">
                <ChatListSkeleton />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={search.length > 0 ? results : conversations}
            keyExtractor={(item) => item._id}
            renderItem={search.length > 0 ? renderUserItem : renderConversationItem}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
            ListHeaderComponent={() => (
              <>
                {/* Special Channels (Only when not searching) */}
                {search.length === 0 && (
                  <View className="mb-6">
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 ml-2">Dedicated Channels</Text>

                    {user?.college && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("CollegeChatScreen")}
                        className="flex-row items-center bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm mb-2"
                      >
                        <View className="w-12 h-12 rounded-2xl bg-orange-50 items-center justify-center border border-orange-100 mr-4">
                          <Ionicons name="school" size={24} color="#f97316" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-zinc-900 font-black uppercase text-xs tracking-tight">{user.college} Area</Text>
                          <Text className="text-slate-400 text-[10px] font-bold tracking-widest mt-1 ">24hr Expiring Zone</Text>
                        </View>
                        <View className="bg-orange-500 w-2 h-2 rounded-full" />
                      </TouchableOpacity>
                    )}

                    {(user?.user_access === 'user' || user?.user_access === 'alumni' || user?.user_access === 'admin') && user?.college && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("AlumniConnect")}
                        className="flex-row items-center bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm"
                      >
                        <View className="w-12 h-12 rounded-2xl bg-indigo-50 items-center justify-center border border-indigo-100 mr-4">
                          <Ionicons name="people" size={24} color="#4f46e5" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-zinc-900 font-black uppercase text-xs tracking-tight">Student-Alumni Chat</Text>
                          <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 ">Global Networking Zone</Text>
                        </View>
                        <View className="bg-indigo-500 px-2 py-0.5 rounded-full">
                          <Text className="text-[7px] text-white font-black">Connect</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {(user?.user_access === 'user' || user?.user_access === 'alumni') && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("ProfessionalHub")}
                        className="flex-row items-center bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm"
                      >
                        <View className="w-12 h-12 rounded-2xl bg-zinc-900 items-center justify-center mr-4">
                          <Ionicons name="briefcase" size={24} color="white" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-zinc-900 font-black uppercase text-xs tracking-tight">Professional Hub</Text>
                          <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Global Alumni Network</Text>
                        </View>
                        <View className="bg-zinc-900 px-2 py-0.5 rounded-full">
                          <Text className="text-[7px] text-white font-black ">PRO</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 ml-2">Recent transmissions</Text>
              </>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20 px-10">
                <View className="w-20 h-20 bg-white rounded-[32px] items-center justify-center mb-6 border border-slate-100 shadow-sm">
                  <Ionicons
                    name={search.length > 0 ? "person-remove-outline" : "chatbubbles-outline"}
                    size={32}
                    color="#CBD5E1"
                  />
                </View>
                <Text className="text-zinc-400 font-black  uppercase text-xs tracking-widest text-center">
                  {search.length > 0 ? "Registry Empty" : "No Transmissions"}
                </Text>
                <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center">
                  Initialize search to establish connection.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

export default ChatList;
