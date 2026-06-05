import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  TouchableOpacity,
  Dimensions,
  Linking,
  Keyboard,
  TouchableWithoutFeedback,
  UIManager,
  LayoutAnimation,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "../utils/supabase";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatSkeleton } from "./Skeleton";
import socket from "../utils/socket";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Video, ResizeMode } from "expo-av";
import { ActivityIndicator, Modal } from "react-native";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(route?.params?.otherUser || null);

  // ✅ NEW STATES
  const [isTyping, setIsTyping] = useState(false);
  const [seen, setSeen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const insets = useSafeAreaInsets();
  const typingTimeout = useRef<any>(null);
  const lastTypingSent = useRef<number>(0);
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
    if (otherUser) return; // Already have user info from params
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

  /* ---------- SUPABASE INIT ---------- */
  useEffect(() => {
    fetchConversationUser();

    // Reset unread count when opening chat
    supabase.from('conversations').select('unreadCount').eq('_id', conversationId).single().then(({ data }) => {
       if (data && data.unreadCount && data.unreadCount[user._id] > 0) {
          supabase.from('conversations').update({
             unreadCount: { ...data.unreadCount, [user._id]: 0 }
          }).eq('_id', conversationId).then();
       }
    });

    // Join Socket Room for transient events
    socket.emit("join", { conversationId });
    socket.emit("register", user._id); // ensure registered for online status

    const handleTyping = ({ username }: any) => {
      setIsTyping(true);
    };
    const handleStopTyping = () => {
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
          
          // Mark as seen in Supabase (simulate read receipt)
          supabase.from('messages').update({ seen: true }).eq('_id', newMsg._id).then();
          
          // Also clear unread count for this user when receiving a message while open
          supabase.from('conversations').select('unreadCount').eq('_id', conversationId).single().then(({ data }) => {
             if (data && data.unreadCount) {
                supabase.from('conversations').update({
                   unreadCount: { ...data.unreadCount, [user._id]: 0 }
                }).eq('_id', conversationId).then();
             }
          });
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

    // Hide tab bar when in chat
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: 'none' }
      });
    }

    return () => {
      kbs.remove();
      kbh.remove();
      supabase.removeChannel(channel);
      socket.emit("stopTyping", { conversationId, username: user.username });
      socket.off("user_typing", handleTyping);
      socket.off("user_stop_typing", handleStopTyping);
      socket.off("statusUpdate", handleStatusUpdate);
      socket.off("initialOnlineList", handleInitialOnlineList);
      socket.off("connect", handleConnect);

      // Restore tab bar when leaving chat
      if (parent) {
        parent.setOptions({
          tabBarStyle: {
            position: "absolute",
            bottom: 40,
            marginHorizontal: Dimensions.get('window').width * 0.05,
            backgroundColor: "rgba(20, 20, 20, 0.86)",
            borderRadius: 40,
            height: 60,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            elevation: 10,
            paddingTop: 10,
            paddingBottom: 46,
            display: 'flex'
          }
        });
      }
    };
  }, [conversationId, navigation]);

  /* ---------- LOAD ---------- */
  const loadMessages = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversationId', conversationId)
        .order('createdAt', { ascending: false })
        .range((page - 1) * 20, page * 20 - 1);

      if (error) throw error;

      if (data) {
        if (data.length < 20) setHasMore(false);
        setMessages((prev) => {
          const prevIds = new Set(prev.map(m => m._id));
          const newUnique = data.filter((m: any) => !prevIds.has(m._id));
          return [...prev, ...newUnique];
        });
        setPage((prev) => prev + 1);

        // Mark as seen
        const unseenIds = data.filter((m: any) => m.sender?._id !== user._id && !m.seen).map((m: any) => m._id);
        if (unseenIds.length > 0) {
          supabase.from('messages').update({ seen: true }).in('_id', unseenIds).then();
        }
      }
    } catch (error) {
      console.log("Error loading messages", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  /* ---------- SEND ---------- */
  const sendMessage = async () => {
    if (!text.trim() || !otherUser) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const tempId = generateUUID();
    const tempMessage = {
      _id: tempId,
      conversationId,
      sender: user,
      message: text,
      createdAt: new Date().toISOString(),
      replyTo: replyingTo || null,
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
      // Send Push Notification via backend socket
      if (otherUser) {
        socket.emit("chat_notify", { 
          receiverId: otherUser._id, 
          title: user.name, 
          body: text 
        });
      }

      // 1. Ensure conversation exists in Supabase (Upsert) and increment unreadCount
      const { data: convData } = await supabase.from('conversations').select('unreadCount').eq('_id', conversationId).single();
      const currentUnread = convData?.unreadCount?.[otherUser?._id] || 0;

      await supabase.from('conversations').upsert({
        _id: conversationId,
        participants: [user, otherUser],
        lastMessage: tempMessage.message,
        lastMessageSender: user._id,
        updatedAt: tempMessage.createdAt,
        unreadCount: {
           ...(convData?.unreadCount || {}),
           [otherUser._id]: currentUnread + 1
        }
      });

      // 2. Insert message
      const { data, error } = await supabase.from('messages').insert([{
        _id: tempId,
        conversationId,
        sender: user,
        message: tempMessage.message,
        messageType: 'text',
        replyTo: tempMessage.replyTo,
      }]).select().single();

      if (data) {
        setMessages((prev) => prev.map(m => m._id === tempId ? data : m));
        // Send Push Notification via existing socket event
        socket.emit("chat_notify", {
          receiverId: otherUser._id,
          title: user.name,
          body: tempMessage.message,
        });
      } else if (error) {
        throw error;
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
      // Send Push Notification via backend socket
      if (otherUser) {
        socket.emit("chat_notify", { 
          receiverId: otherUser._id, 
          title: user.name, 
          body: `Sent a ${type}` 
        });
      }

      const res = await axios.post("/chat/send", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        const mediaUrl = res.data.message.mediaUrl;

        // Save to Supabase just like text message
        const { data: convData } = await supabase.from('conversations').select('unreadCount').eq('_id', conversationId).single();
        const currentUnread = convData?.unreadCount?.[otherUser?._id] || 0;

        await supabase.from('conversations').upsert({
          _id: conversationId,
          participants: [user, otherUser],
          lastMessage: type === 'image' ? 'Sent an image' : (type === 'video' ? 'Sent a video' : 'Sent a file'),
          lastMessageSender: user._id,
          updatedAt: new Date().toISOString(),
          unreadCount: {
             ...(convData?.unreadCount || {}),
             [otherUser._id]: currentUnread + 1
          }
        });

        const { data } = await supabase.from('messages').insert([{
          _id: tempId,
          conversationId,
          sender: user,
          message: "",
          messageType: type,
          mediaUrl: mediaUrl,
          replyTo: replyingTo ? replyingTo : null,
        }]).select().single();

        if (data) {
          setMessages(prev => prev.map(m => m._id === tempId ? data : m));
        }
      }
    } catch (e) {
      console.error("Upload error:", e);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert("Upload Failed", "Could not send media. Please try again.");
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
  const renderItem = ({ item, index }: any) => {
    const isMe =
      item.sender === user._id ||
      item.sender?._id === user._id;

    const isLastMessage = index === 0;

    return (
      <View className={`w-full ${isMe ? "items-end" : "items-start"} mb-2`}>
        <View className={`flex-row items-end ${isMe ? "flex-row-reverse" : "flex-row"} max-w-[85%]`}>
          {/* AVATAR */}
          <View className={`${isMe ? "ml-3" : "mr-3"}`}>
            <View className="w-9 h-9 rounded-2xl border-2 border-white shadow-sm overflow-hidden bg-slate-200">
              <Image
                source={{
                  uri: isMe
                    ? (user?.avatar || `https://ui-avatars.com/api/?name=${user?.username}&background=333&color=fff`)
                    : (item.sender?.avatar || `https://ui-avatars.com/api/?name=${item.sender?.username || 'U'}&background=f97316&color=fff`),
                }}
                className="w-full h-full"
              />
            </View>
          </View>

          <View className={`${isMe ? "items-end" : "items-start"} flex-1`}>
            <TouchableOpacity
              activeOpacity={0.8}
              onLongPress={() => {
                if (isMe) {
                  Alert.alert("Transmission Control", "Select operation", [
                    { text: "Reply", onPress: () => setReplyingTo(item) },
                    { text: "Terminate (Delete)", style: "destructive", onPress: () => deleteMessage(item._id) },
                    { text: "Cancel", style: "cancel" }
                  ]);
                } else {
                  setReplyingTo(item);
                }
              }}
              delayLongPress={500}
              style={{
                borderTopLeftRadius: isMe ? 16 : 6,
                borderBottomLeftRadius: isMe ? 16 : 6,
                borderTopRightRadius: isMe ? 6 : 16,
                borderBottomRightRadius: isMe ? 6 : 16,
              }}
              className={`px-5 py-3 ${isMe
                ? "bg-zinc-900 shadow-md shadow-black/20"
                : "bg-white border border-slate-100 shadow-sm"
                }`}
            >
              {/* REPLY PREVIEW */}
              {item.replyTo && (
                <View className={`mb-2 p-2 rounded-xl border-l-2 ${isMe ? "bg-white/10 border-orange-500" : "bg-slate-50 border-orange-500"
                  }`}>
                  <Text className={`text-[9px] font-black uppercase tracking-widest ${isMe ? "text-orange-400" : "text-orange-600"}`}>
                    REF: {item.replyTo.sender?.name || (item.replyTo.sender === user._id ? "YOU" : "USER")}
                  </Text>
                  <Text className={`${isMe ? "text-slate-300" : "text-slate-500"} text-[11px] font-medium`} numberOfLines={1}>
                    {item.replyTo.message}
                  </Text>
                </View>
              )}

              {(item.messageType === "text" || !item.messageType) && item.message ? (
                <Text className={`text-[15px] leading-6 font-bold tracking-tight ${isMe ? "text-white" : "text-zinc-900"}`}>
                  {item.message}
                </Text>
              ) : null}

              {item.messageType === "image" && (
                <TouchableOpacity onPress={() => setSelectedImage(item.mediaUrl)}>
                  <Image 
                    source={{ uri: item.mediaUrl }} 
                    className="w-56 h-56 rounded-xl" 
                    resizeMode="cover" 
                    blurRadius={item.pending ? 10 : 0} 
                  />
                </TouchableOpacity>
              )}

              {item.messageType === "video" && (
                <Pressable 
                  onPress={(e) => e.stopPropagation()} 
                  onLongPress={(e) => e.stopPropagation()}
                  className="w-64 h-40 bg-zinc-900 rounded-xl overflow-hidden shadow-lg"
                >
                  <Video
                    source={{ uri: item.mediaUrl }}
                    rate={1.0}
                    volume={1.0}
                    isMuted={false}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isLooping={false}
                    useNativeControls
                    style={{ width: '100%', height: '100%' }}
                  />
                  {item.pending && (
                    <View className="absolute inset-0 bg-black/40 items-center justify-center">
                      <ActivityIndicator size="small" color="white" />
                    </View>
                  )}
                </Pressable>
              )}

              {item.messageType === "file" && (
                <Pressable 
                  onPress={(e) => {
                    e.stopPropagation();
                    Linking.openURL(item.mediaUrl);
                  }}
                  onLongPress={(e) => e.stopPropagation()}
                  className={`flex-row items-center p-3 rounded-xl ${isMe ? 'bg-white/10' : 'bg-black/5'}`}
                >
                  <View className={`w-10 h-10 rounded-lg items-center justify-center ${isMe ? 'bg-zinc-800' : 'bg-orange-100'}`}>
                    <Ionicons name="document-text" size={24} color={isMe ? "white" : "#f97316"} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className={`text-sm font-bold ${isMe ? "text-white" : "text-zinc-900"}`} numberOfLines={1}>
                      {item.message || 'Shared PDF'}
                    </Text>
                    <Text className={`${isMe ? "text-zinc-400" : "text-zinc-500"} text-[10px] uppercase font-bold`}>Tap to view PDF</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={isMe ? "white" : "#cbd5e1"} />
                </Pressable>
              )}
            </TouchableOpacity>

            {/* TIMESTAMP & STATUS */}
            <View className={`mt-1.5 ${isMe ? "items-end" : "items-start"}`}>
              <View className="flex-row items-center">
                <Text className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                
                {isMe && (
                  <View className="ml-1.5 flex-row items-center">
                    <Ionicons
                      name={item.seen ? "checkmark-done" : "checkmark"}
                      size={12}
                      color={item.seen ? "#f97316" : "#cbd5e1"}
                    />
                    <Text className={`text-[9px] ml-0.5 font-black uppercase ${item.seen ? "text-orange-500" : "text-slate-300"}`}>
                      {item.seen ? "READ" : "SENT"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* HEADER DECORATION (SOLAR GLOW) */}
      <View 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, zIndex: -1 }}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['#f19422', 'rgba(241, 148, 34, 0)']}
          style={{ flex: 1 }}
        />
      </View>

      {/* FIXED HEADER */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
        <View className="flex-row items-center justify-between px-6 py-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100"
            >
              <Ionicons name="chevron-back" size={24} color="#18181b" />
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
                <View className="relative">
                  <View className="w-11 h-11 rounded-full border-2 border-white shadow-sm overflow-hidden">
                    <Image
                      source={{
                        uri:
                          otherUser.avatar ||
                          `https://ui-avatars.com/api/?name=${otherUser.username}`,
                      }}
                      className="w-full h-full"
                    />
                  </View>
                  {onlineUsers.has(otherUser?._id) && (
                    <View className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </View>

                <View className="ml-3">
                  <Text className="font-black text-zinc-900 text-base tracking-tight">
                    {otherUser.name}
                  </Text>
                  {isTyping ? (
                    <Text className="text-[10px] text-green-500 font-bold uppercase tracking-widest">
                      typing...
                    </Text>
                  ) : (
                    <Text className="text-[10px] text-orange-500 font-black tracking-widest">
                      @{otherUser.username}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={{ flex: 1 }}>
            {/* MESSAGE CONTAINER (ROUNDED CARD) */}
          <View className="flex-1 bg-white shadow-sm overflow-hidden border-t border-slate-200">
            {loading ? (
              <View className="flex-1 p-6">
                {[1, 2, 3, 4, 5, 6].map(i => <ChatSkeleton key={i} isMe={i % 2 === 0} />)}
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={sortedMessages}
                inverted
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                onEndReached={loadMessages}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 }}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={() => <View className="h-0" />}
              />
            )}
          </View>

          {/* ✅ reply indicator */}
          {replyingTo && (
            <View className="mx-6 mb-2 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex-row items-center justify-between">
              <View className="flex-1 border-l-2 border-orange-500 pl-3">
                <Text className="text-orange-500 text-[10px] font-black uppercase tracking-widest mb-1">
                  Reference: {replyingTo.sender?.name || (replyingTo.sender === user._id ? "You" : "User")}
                </Text>
                <Text className="text-slate-600 text-xs font-bold" numberOfLines={1}>
                  {replyingTo.message}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                className="ml-3 w-6 h-6 items-center justify-center rounded-full bg-slate-50"
              >
                <Ionicons name="close" size={14} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          )}

          {/* INPUT AREA */}
          <View style={{ paddingBottom: isKeyboardVisible ? 20 : (insets.bottom > 0 ? insets.bottom : 12) }}>
            <View className="px-6 pb-2 pt-2 bg-white">
              <View className="flex-row items-center bg-gray-100 p-2 rounded-[28px] border border-slate-100 shadow-xl shadow-black/5">
                <TouchableOpacity onPress={handlePickImage} className="w-10 h-10 items-center justify-center">
                  <Ionicons name="image-outline" size={22} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePickDocument} className="w-10 h-10 items-center justify-center mr-1">
                  <Ionicons name="attach-outline" size={24} color="#64748b" />
                </TouchableOpacity>
                <TextInput
                  value={text}
                  onChangeText={handleTyping}
                  placeholder="Encrypting transmission..."
                  placeholderTextColor="#CBD5E1"
                  className="flex-1 px-3 text-zinc-900 font-bold text-sm tracking-tight py-2 placeholder:text-black"
                  multiline={true}
                  numberOfLines={1}
                />

                <TouchableOpacity
                  onPress={sendMessage}
                  className="w-11 h-11 bg-zinc-900 rounded-full items-center justify-center shadow-lg shadow-black/20"
                >
                  <Ionicons name="paper-plane" size={18} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      {/* FULL SCREEN IMAGE MODAL */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/95 justify-center items-center">
          <TouchableOpacity
            onPress={() => setSelectedImage(null)}
            className="absolute top-12 right-6 w-10 h-10 bg-white/10 rounded-full items-center justify-center z-50"
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              className="w-full h-[80%]"
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

export default Chat;
