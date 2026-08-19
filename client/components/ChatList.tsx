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
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import socket from "../utils/socket";
import { supabase, fetchUnreadCounts } from "../utils/supabase";
import { readCache, writeCache, userKey } from "../utils/screenCache";
import Avatar from "./Avatar";
import { ChatListSkeleton } from "./Skeleton";

const ChatList = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  // Starts false: the cached list paints on mount, so the skeleton is only for
  // a genuinely first-ever open.
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingStates, setTypingStates] = useState<{ [key: string]: boolean }>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // `conversations` read from inside socket callbacks has to come from a ref:
  // the useFocusEffect closure only depends on user._id, so the reconnect
  // handler captured the initial empty array and silently rejoined no rooms.
  const conversationsRef = useRef<any[]>([]);
  const reloadTimer = useRef<NodeJS.Timeout | null>(null);


  // 1. Create a Ref to store the timer ID
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useFocusEffect(
    useCallback(() => {
      paintFromCache();
      loadChats();
      socket.emit("register", user._id);

      const handleStatusUpdate = ({ userId, status }: { userId: string, status: string }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          if (status === "online") next.add(userId);
          else next.delete(userId);
          return next;
        });
      };

      const handleInitialList = (list: string[]) => {
        setOnlineUsers(new Set(list));
      };

      const handleTyping = ({ conversationId }: { conversationId: string }) => {
        if (conversationId) setTypingStates(prev => ({ ...prev, [conversationId]: true }));
      };

      const handleStopTyping = ({ conversationId }: { conversationId: string }) => {
        if (conversationId) setTypingStates(prev => ({ ...prev, [conversationId]: false }));
      };

      const handleConnect = () => {
        socket.emit("register", user._id);
        // Rejoin rooms if socket reconnects
        conversationsRef.current.forEach((c: any) => {
          socket.emit("join", { conversationId: c._id });
        });
      };

      socket.on("statusUpdate", handleStatusUpdate);
      socket.on("initialOnlineList", handleInitialList);
      socket.on("user_typing", handleTyping);
      socket.on("user_stop_typing", handleStopTyping);
      socket.on("connect", handleConnect);

      // Supabase cannot filter postgres_changes on a jsonb participants array,
      // so every conversation change in the product reaches every client. It
      // used to trigger an unconditional full reload — N users chatting meant
      // N x M refetches a second. Ignore rows this user is not in, and coalesce
      // the rest, so a burst of messages costs one reload instead of one each.
      const isMine = (row: any) =>
        Array.isArray(row?.participants) &&
        row.participants.some((p: any) => p?._id === user._id);

      const channel = supabase
        .channel(`conversations_${user._id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversations' },
          (payload) => {
            if (!isMine(payload.new) && !isMine(payload.old)) return;
            if (reloadTimer.current) clearTimeout(reloadTimer.current);
            reloadTimer.current = setTimeout(loadChats, 300);
          }
        )
        .subscribe();

      // Read receipts live on `messages`, not `conversations`, so the badge
      // needs its own trigger — otherwise it only refreshed when a new message
      // happened to bump the conversation row.
      const msgChannel = supabase
        .channel(`unread_${user._id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages' },
          (payload) => {
            const convoId = (payload.new as any)?.conversationId;
            if (!conversationsRef.current.some((c: any) => c._id === convoId)) return;
            if (reloadTimer.current) clearTimeout(reloadTimer.current);
            reloadTimer.current = setTimeout(loadChats, 300);
          }
        )
        .subscribe();

      return () => {
        socket.off("statusUpdate", handleStatusUpdate);
        socket.off("initialOnlineList", handleInitialList);
        socket.off("user_typing", handleTyping);
        socket.off("user_stop_typing", handleStopTyping);
        socket.off("connect", handleConnect);
        if (reloadTimer.current) clearTimeout(reloadTimer.current);
        supabase.removeChannel(channel);
        supabase.removeChannel(msgChannel);
      };

    }, [user._id])
  );


  const cacheKey = userKey(user?._id, 'chatlist');

  // Paint whatever we showed last time, immediately, then refresh underneath.
  const paintFromCache = async () => {
    const cached = await readCache<{ conversations: any[]; unread: Record<string, number> }>(cacheKey);
    if (!cached?.conversations?.length) return;
    // A newer network result may already have arrived; never overwrite it.
    if (conversationsRef.current.length > 0) return;
    setConversations(cached.conversations);
    conversationsRef.current = cached.conversations;
    setUnreadCounts(cached.unread || {});
    setLoading(false);
  };

  const loadChats = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', `[{"_id": "${user._id}"}]`)
        .order('updatedAt', { ascending: false });

      if (error) throw error;
      if (!data) return;

      setConversations(data);
      conversationsRef.current = data;
      // Join all conversation rooms to listen for typing events
      data.forEach((c: any) => {
        socket.emit("join", { conversationId: c._id });
      });

      // Unread used to be awaited before the list was allowed to render, so
      // opening chat cost two serial round trips instead of one. The rows and
      // their badges are independent; show the rows, fill the badges in.
      setLoading(false);

      const unread = await fetchUnreadCounts(user._id, data.map((c: any) => c._id));
      setUnreadCounts(unread);
      writeCache(cacheKey, { conversations: data, unread });
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
    const unread = unreadCounts[item._id] || 0;
    const isLastMsgMine = item.lastMessageSender === user._id;

    return (
      <TouchableOpacity
        className="flex-row items-center p-5 mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm"
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
            <Text className="font-bold text-base text-slate-900">
              {otherUser?.username || "Unknown"}
            </Text>
            <Text className="text-2xs text-orange-500 font-bold uppercase tracking-wider">
              {formatDateTime(item.updatedAt || new Date()).time}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text
              className={`flex-1 text-sm mr-4 ${typingStates[item._id] ? 'text-green-500 font-bold italic' : (unread > 0 ? 'text-slate-900 font-bold' : 'text-slate-500')}`}
              numberOfLines={1}
            >
              {typingStates[item._id] ? "typing..." : (isLastMsgMine ? "You: " : "") + (item.lastMessage || "Started a chat")}
            </Text>

            <View className="flex-row items-center">
              <Text className="text-2xs text-slate-500 font-black uppercase tracking-wide mr-2">
                {formatDateTime(item.updatedAt || new Date()).date}
              </Text>
              
              {unread > 0 && (
                <View className="bg-orange-500 min-w-[18px] h-4 px-1 flex justify-center items-center rounded-full">
                  <Text className="text-white text-2xs font-black">
                    {unread > 9 ? '9+' : unread}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [user._id, onlineUsers, navigation, typingStates, unreadCounts]);

  const renderUserItem = useCallback(({ item }: any) => (
    <TouchableOpacity
      className="flex-row items-center p-5 mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm"
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
        <Text className="font-bold text-slate-900 text-base">
          {item.username}
        </Text>
        <Text className="text-slate-500 text-sm mt-0.5">
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
                <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                  Inbox <Text className="text-orange-500">Center</Text>
                </Text>
              </View>
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Real-time Encrypted Protocol</Text>
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
              className="flex-1 text-slate-900 font-bold text-sm tracking-tight p-3"
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
              <View key={i} className="mb-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
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
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
            ListHeaderComponent={() => (
              <>
                {/* Special Channels (Only when not searching) */}
                {search.length === 0 && (
                  <View className="mb-6">
                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-4 ml-2">Dedicated Channels</Text>

                    {user?.college && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("CollegeChatScreen")}
                        className="flex-row items-center bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-2"
                      >
                        <View className="w-12 h-12 rounded-2xl bg-orange-50 items-center justify-center border border-orange-100 mr-4">
                          <Ionicons name="school" size={24} color="#f97316" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-900 font-black uppercase text-xs tracking-tight">{user.college} Area</Text>
                          <Text className="text-slate-500 text-2xs font-bold tracking-wide mt-1 ">24hr Expiring Zone</Text>
                        </View>
                        <View className="bg-orange-500 w-2 h-2 rounded-full" />
                      </TouchableOpacity>
                    )}

                    {(user?.user_access === 'user' || user?.user_access === 'alumni' || user?.user_access === 'admin') && user?.college && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("AlumniConnect")}
                        className="flex-row items-center bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
                      >
                        <View className="w-12 h-12 rounded-2xl bg-indigo-50 items-center justify-center border border-indigo-100 mr-4">
                          <Ionicons name="people" size={24} color="#4f46e5" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-900 font-black uppercase text-xs tracking-tight">Student-Alumni Chat</Text>
                          <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wide mt-1 ">Global Networking Zone</Text>
                        </View>
                        <View className="bg-indigo-500 px-2 py-0.5 rounded-full">
                          <Text className="text-2xs text-white font-black">Connect</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {(user?.user_access === 'user' || user?.user_access === 'alumni') && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("ProfessionalHub")}
                        className="flex-row items-center bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
                      >
                        <View className="w-12 h-12 rounded-2xl bg-slate-900 items-center justify-center mr-4">
                          <Ionicons name="briefcase" size={24} color="white" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-900 font-black uppercase text-xs tracking-tight">Professional Hub</Text>
                          <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wide mt-1">Global Alumni Network</Text>
                        </View>
                        <View className="bg-slate-900 px-2 py-0.5 rounded-full">
                          <Text className="text-2xs text-white font-black ">PRO</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-4 ml-2">Recent transmissions</Text>
              </>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20 px-10">
                <View className="w-20 h-20 bg-white rounded-4xl items-center justify-center mb-6 border border-slate-100 shadow-sm">
                  <Ionicons
                    name={search.length > 0 ? "person-remove-outline" : "chatbubbles-outline"}
                    size={32}
                    color="#CBD5E1"
                  />
                </View>
                <Text className="text-slate-500 font-black  uppercase text-xs tracking-wide text-center">
                  {search.length > 0 ? "Registry Empty" : "No Transmissions"}
                </Text>
                <Text className="text-slate-300 text-2xs font-bold uppercase mt-2 text-center">
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
