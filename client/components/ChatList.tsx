import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

const ChatList = ({ navigation }) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  const loadChats = async () => {
    const res = await axios.get("/chat/conversations");
    setConversations(res.data.conversations || []);
  };

  /* ---------- SEARCH USERS ---------- */
  const searchUsers = async (text: string) => {
    setSearch(text);

    if (!text.trim()) {
      setResults([]);
      return;
    }

    const res = await axios.get(`/chat/search?q=${text.trim()}`);
    setResults(res.data.users || []);
  };

  /* ---------- START CHAT ---------- */
  const startChat = async (targetUser: any) => {
    const res = await axios.post("/chat/start", {
      userId: targetUser._id,
    });

    navigation.navigate("Chat", {
      conversationId: res.data.conversation._id,
    });

    setSearch("");
    setResults([]);
  };

  /* ---------- CHAT ITEM ---------- */
  const renderConversation = ({ item }: any) => {
    const otherUser = item.participants.find(
      (p: any) => p._id !== user._id
    );

    const unread = item.unreadCount?.[user._id] || 0;

    return (
      <TouchableOpacity
        className="flex-row items-center px-4 py-3"
        onPress={() =>
          navigation.navigate("Chat", {
            conversationId: item._id,
          })
        }
      >
        <Image
          source={{
            uri: otherUser?.avatar?.trim() || `https://ui-avatars.com/api/?name=${otherUser?.username}&background=random&color=fff`,}}
          className="h-14 w-14 rounded-full bg-gray-200"
        />

        <View className="ml-4 flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-base text-black">
              {otherUser?.username}
            </Text>

            {unread > 0 && (
              <View className="bg-blue-500 min-w-[22px] min-h-[22px] flex justify-center items-center rounded-full">
                <Text className="text-white text-xs text-center">
                  {unread}
                </Text>
              </View>
            )}
          </View>

          <Text
            className="text-gray-500 mt-0.5"
            numberOfLines={1}
          >
            {item.lastMessage?.message || "Say hi 👋"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  /* ---------- SEARCH RESULT ITEM ---------- */
  const renderUser = ({ item }: any) => (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3"
      onPress={() => startChat(item)}
    >
      <Image
        source={{
          uri:
            item.avatar?.trim() ||
            `https://ui-avatars.com/api/?name=${item.username}&background=random&color=fff`,
        }}
        className="h-14 w-14 rounded-full bg-gray-200"
      />
      <View className="ml-4">
        <Text className="font-semibold text-black">
          {item.username}
        </Text>
        <Text className="text-gray-500 text-sm">
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* HEADER */}
      <View className="px-4 py-3 border-b border-gray-200">
        <Text className="text-2xl font-bold text-black">
          Messages
        </Text>
      </View>

      {/* SEARCH BAR */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-gray-100 rounded-full px-3 py-1">
          <Ionicons name="search" size={18} color="#666" />
          <TextInput
            value={search}
            onChangeText={searchUsers}
            placeholder="Search name or username"
            placeholderTextColor="#888"
            className="ml-2 flex-1 text-base text-black"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => searchUsers("")}>
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={search.length > 0 ? results : conversations}
        keyExtractor={(item) => item._id}
        renderItem={
          search.length > 0
            ? renderUser
            : renderConversation
        }
        ItemSeparatorComponent={() => (
          <View className="h-[1px] bg-gray-100 ml-20" />
        )}
        ListEmptyComponent={
          <Text className="text-center text-gray-400 mt-16">
            {search.length > 0
              ? "No users found"
              : "No chats yet"}
          </Text>
        }
      />
    </SafeAreaView>
  );
};

export default ChatList;
