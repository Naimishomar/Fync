import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";

type User = {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
  followers: string[];
};

const FollowersAndFollowing = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userId, type } = route.params; // type is "followers" or "following"

  const { user: currentUser } = useAuth();
  const myId = currentUser?._id || "";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchList();

      return () => {
        setUsers([]);
      };
    }, [userId, type])
  );

  const fetchList = async () => {
    try {
      const endpoint = type === "followers" ? "followers" : "following";
      const res = await axios.get(`/user/${endpoint}/${userId}`);
      
      if (res.data.success) {
        // Handle response key dynamically
        const list = type === "followers" ? res.data.followers : res.data.following;
        setUsers(list || []);
      }
    } catch (err) {
      console.log("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (targetId: string, isFollowing: boolean) => {
    if (!myId || targetId === myId) return;

    try {
      // Optimistic Update
      setUsers((prev) =>
        prev.map((u) => {
          if (u._id !== targetId) return u;

          const currentFollowers = u.followers || [];
          const updatedFollowers = isFollowing
            ? currentFollowers.filter((id) => id !== myId)
            : [...currentFollowers, myId];

          return { ...u, followers: updatedFollowers };
        })
      );

      // API Call
      await axios.post(isFollowing ? `/user/unfollow/${targetId}` : `/user/follow/${targetId}`);
    } catch (err) {
      console.log("Follow error", err);
    }
  };

  const renderItem = ({ item }: { item: User }) => {
    const isMe = item._id === myId;
    const isFollowing = (item.followers || []).includes(myId);

    return (
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-900">
        <Pressable
          // ✅ FIX: Pass the 'user' object so PublicProfile receives it correctly
          onPress={() => navigation.push("PublicProfile", { user: item })}
          className="flex-row items-center flex-1"
        >
          <Image
            source={{
              uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}&background=random&color=fff`,
            }}
            className="h-12 w-12 rounded-full border border-gray-800"
          />

          <View className="ml-3 flex-1">
            <Text className="text-white font-semibold text-base">{item.username}</Text>
            <Text className="text-gray-400 text-sm" numberOfLines={1}>{item.name}</Text>
          </View>
        </Pressable>

        {!isMe && (
          <Pressable
            onPress={() => toggleFollow(item._id, isFollowing)}
            className={`px-5 py-1.5 rounded-lg border ${
              isFollowing 
                ? "bg-black border-gray-600" 
                : "bg-blue-600 border-blue-600"
            }`}
          >
            <Text className={`font-semibold text-sm ${isFollowing ? "text-white" : "text-white"}`}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#f9a8d4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* HEADER */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-900">
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color="white" />
        </Pressable>
        <Text className="ml-6 text-xl font-bold text-white capitalize">
          {type}
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerClassName="pt-2"
        ListEmptyComponent={
          <View className="items-center justify-center mt-20">
             <Ionicons name="people-outline" size={48} color="#333" />
             <Text className="text-gray-500 mt-4 text-lg">No {type} found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default FollowersAndFollowing;