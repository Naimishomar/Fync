import React, { useEffect, useState, useRef } from "react";
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
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import io from "socket.io-client";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { SafeAreaView } from "react-native-safe-area-context";

// --- ZEGO IMPORTS ---
import ZegoUIKitPrebuiltCallService, { 
  ZegoSendCallInvitationButton 
} from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZIM from 'zego-zim-react-native';

const socket = io("http://10.21.70.187:3000");

// Use your actual keys here
const APP_ID = 1870753423; 
const APP_SIGN = "0c687e01e1e38767ccdd1fa77993629c0fc3a6392df1e6175cce7d3cc36e76c7";

const Chat = ({ route, navigation } : any) => {
  const conversationId = route?.params?.conversationId;
  const { user } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [otherUser, setOtherUser] = useState<any>(null);
  
  // Zego State
  const [isZegoReady, setIsZegoReady] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  /* ---------- SAFETY ---------- */
  if (!conversationId) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-500">No conversation selected</Text>
      </SafeAreaView>
    );
  }

  /* ---------- 1. INIT ZEGO SERVICE ---------- */
  // We initialize here so you can call directly without going to VideoLobby first
  useEffect(() => {
    const initZego = async () => {
      try {
        await ZegoUIKitPrebuiltCallService.init(
          APP_ID,
          APP_SIGN,
          user._id, // My User ID
          user.username || user.name, // My Name
          [ZIM],
          {
            onCallInvitationEvent: (event: any, data: any) => {
               // Optional: Handle custom socket status updates here if needed
            }
          }
        );
        setIsZegoReady(true);
        console.log("Chat: Zego Service Initialized");
      } catch (error) {
        console.error("Chat: Zego Init Error", error);
      }
    };

    initZego();

    // Cleanup when leaving Chat (Optional: depending on if you want to receive calls globally)
    // For now, we keep it active or uninit if you prefer strict cleanup
    return () => {
        // ZegoUIKitPrebuiltCallService.uninit(); 
    };
  }, []);

  /* ---------- FETCH CONVERSATION USER ---------- */
  const fetchConversationUser = async () => {
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

    try {
        const res = await axios.get(
          `/chat/${conversationId}/messages?page=${page}`
        );
        setMessages((prev) => [...prev, ...res.data.messages]);
        setPage((prev) => prev + 1);
    } catch (error) {
        console.log("Error loading messages", error);
    } finally {
        setLoadingMore(false);
    }
  };

  /* ---------- SEND ---------- */
  const sendMessage = () => {
    if (!text.trim()) return;

    const tempMessage = {
      _id: Date.now().toString(),
      sender: user._id,
      message: text,
      createdAt: new Date().toISOString(),
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
      <View className={`flex-row w-full ${isMe ? "justify-end" : "justify-start"} items-center py-1`}>
        {isMe ? (
          <>
            <View className="max-w-[75%] px-4 py-2 rounded-3xl bg-blue-500">
              <Text className="text-white">{item.message}</Text>
            </View>
            <Image
              source={{
                uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}&background=random&color=fff`,
              }}
              className="h-6 w-6 rounded-full ml-2"
            />
          </>
        ) : (
          <>
            <Image
              source={{
                uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}&background=random&color=fff`,
              }}
              className="h-6 w-6 rounded-full mr-2"
            />
            <View className="max-w-[75%] px-4 py-2 rounded-3xl bg-gray-200">
              <Text className="text-black">{item.message}</Text>
            </View>
          </>
        )}
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
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <View className="flex-row items-center">
              <Pressable onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="black" />
              </Pressable>

              {otherUser && (
                <Pressable
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
                </Pressable>
              )}
          </View>

          {/* 2. VIDEO CALL BUTTON */}
          {otherUser && isZegoReady ? (
             <ZegoSendCallInvitationButton 
                invitees={[{ userID: otherUser._id, userName: otherUser.name || otherUser.username }]}
                isVideoCall={true}
                resourceID={"zego_call"} // Ensure this matches your Zego Console config
                backgroundColor={'transparent'} // Transparent so we only see icon
                width={40}
                height={40}
                borderRadius={20}
                icon={null} // You can pass a custom icon image source here if you want
                // We use a child component to render our own Ionicons
                renderCustomView={() => (
                    <Ionicons name="videocam" size={28} color="#2563eb" />
                )}
                onPressed={(errorCode: any, errorMessage: any) => {
                    if (errorCode) {
                        Alert.alert("Call Error", errorMessage);
                    }
                }}
             />
          ) : (
             <View className="w-10 h-10 justify-center items-center">
                 {/* Placeholder while loading or if user missing */}
                 <Ionicons name="videocam-outline" size={28} color="#ccc" />
             </View>
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
          <Pressable
            onPress={sendMessage}
            className="ml-3 bg-blue-500 p-2 rounded-full"
          >
            <Ionicons name="send" size={18} color="white" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Chat;