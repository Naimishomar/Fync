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
  Alert,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import socket from "../utils/socket";
import { supabase, fetchUnreadCounts } from "../utils/supabase";
import { readCache, writeCache, userKey } from "../utils/screenCache";
import Avatar from "./Avatar";
import { ChatListSkeleton } from "./Skeleton";
import { useTabBarClearance, useTabBarAutoHide } from '../constants/layout';
import { C } from '../constants/colors';
import { isFeatureOn } from '../constants/features';
import { AppBar, Button, Empty, ListRow, Badge, SearchField, SectionHeader, Card } from './ui/kit';

/** Avatar with a green presence dot. */
const OnlineAvatar = React.memo(({ user, online }: { user: any; online: boolean }) => (
  <View>
    <Avatar user={user as any} size={44} />
    {online && (
      <View
        className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-card"
        accessibilityLabel="Online"
      />
    )}
  </View>
));

const ChatList = () => {
  const autoHideTabBar = useTabBarAutoHide();
  const navigation = useNavigation<any>();
  // Pushed from Home it is a stack screen and needs a back button; as the
  // recruiter "Messages" tab, canGoBack() is true too (tab history) but it must not.
  const route = useRoute();
  const showBack = route.name === 'ChatList' && navigation.canGoBack();
  const tabBarClearance = useTabBarClearance();
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
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startingChat = useRef(false);

  // `conversations` read from inside socket callbacks has to come from a ref:
  // the useFocusEffect closure only depends on user._id, so the reconnect
  // handler captured the initial empty array and silently rejoined no rooms.
  const conversationsRef = useRef<any[]>([]);
  const reloadTimer = useRef<NodeJS.Timeout | null>(null);
  const unreadCountsRef = useRef<Record<string, number>>({});


  // 1. Create a Ref to store the timer ID
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Latest query typed; a slower response for an older one must not overwrite it.
  const latestQuery = useRef("");

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

      return () => {
        socket.off("statusUpdate", handleStatusUpdate);
        socket.off("initialOnlineList", handleInitialList);
        socket.off("user_typing", handleTyping);
        socket.off("user_stop_typing", handleStopTyping);
        socket.off("connect", handleConnect);
        if (reloadTimer.current) clearTimeout(reloadTimer.current);
        supabase.removeChannel(channel);
      };

    }, [user._id])
  );

  // Read receipts live on `messages`, not `conversations`, so the badge
  // needs its own trigger — otherwise it only refreshed when a new message
  // happened to bump the conversation row. Filtered server-side to the loaded
  // threads (unfiltered, every read receipt in the product reached every
  // client), so it re-subscribes whenever loadChats changes that set.
  const convoIdsKey = conversations.map((c: any) => c._id).join(',');
  useFocusEffect(
    useCallback(() => {
      if (!convoIdsKey) return;
      // Unique topic: supabase.channel() returns an existing channel with the same
      // topic, and the previous one may still be mid-removeChannel (async).
      const msgChannel = supabase
        .channel(`unread_${user._id}_${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversationId=in.(${convoIdsKey})` },
          () => {
            if (reloadTimer.current) clearTimeout(reloadTimer.current);
            reloadTimer.current = setTimeout(loadChats, 300);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(msgChannel); };
    }, [user._id, convoIdsKey])
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
      setLoadError(false);

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
      setLoadError(true);
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
      const res = await axios.get(`/chat/search?q=${encodeURIComponent(text.trim())}`);
      if (text !== latestQuery.current) return;
      setResults(res.data.users || []);
    } catch (e) {
      console.log("Search error", e);
    }
  };

  /* ---------- 3. INPUT HANDLER (DEBOUNCED) ---------- */
  const handleSearchChange = (text: string) => {
    setSearch(text);
    latestQuery.current = text;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (text.trim() === "") {
      setResults([]);
      return;
    }
    typingTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 400);
  };

  const startChat = async (targetUser: any) => {
    // A second tap while the first request is in flight opened the chat twice.
    if (startingChat.current) return;
    startingChat.current = true;
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
      Alert.alert("Couldn't start chat", "Please check your connection and try again.");
    } finally {
      startingChat.current = false;
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
    const otherUser = item.participants?.find(
      (p: any) => p._id !== user._id
    );
    const unread = unreadCounts[item._id] || 0;
    const isLastMsgMine = item.lastMessageSender === user._id;

    const when = formatDateTime(item.updatedAt || new Date());
    const typing = !!typingStates[item._id];

    return (
      <ListRow
        onPress={() => navigation.navigate("Chat", {
          conversationId: item._id,
          otherUser: otherUser
        })}
        leading={<OnlineAvatar user={otherUser} online={onlineUsers.has(otherUser?._id)} />}
        title={otherUser?.username || "Unknown"}
        subtitle={typing ? "typing…" : (isLastMsgMine ? "You: " : "") + (item.lastMessage || "Started a chat")}
        meta={when.date === 'Today' ? when.time : when.date}
        right={unread > 0 ? <Badge value={unread} tone={C.brand[500]} /> : undefined}
        chevron={false}
        accessibilityLabel={`${otherUser?.username || 'Unknown'}${unread > 0 ? `, ${unread} unread` : ''}`}
      />
    );
  }, [user._id, onlineUsers, navigation, typingStates, unreadCounts]);

  const renderUserItem = useCallback(({ item }: any) => (
    <ListRow
      onPress={() => startChat(item)}
      leading={<OnlineAvatar user={item} online={onlineUsers.has(item._id)} />}
      title={item.username}
      subtitle={item.name}
      right={<Ionicons name="chatbubble-ellipses-outline" size={20} color={C.ink3} />}
      accessibilityLabel={`Message ${item.username}`}
    />
  ), [onlineUsers]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title="Messages" onBack={showBack ? () => navigation.goBack() : undefined} />
        <View className="px-gutter">
          <SearchField
            placeholder="Search contacts"
            value={search}
            onChangeText={handleSearchChange}
            containerStyle={{ marginBottom: 8 }}
          />
        </View>

        {/* LIST CONTENT */}
        {loading ? (
          <View className="flex-1 px-gutter">
            {[1, 2, 3, 4].map(i => (
              <View key={i} className="mb-3">
                <ChatListSkeleton />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={search.length > 0 ? results : conversations}
            {...autoHideTabBar}
            keyExtractor={(item) => item._id}
            renderItem={search.length > 0 ? renderUserItem : renderConversationItem}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarClearance }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            refreshControl={search.length === 0 ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => { setRefreshing(true); await loadChats(); setRefreshing(false); }}
                tintColor={C.brand[500]}
                colors={[C.brand[500]]}
              />
            ) : undefined}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
            // An element, not an inline component: a new function each render
            // remounted the whole header on every typing/presence update.
            ListHeaderComponent={
              <>
                {/* Special Channels (Only when not searching) */}
                {search.length === 0 && (user?.college || isFeatureOn('alumniConnect') || isFeatureOn('proHub')) && (
                  <View>
                    <SectionHeader title="Channels" />
                    <Card style={{ paddingHorizontal: 16 }}>
                      {user?.college && (
                        <ListRow
                          onPress={() => navigation.navigate("CollegeChatScreen")}
                          icon="school-outline"
                          title={`${user.college} chat`}
                          subtitle="Messages clear after 24 hours"
                        />
                      )}

                      {isFeatureOn('alumniConnect') && (user?.user_access === 'user' || user?.user_access === 'alumni' || user?.user_access === 'admin') && user?.college && (
                        <ListRow
                          onPress={() => navigation.navigate("AlumniConnect")}
                          icon="people-outline"
                          title="Student-alumni chat"
                          subtitle="Talk to alumni from your college"
                        />
                      )}

                      {isFeatureOn('proHub') && (user?.user_access === 'user' || user?.user_access === 'alumni') && (
                        <ListRow
                          onPress={() => navigation.navigate("ProfessionalHub")}
                          icon="briefcase-outline"
                          title="Professional hub"
                          subtitle="Alumni network"
                        />
                      )}
                    </Card>
                  </View>
                )}
                <SectionHeader title={search.length > 0 ? "People" : "Recent chats"} />
              </>
            }
            ListEmptyComponent={search.length === 0 && loadError ? (
              <View className="mt-10">
                <Empty
                  icon="cloud-offline-outline"
                  title="Couldn't load chats"
                  action={<Button title="Try again" onPress={loadChats} />}
                />
              </View>
            ) : (
              <View className="mt-10">
                <Empty
                  icon={search.length > 0 ? "person-remove-outline" : "chatbubbles-outline"}
                  title={search.length > 0 ? "No one found" : "No chats yet"}
                  hint={search.length > 0 ? "Try a different name or username." : "Search for someone above to start a chat."}
                />
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
};

export default ChatList;
