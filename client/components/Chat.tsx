import React, { useEffect, useState, useRef, useLayoutEffect, useMemo, useCallback } from "react";
import {View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity, Keyboard, UIManager, LayoutAnimation, useWindowDimensions} from 'react-native'
import { Image } from 'expo-image';
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "../utils/supabase";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatSkeleton } from "./Skeleton";
import socket from "../utils/socket";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Video, ResizeMode } from "expo-av";
import { Modal } from "react-native";
import { Alert } from './ui/AlertModal';
import { AppBar, Button, Empty, IconBtn } from './ui/kit';
import Avatar from './Avatar';
import { confirmBlock, report } from '../utils/safety';
import { C } from '../constants/colors';
import { tapHaptic } from '../utils/haptics';
import { MessageRow, TypingBubble, dayLabel, isSameDay } from './chat/MessageRow';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


/** What a reply stores of the message it quotes: enough to render the quote.
 *  Storing the whole message nested every earlier quote (and the full sender
 *  profile) inside each reply, so long reply chains kept growing. */
const quoteOf = (m: any) => (m ? {
  _id: m._id,
  message: m.message,
  messageType: m.messageType,
  mediaUrl: m.mediaUrl,
  sender: m.sender && typeof m.sender === 'object'
    ? { _id: m.sender._id, name: m.sender.name, username: m.sender.username }
    : m.sender,
} : null);

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
  });
};

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const Chat = ({ route, navigation }: any) => {
  const conversationId = route?.params?.conversationId;
  const { user } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(route?.params?.otherUser || null);

  // ✅ NEW STATES
  const [isTyping, setIsTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // One <Video> (one decoder) at a time: bubbles show a tile, the tap opens it here.
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  // Media fits the bubble: list padding 40, row max 85%, avatar + gap 48, bubble padding 40.
  const mediaW = Math.min(224, Math.floor((screenW - 40) * 0.85) - 48 - 40);
  const typingTimeout = useRef<any>(null);
  const lastTypingSent = useRef<number>(0);
  const flatListRef = useRef<FlatList>(null);
  // Refs, not state: onEndReached can fire twice before React re-renders, and
  // two calls reading the same stale `page` both fetched the first page.
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  /* ---------- FETCH USER ---------- */
  const fetchConversationUser = async () => {
    if (otherUser) return; // Already have user info from params
    try {
      const res = await axios.get(`/chat/conversations`);
      const convo = res.data?.conversations?.find(
        (c: any) => c._id === conversationId
      );

      const other = convo?.participants?.find(
        (p: any) => p._id !== user._id
      );

      setOtherUser(other);
    } catch (e) {
      console.log("Error fetching convo user", e);
    }
  };

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [messages]
  );

  /* ---------- SUPABASE INIT ---------- */
  useEffect(() => {
    if (!conversationId) return;

    // React Navigation reuses this screen when navigating Chat -> Chat, so the
    // pagination cursor and the previous thread's messages have to be cleared
    // or the second conversation opens mid-history with the first one's tail.
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadingRef.current = false;
    setMessages([]);
    setLoading(true);
    setLoadError(false);

    fetchConversationUser();

    // Opening the chat marks the whole backlog read in one write. The old code
    // kept a separate `conversations.unreadCount` counter that both clients
    // read-modify-wrote concurrently, so increments were lost and the badge
    // drifted. `messages.seen` is the only source of truth now.
    supabase
      .from('messages')
      .update({ seen: true })
      .eq('conversationId', conversationId)
      .eq('seen', false)
      .filter('sender->>_id', 'neq', user._id)
      .then();

    // Join Socket Room for transient events
    socket.emit("join", { conversationId });
    socket.emit("register", user._id); // ensure registered for online status

    // The peer's stopTyping can be lost (backgrounded app, dropped socket),
    // which used to leave "typing…" on screen forever. Expire it locally.
    let typingClear: any = null;
    const handleTyping = ({ username }: any) => {
      setIsTyping(true);
      if (typingClear) clearTimeout(typingClear);
      typingClear = setTimeout(() => setIsTyping(false), 4000);
    };
    const handleStopTyping = () => {
      if (typingClear) clearTimeout(typingClear);
      setIsTyping(false);
    };
    const handleStatusUpdate = ({ userId, status }: { userId: string, status: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (status === "online") next.add(userId);
        else next.delete(userId);
        return next;
      });
    };
    const handleInitialOnlineList = (list: string[]) => {
      setOnlineUsers(new Set(list));
    };

    const handleConnect = () => {
      socket.emit("join", { conversationId });
      socket.emit("register", user._id);
    };

    // Listen to typing events
    socket.on("user_typing", handleTyping);
    socket.on("user_stop_typing", handleStopTyping);

    // Listen to online status
    socket.on("statusUpdate", handleStatusUpdate);
    socket.on("initialOnlineList", handleInitialOnlineList);
    socket.on("connect", handleConnect);

    // 1. Fetch Initial Messages
    loadMessages();

    const kbs = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const kbh = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    // 2. Subscribe to New Messages via Supabase Realtime
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversationId=eq.${conversationId}`
        },
        (payload) => {
          const newMsg = payload.new;
          // Ignore if we already appended it optimistically
          if (newMsg.sender?._id === user._id) return;

          setMessages((prev) => {
            if (prev.find((m) => m._id === newMsg._id)) return prev;
            return [newMsg, ...prev];
          });
          
          // Chat is open, so it is read the moment it lands.
          supabase.from('messages').update({ seen: true }).eq('_id', newMsg._id).then();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversationId=eq.${conversationId}`
        },
        (payload) => {
          // Handle read receipts
          setMessages((prev) =>
            prev.map((m) => (m._id === payload.new._id ? payload.new : m))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversationId=eq.${conversationId}`
        },
        (payload) => {
          setMessages((prev) => prev.filter(m => m._id !== payload.old._id));
        }
      )
      .subscribe();

    return () => {
      kbs.remove();
      kbh.remove();
      if (typingClear) clearTimeout(typingClear);
      supabase.removeChannel(channel);
      socket.emit("stopTyping", { conversationId, username: user.username });
      socket.off("user_typing", handleTyping);
      socket.off("user_stop_typing", handleStopTyping);
      socket.off("statusUpdate", handleStatusUpdate);
      socket.off("initialOnlineList", handleInitialOnlineList);
      socket.off("connect", handleConnect);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [conversationId]);

  /* ---------- LOAD ---------- */
  const loadMessages = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;

    const from = (pageRef.current - 1) * 20;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversationId', conversationId)
        .order('createdAt', { ascending: false })
        .range(from, from + 19);

      if (error) throw error;

      setLoadError(false);
      if (data) {
        if (data.length < 20) hasMoreRef.current = false;
        pageRef.current += 1;
        setMessages((prev) => {
          const prevIds = new Set(prev.map(m => m._id));
          const newUnique = data.filter((m: any) => !prevIds.has(m._id));
          return [...prev, ...newUnique];
        });
        // No per-page "mark seen" here — opening the chat already marked the
        // whole conversation read in a single write.
      }
    } catch (error) {
      console.log("Error loading messages", error);
      if (pageRef.current === 1) setLoadError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [conversationId]);

  /* ---------- INBOX METADATA ----------
     Preview line + sort order for ChatList. Deliberately fire-and-forget and
     deliberately free of any unread counter — unread is derived from
     `messages.seen`, which cannot drift. */
  const touchConversation = (preview: string, at: string) => {
    if (!otherUser) return;
    supabase.from('conversations').upsert({
      _id: conversationId,
      participants: [user, otherUser],
      lastMessage: preview,
      lastMessageSender: user._id,
      updatedAt: at,
    }).then(({ error }) => {
      if (error) console.log("touchConversation error", error);
    });
  };

  /* ---------- SEND ---------- */
  const sendMessage = async () => {
    if (!text.trim() || !otherUser) return;
    tapHaptic();

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const tempId = generateUUID();
    const tempMessage = {
      _id: tempId,
      conversationId,
      sender: user,
      message: text,
      createdAt: new Date().toISOString(),
      replyTo: quoteOf(replyingTo),
      optimistic: true,
    };

    setMessages((prev) => [tempMessage as any, ...prev]);
    setText("");
    setReplyingTo(null);

    // Stop typing immediately when sending
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    socket.emit("stopTyping", { conversationId, username: user.username });
    setIsTyping(false);

    // Save to Supabase
    try {
      // The message goes in first and alone. It is what the receiver's realtime
      // subscription is waiting on, so nothing else belongs ahead of it.
      const { data, error } = await supabase.from('messages').insert([{
        _id: tempId,
        conversationId,
        sender: user,
        message: tempMessage.message,
        messageType: 'text',
        replyTo: tempMessage.replyTo,
      }]).select().single();

      if (error) throw error;

      if (data) {
        setMessages((prev) => prev.map(m => m._id === tempId ? data : m));
        socket.emit("chat_notify", {
          receiverId: otherUser._id,
          title: user.name,
          body: tempMessage.message,
        });
        // Inbox-list metadata only. Not awaited — a slow write here must not
        // delay delivery, and a failed one costs a stale preview, not a message.
        touchConversation(tempMessage.message, tempMessage.createdAt);
      }
    } catch (e) {
      console.log("Failed to send", e);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert("Failed to Send", "Could not send the message. Please check your connection.");
    }
  };

  const uploadMedia = async (uri: string, mimeType: string, type: string, fileName?: string) => {
    if (!otherUser) return;
    const formData = new FormData();
    formData.append("media", {
      uri,
      name: fileName || `media_${Date.now()}`,
      type: mimeType,
    } as any);
    formData.append("conversationId", conversationId);
    formData.append("type", type);
    formData.append("receiverId", otherUser?._id);
    if (replyingTo) formData.append("replyTo", replyingTo._id);

    // Optimistic message
    const tempId = generateUUID();
    const tempMsg = {
      _id: tempId,
      sender: user,
      message: "",
      messageType: type,
      mediaUrl: uri,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages(prev => [tempMsg, ...prev]);

    try {
      const res = await axios.post("/chat/send", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        const mediaUrl = res.data.message.mediaUrl;

        const { data, error } = await supabase.from('messages').insert([{
          _id: tempId,
          conversationId,
          sender: user,
          message: "",
          messageType: type,
          mediaUrl: mediaUrl,
          replyTo: quoteOf(replyingTo),
        }]).select().single();

        if (error) throw error;

        if (data) {
          setMessages(prev => prev.map(m => m._id === tempId ? data : m));
          // Notify only once the media actually landed.
          socket.emit("chat_notify", {
            receiverId: otherUser._id,
            title: user.name,
            body: `Sent a ${type}`
          });
          const preview = type === 'image' ? 'Sent an image' : (type === 'video' ? 'Sent a video' : 'Sent a file');
          touchConversation(preview, data.createdAt || new Date().toISOString());
        }
      }
    } catch (e: any) {
      console.error("Upload error:", e);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      if (e?.response?.status === 403) Alert.alert("Can't send", e.response.data?.message || "You can't message this user");
      else Alert.alert("Upload Failed", "Could not send media. Please try again.");
    }
  };

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!res.canceled) {
      const asset = res.assets[0];
      const sizeInMb = (asset.fileSize || 0) / (1024 * 1024);
      if (sizeInMb > 20) {
        Alert.alert("File Too Large", "Please select media under 20MB.");
        return;
      }
      const isVideo = asset.type === "video";
      uploadMedia(asset.uri, isVideo ? "video/mp4" : "image/jpeg", isVideo ? "video" : "image", asset.fileName || `media_${Date.now()}`);
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        if (asset.mimeType !== 'application/pdf') {
          Alert.alert("Invalid File", "Only PDF documents are allowed.");
          return;
        }
        const sizeInMb = (asset.size || 0) / (1024 * 1024);
        if (sizeInMb > 20) {
          Alert.alert("File Too Large", "Please select a file under 20MB.");
          return;
        }
        uploadMedia(asset.uri, "application/pdf", "file", asset.name);
      }
    } catch (error) {
      console.error("Document picking error:", error);
    }
  };

  /* ---------- TYPING ---------- */
  const handleTyping = (value: string) => {
    setText(value);
    
    // Emit typing indicator to socket
    if (Date.now() - lastTypingSent.current > 2000) {
      socket.emit("typing", { conversationId, username: user.username });
      lastTypingSent.current = Date.now();
    }
    
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stopTyping", { conversationId, username: user.username });
    }, 2000);
  };

  const deleteMessage = (messageId: string) => {
    Alert.alert("Delete Message", "Delete this message for everyone?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.from('messages').delete().eq('_id', messageId);
            setMessages((prev) => {
              const newMessages = prev.filter((m) => m._id !== messageId);
              
              // If we deleted the most recent message, update the conversation's lastMessage
              if (prev[0]?._id === messageId && newMessages.length > 0) {
                const newLastMessage = newMessages[0];
                const msgText = newLastMessage.messageType === 'text' 
                  ? newLastMessage.message 
                  : (newLastMessage.messageType === 'image' ? 'Sent an image' : 'Sent media');
                  
                supabase.from('conversations').update({
                  lastMessage: msgText,
                  lastMessageSender: newLastMessage.sender?._id || newLastMessage.sender,
                  updatedAt: newLastMessage.createdAt,
                }).eq('_id', conversationId).then();
              } else if (prev[0]?._id === messageId && newMessages.length === 0) {
                // If it was the only message left
                supabase.from('conversations').update({
                  lastMessage: "Message deleted",
                  lastMessageSender: user._id,
                }).eq('_id', conversationId).then();
              }
              
              return newMessages;
            });
          } catch (e) {
            console.log("Delete error", e);
          }
        },
      },
    ]);
  };

  /* ---------- MESSAGE UI ---------- */
  const openActions = useCallback((item: any, isMe: boolean) => {
    if (isMe) {
      Alert.alert("Message", undefined, [
        { text: "Reply", onPress: () => setReplyingTo(item) },
        { text: "Delete", style: "destructive", onPress: () => deleteMessage(item._id) },
        { text: "Cancel", style: "cancel" }
      ]);
    } else {
      setReplyingTo(item);
    }
  // conversationId: deleteMessage writes lastMessage to it, and Chat -> Chat reuses this screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversationId]);

  // Inverted list: index - 1 is the newer neighbour (below), index + 1 the older one (above).
  const renderItem = useCallback(({ item, index }: any) => {
    const senderId = (m: any) => m?.sender?._id || m?.sender;
    const isMe = senderId(item) === user._id;
    const newer = sortedMessages[index - 1];
    const older = sortedMessages[index + 1];
    const last = !newer || senderId(newer) !== senderId(item) || !isSameDay(newer.createdAt, item.createdAt);
    const day = !older || !isSameDay(older.createdAt, item.createdAt) ? dayLabel(item.createdAt) : null;
    return (
      <MessageRow
        item={item}
        isMe={isMe}
        me={user}
        last={last}
        day={day}
        mediaW={mediaW}
        onReply={setReplyingTo}
        onLongPress={openActions}
        onOpenImage={setSelectedImage}
        onOpenVideo={setSelectedVideo}
      />
    );
  }, [user, mediaW, sortedMessages, openActions]);

  if (!conversationId) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-card">
        <Text className="text-ink-3">No conversation selected</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      {/* FIXED HEADER */}
      <AppBar
        onBack={() => navigation.goBack()}
        right={otherUser ? (
          <IconBtn
            name="ellipsis-vertical"
            accessibilityLabel="Chat options"
            onPress={() => Alert.alert(otherUser.name || 'Options', undefined, [
              { text: 'Report user', onPress: () => report({ targetType: 'user', targetId: otherUser._id }) },
              { text: 'Block user', style: 'destructive', onPress: () => confirmBlock(otherUser._id, otherUser.name, () => navigation.goBack()) },
              { text: 'Cancel', style: 'cancel' },
            ])}
          />
        ) : undefined}
      >
            {otherUser && (
              <TouchableOpacity
                className="flex-row items-center"
                style={{ minWidth: 0 }}
                accessibilityRole="button"
                accessibilityLabel={`${otherUser.name}, view profile`}
                onPress={() =>
                  navigation.navigate("PublicProfile", {
                    user: otherUser,
                  })
                }
              >
                <View className="relative">
                  <Avatar user={otherUser} size={36} showBadge={false} />
                  {onlineUsers.has(otherUser?._id) && (
                    <View className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success rounded-full border-2 border-paper" accessibilityLabel="Online" />
                  )}
                </View>

                <View className="ml-3 flex-1" style={{ minWidth: 0 }}>
                  <Text className="font-semibold text-ink text-base" numberOfLines={1}>
                    {otherUser.name}
                  </Text>
                  {isTyping ? (
                    <Text className="text-xs text-success font-semibold">
                      typing…
                    </Text>
                  ) : (
                    <Text className="text-xs text-ink-3" numberOfLines={1}>
                      @{otherUser.username}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
        </AppBar>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        // 0: this KAV's own frame already starts below the AppBar (its parent is
        // the full-screen root at y=0), so adding the bar's height counted it twice.
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1 }}>
            {/* MESSAGE CONTAINER (ROUNDED CARD) */}
          <View className="flex-1 bg-paper overflow-hidden border-t border-line">
            {loading ? (
              <View className="flex-1 px-gutter py-3">
                {[1, 2, 3, 4, 5, 6].map(i => <ChatSkeleton key={i} isMe={i % 2 === 0} />)}
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={sortedMessages}
                inverted
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                // Header of an inverted list sits at the bottom, under the newest message.
                ListHeaderComponent={isTyping && otherUser ? <TypingBubble peer={otherUser} /> : null}
                onEndReached={loadMessages}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                ListEmptyComponent={
                  // No manual scaleY flip: VirtualizedList already gives the empty
                  // component the inversion style, and a transform here would override it.
                  <View style={{ paddingVertical: 24 }}>
                    {loadError ? (
                      <Empty
                        icon="cloud-offline-outline"
                        title="Couldn't load messages"
                        action={<Button title="Try again" onPress={() => { setLoadError(false); loadMessages(); }} />}
                      />
                    ) : (
                      <Empty icon="chatbubbles-outline" title="No messages yet" hint="Say hi to start the conversation." />
                    )}
                  </View>
                }
              />
            )}
          </View>

          {/* ✅ reply indicator */}
          {replyingTo && (
            <View className="mx-gutter mb-2 p-3 bg-card rounded-2xl border border-line flex-row items-center justify-between">
              <View className="flex-1 border-l-2 border-brand-500 pl-3">
                <Text className="text-accent-text text-xs font-semibold mb-0.5">
                  Replying to {replyingTo.sender?.name || (replyingTo.sender === user._id ? "You" : "User")}
                </Text>
                <Text className="text-ink-2 text-xs font-semibold" numberOfLines={1}>
                  {replyingTo.message}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                className="ml-3 w-7 h-7 items-center justify-center rounded-full bg-paper-2"
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
              >
                <Ionicons name="close" size={14} color={C.ink3} />
              </TouchableOpacity>
            </View>
          )}

          {/* INPUT AREA */}
          {/* Card ground on the inset strip too, so the composer doesn't sit on a two-tone band. */}
          <View style={{ backgroundColor: C.card, paddingBottom: isKeyboardVisible ? 20 : (insets.bottom > 0 ? insets.bottom : 12) }}>
            <View className="px-5 pb-2 pt-2 bg-card">
              <View className="flex-row items-end bg-paper-2 p-1 rounded-3xl border border-line">
                <TouchableOpacity onPress={handlePickImage} className="w-11 h-11 items-center justify-center" accessibilityRole="button" accessibilityLabel="Send a photo">
                  <Ionicons name="image-outline" size={22} color={C.ink3} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePickDocument} className="w-11 h-11 items-center justify-center" accessibilityRole="button" accessibilityLabel="Attach a file">
                  <Ionicons name="attach-outline" size={24} color={C.ink3} />
                </TouchableOpacity>
                <TextInput
                  value={text}
                  onChangeText={handleTyping}
                  placeholder="Message…"
                  placeholderTextColor={C.ink3}
                  accessibilityLabel="Message"
                  className="flex-1 px-2 text-ink font-sans text-[15px] py-2.5"
                  multiline={true}
                  numberOfLines={1}
                  style={{ maxHeight: 120 }}
                />

                <TouchableOpacity
                  onPress={sendMessage}
                  // otherUser is still loading (or failed to): sending would silently no-op.
                  disabled={!otherUser}
                  style={!otherUser ? { opacity: 0.4 } : undefined}
                  className="w-11 h-11 bg-brand-500 rounded-full items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  accessibilityState={{ disabled: !otherUser }}
                >
                  <Ionicons name="paper-plane" size={18} color={C.onBrand} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      {/* FULL SCREEN IMAGE MODAL */}
      <Modal visible={!!selectedImage} transparent={true} statusBarTranslucent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View className="flex-1 bg-black/95 justify-center items-center">
          <TouchableOpacity
            onPress={() => setSelectedImage(null)}
            className="absolute right-5 w-11 h-11 bg-white/10 rounded-full items-center justify-center z-50"
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ top: insets.top + 12 }}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}
        </View>
      </Modal>
      {/* FULL SCREEN VIDEO MODAL */}
      <Modal visible={!!selectedVideo} transparent={true} statusBarTranslucent animationType="fade" onRequestClose={() => setSelectedVideo(null)}>
        <View className="flex-1 bg-black/95 justify-center items-center">
          <TouchableOpacity
            onPress={() => setSelectedVideo(null)}
            className="absolute right-5 w-11 h-11 bg-white/10 rounded-full items-center justify-center z-50"
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ top: insets.top + 12 }}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {selectedVideo && (
            <Video
              source={{ uri: selectedVideo }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
              style={{ width: '100%', height: '80%' }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

export default Chat;
