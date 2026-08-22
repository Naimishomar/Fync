import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Animated
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
  const { userId, type } = route.params; // type is "followers" or "following"

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
      <View className="mx-gutter mb-1 bg-card rounded-card overflow-hidden border border-line shadow-hair p-3 flex-row items-center">
        <Pressable
          onPress={() => navigation.push("PublicProfile", { user: item })}
          className="flex-row items-center flex-1"
        >
          <View className="w-10 h-10 bg-paper-2 rounded-full mr-2 overflow-hidden border border-line items-center justify-center">
            <Image
              source={{
                uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}&background=random&color=fff`,
              }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>

          <View className="flex-1 justify-center">
            <Text className="text-ink font-display text-sm">{item.username}</Text>
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

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-gutter pt-6 pb-2">
            <View className="flex-row items-center mb-3">
                <View>
                    <TouchableOpacity
                      onPress={() => navigation.goBack()}
                      className="w-11 h-11 items-center justify-center rounded-xl"
                      accessibilityRole="button"
                      accessibilityLabel="Go back"
                      style={{ marginLeft: -11 }}
                    >
                      <Ionicons name="arrow-back" size={24} color="#12100E" />
                    </TouchableOpacity>
                    <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Social</Text>
                    <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>{type}</Text>
                    <Text className="text-ink-3 text-label font-display uppercase">Network Grid Protocol</Text>
                </View>
            </View>
        </View>

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
                        <Ionicons name="people" size={40} color="#C4BEB6" />
                    </View>
                    <Text className="font-semibold text-base text-ink text-center">No {type} Found</Text>
                    <Text className="font-sans text-sm text-ink-4 mt-2 text-center">There are no users in this list yet.</Text>
                </View>
                }
            />
        )}
      </SafeAreaView>
    </View>
  );
};

export default FollowersAndFollowing;
