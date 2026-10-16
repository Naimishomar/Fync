import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Animated
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { C } from '../constants/colors';
import { AppBar } from './ui/kit';
import Avatar from './Avatar';

type User = {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
  followers: string[];
};

const ItemSkeleton = () => (
  <View className="mx-gutter mb-6 bg-card rounded-sheet overflow-hidden border border-line shadow-hair p-6 flex-row items-center">
      <View className="w-16 h-16 bg-paper-2 rounded-card mr-5" />
      <View className="flex-1 justify-center">
          <View className="h-4 bg-paper-2 rounded w-3/4 mb-3" />
          <View className="h-3 bg-paper-2 rounded w-1/2 mb-2" />
      </View>
      <View className="w-20 h-10 bg-paper-2 rounded-lg ml-2" />
  </View>
);

const FollowersAndFollowing = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userId, type } = route.params ?? {}; // type is "followers" or "following"

  const { user: currentUser } = useAuth();
  const myId = currentUser?._id || "";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchList();
  }, [userId, type]);

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

  // One request per row at a time; a second tap mid-flight would race the first.
  const pending = useRef(new Set<string>());

  const toggleFollow = async (targetId: string, isFollowing: boolean) => {
    if (!myId || targetId === myId || pending.current.has(targetId)) return;
    pending.current.add(targetId);

    const apply = (follow: boolean) =>
      setUsers((prev) =>
        prev.map((u) => {
          if (u._id !== targetId) return u;
          const currentFollowers = (u.followers || []).filter((id) => id !== myId);
          return { ...u, followers: follow ? [...currentFollowers, myId] : currentFollowers };
        })
      );

    // Optimistic Update
    apply(!isFollowing);
    try {
      await axios.post(isFollowing ? `/user/unfollow/${targetId}` : `/user/follow/${targetId}`);
    } catch (err) {
      console.log("Follow error", err);
      apply(isFollowing);
    } finally {
      pending.current.delete(targetId);
    }
  };

  const renderItem = ({ item }: { item: User }) => {
    const isMe = item._id === myId;
    const isFollowing = (item.followers || []).includes(myId);

    return (
      <View className="mx-gutter mb-1 bg-card rounded-card overflow-hidden border border-line shadow-hair p-3 flex-row items-center">
        <Pressable
          onPress={() => navigation.push("PublicProfile", { user: item })}
          className="flex-row items-center flex-1"
        >
          <View className="mr-2">
            <Avatar user={item} size={40} showBadge={false} />
          </View>

          <View className="flex-1 justify-center">
            <Text className="text-ink font-display text-sm" numberOfLines={1}>{item.username}</Text>
            <Text className="text-ink-3 text-label font-semibold" numberOfLines={1}>{item.name}</Text>
          </View>
        </Pressable>

        {!isMe && (
          <TouchableOpacity
            onPress={() => toggleFollow(item._id, isFollowing)}
            className={`px-4 py-2 rounded-md shadow-hair ml-2 ${ isFollowing ? "bg-paper-2 border border-line" : "bg-brand-500 " }`}
          >
            <Text className={`font-display text-label uppercase ${isFollowing ? "text-ink-3" : "text-ink"}`}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };


  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      <View className="flex-1">
        <AppBar title={type === "following" ? "Following" : "Followers"} onBack={() => navigation.goBack()} />

        {loading ? (
            <View className="pt-2">
                {[1, 2, 3, 4, 5, 6].map(i => <ItemSkeleton key={i} />)}
            </View>
        ) : (
            <FlatList
                data={users}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                <View className="items-center justify-center mt-20 px-gutter">
                    <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                        <Ionicons name="people" size={40} color={C.ink4} />
                    </View>
                    <Text className="font-semibold text-base text-ink text-center">No {type} Found</Text>
                    <Text className="font-sans text-sm text-ink-4 mt-2 text-center">There are no users in this list yet.</Text>
                </View>
                }
            />
        )}
      </View>
    </View>
  );
};

export default FollowersAndFollowing;
