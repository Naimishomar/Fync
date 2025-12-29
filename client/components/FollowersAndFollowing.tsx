import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
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
  const { userId, type } = route.params;

  const { user: currentUser } = useAuth();
  const myId = currentUser?._id;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchList();
  }, []);

  const fetchList = async () => {
    try {
      const url =
        type === "followers"
          ? `/user/followers/${userId}`
          : `/user/following/${userId}`;

      const res = await axios.get(url);
      if (res.data.success) {
        setUsers(
          type === "followers" ? res.data.followers : res.data.following
        );
      }
    } catch (err) {
      console.log("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (targetId: string, isFollowing: boolean) => {
    try {
      await axios.post(
        isFollowing
          ? `/user/unfollow/${targetId}`
          : `/user/follow/${targetId}`
      );

      // Optimistic UI update
      setUsers((prev) =>
        prev.map((u) =>
          u._id === targetId
            ? {
                ...u,
                followers: isFollowing
                  ? u.followers.filter((id) => id !== myId)
                  : [...u.followers, myId],
              }
            : u
        )
      );
    } catch (err) {
      console.log("Follow error", err);
    }
  };

  const renderItem = ({ item }: { item: User }) => {
    const isMe = item._id === myId;
    const isFollowing = item.followers.includes(myId);

    return (
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => navigation.push("PublicProfile", { user: item })}
          className="flex-row items-center"
        >
          <Image
            source={{
              uri:
                item.avatar ||
                `https://ui-avatars.com/api/?name=${item.username}`,
            }}
            className="h-12 w-12 rounded-full bg-gray-200"
          />

          <View className="ml-3">
            <Text className="text-black font-semibold">{item.username}</Text>
            <Text className="text-gray-500 text-sm">{item.name}</Text>
          </View>
        </TouchableOpacity>

        {!isMe && (
          <TouchableOpacity
            onPress={() => toggleFollow(item._id, isFollowing)}
            className={`px-4 py-1 rounded-md ${
              isFollowing ? "bg-gray-200" : "bg-blue-500"
            }`}
          >
            <Text
              className={`font-semibold ${
                isFollowing ? "text-black" : "text-white"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* HEADER WITH BACK BUTTON */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="ml-4 text-lg font-semibold text-black capitalize">
          {type}
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text className="text-center text-gray-400 mt-10">
            No users found
          </Text>
        }
      />
    </SafeAreaView>
  );
};

export default FollowersAndFollowing;
