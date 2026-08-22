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
  const unreadCountsRef = useRef<Record<string, number>>({});


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
        .order('updatedAt', { ascending: false })
        // Nobody scrolls past the most recent few dozen threads, and an
        // unbounded select was returning every conversation ever opened.
        .limit(40);

      if (error) throw error;
      if (!data) return;

      setConversations(data);
      conversationsRef.current = data;

      // Cache the rows the moment they land, before the unread query. It used
      // to be written only after unread resolved, so leaving the screen during
      // that slow second trip meant nothing was ever cached — and the next open
      // was cold again, every time.
      writeCache(cacheKey, { conversations: data, unread: unreadCountsRef.current });
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
      unreadCountsRef.current = unread;
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
        className="flex-row items-center p-card-pad mb-3 bg-card rounded-card border border-line"
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
            <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-card" />
          )}
        </View>

        <View className="ml-4 flex-1 justify-center">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-semibold text-base text-ink">
              {otherUser?.username || "Unknown"}
            </Text>
            <Text className="font-display text-label text-accent-text uppercase">
              {formatDateTime(item.updatedAt || new Date()).time}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text
              className={`flex-1 text-sm mr-4 ${typingStates[item._id] ? 'text-success font-semibold italic' : (unread > 0 ? 'text-ink font-semibold' : 'text-ink-3')}`}
              numberOfLines={1}
            >
              {typingStates[item._id] ? "typing..." : (isLastMsgMine ? "You: " : "") + (item.lastMessage || "Started a chat")}
            </Text>

            <View className="flex-row items-center">
              <Text className="font-display text-label text-ink-3 uppercase mr-2">
                {formatDateTime(item.updatedAt || new Date()).date}
              </Text>
              
              {unread > 0 && (
                <View className="bg-brand-500 min-w-[18px] h-4 px-1 flex justify-center items-center rounded-full">
                  <Text className="text-ink text-label font-display">
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
      className="flex-row items-center p-card-pad mb-3 bg-card rounded-card border border-line"
      onPress={() => startChat(item)}
      activeOpacity={0.7}
    >
      <View className="relative">
        <Avatar
          user={item as any}
          size={48}
        />
        {onlineUsers.has(item._id) && (
          <View className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card" />
        )}
      </View>

      <View className="ml-4 flex-1">
        <Text className="font-semibold text-ink text-base">
          {item.username}
        </Text>
        <Text className="text-ink-3 text-sm mt-0.5">
          {item.name}
        </Text>
      </View>
      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#F97316" />
    </TouchableOpacity>
  ), [onlineUsers]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Arena Header */}
        <View className="px-gutter pt-4 bg-transparent">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="font-display text-ink uppercase text-display" style={{ letterSpacing: -1.2 }}>
                  Inbox <Text className="text-accent-text">Center</Text>
                </Text>
              </View>
              <Text className="font-display text-label text-ink-3 uppercase">Real-time Encrypted Protocol</Text>
            </View>
          </View>

          {/* SEARCH DOCK */}
          <View className="flex-row items-center bg-card px-5 py-1 border-2 border-ink shadow-hair mb-5 rounded-md">
            <Ionicons name="search" size={20} color="#8B857E" />
            <TextInput
              placeholder="Search contacts..."
              placeholderTextColor="#C4BEB6"
              value={search}
              onChangeText={handleSearchChange}
              className="flex-1 text-ink font-semibold text-sm p-3"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange("")}>
                <Ionicons name="close-circle" size={18} color="#C4BEB6" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* LIST CONTENT */}
        {loading ? (
          <View className="flex-1 px-gutter">
            {[1, 2, 3, 4].map(i => (
              <View key={i} className="mb-4 bg-card rounded-card border border-line p-4 shadow-hair">
                <ChatListSkeleton />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={search.length > 0 ? results : conversations}
            keyExtractor={(item) => item._id}
            renderItem={search.length > 0 ? renderUserItem : renderConversationItem}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
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
                    <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                      <Text className="text-ink-3 text-label font-display uppercase">Dedicated Channels</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>

                    {user?.college && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("CollegeChatScreen")}
                        className="flex-row items-center bg-card rounded-card p-5 border border-line shadow-hair mb-2"
                      >
                        <View className="w-12 h-12 rounded-card bg-paper-2 items-center justify-center border border-line mr-4">
                          <Ionicons name="school" size={24} color="#F97316" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-semibold text-base text-ink">{user.college} Area</Text>
                          <Text className="text-ink-3 text-label font-semibold mt-1">24hr Expiring Zone</Text>
                        </View>
                        <View className="bg-brand-500 w-2 h-2 rounded-full" />
                      </TouchableOpacity>
                    )}

                    {(user?.user_access === 'user' || user?.user_access === 'alumni' || user?.user_access === 'admin') && user?.college && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("AlumniConnect")}
                        className="flex-row items-center bg-card rounded-card p-5 border border-line shadow-hair"
                      >
                        <View className="w-12 h-12 rounded-card bg-recruiter/10 items-center justify-center border border-recruiter/15 mr-4">
                          <Ionicons name="people" size={24} color="#4F46E5" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-semibold text-base text-ink">Student-Alumni Chat</Text>
                          <Text className="text-ink-3 text-label font-semibold uppercase mt-1">Global Networking Zone</Text>
                        </View>
                        <View className="bg-recruiter px-2.5 py-1 rounded-full">
                          <Text className="text-label text-white font-display">Connect</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {(user?.user_access === 'user' || user?.user_access === 'alumni') && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("ProfessionalHub")}
                        className="flex-row items-center bg-card rounded-card p-5 border border-line shadow-hair"
                      >
                        <View className="w-12 h-12 rounded-card bg-ink items-center justify-center mr-4">
                          <Ionicons name="briefcase" size={24} color="white" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-semibold text-base text-ink">Professional Hub</Text>
                          <Text className="text-ink-3 text-label font-semibold uppercase mt-1">Global Alumni Network</Text>
                        </View>
                        <View className="bg-ink px-2.5 py-1 rounded-full">
                          <Text className="text-label text-white font-display">PRO</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                  <Text className="text-ink-3 text-label font-display uppercase">Recent transmissions</Text>
                  <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                </View>
              </>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons
                    name={search.length > 0 ? "person-remove-outline" : "chatbubbles-outline"}
                    size={32}
                    color="#C4BEB6"
                  />
                </View>
                <Text className="font-semibold text-base text-ink text-center">
                  {search.length > 0 ? "Registry Empty" : "No Transmissions"}
                </Text>
                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">
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
