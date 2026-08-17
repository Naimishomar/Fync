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
import { LinearGradient } from "expo-linear-gradient";

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
      <View className="mx-8 mb-1 bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm shadow-black/5 p-3 flex-row items-center">
        <Pressable
          onPress={() => navigation.push("PublicProfile", { user: item })}
          className="flex-row items-center flex-1"
        >
          <View className="w-10 h-10 bg-slate-50 rounded-full mr-2 overflow-hidden border border-slate-100 items-center justify-center">
            <Image
              source={{
                uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}&background=random&color=fff`,
              }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>

          <View className="flex-1 justify-center">
            <Text className="text-slate-900 font-black text-sm tracking-tight">{item.username}</Text>
            <Text className="text-slate-500 text-2xs font-bold" numberOfLines={1}>{item.name}</Text>
          </View>
        </Pressable>

        {!isMe && (
          <TouchableOpacity
            onPress={() => toggleFollow(item._id, isFollowing)}
            className={`px-4 py-2 rounded-md shadow-sm ml-2 ${
              isFollowing 
                ? "bg-slate-50 border border-slate-200" 
                : "bg-orange-500 shadow-orange-500/20"
            }`}
          >
            <Text className={`font-black text-2xs uppercase tracking-widest ${isFollowing ? "text-slate-500" : "text-white"}`}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const ItemSkeleton = () => (
    <View className="mx-8 mb-6 bg-white rounded-4xl overflow-hidden border border-slate-100 shadow-sm p-6 flex-row items-center">
        <View className="w-16 h-16 bg-slate-50 rounded-2xl mr-5" />
        <View className="flex-1 justify-center">
            <View className="h-4 bg-slate-50 rounded w-3/4 mb-3" />
            <View className="h-3 bg-slate-50 rounded w-1/2 mb-2" />
        </View>
        <View className="w-20 h-10 bg-slate-50 rounded-lg ml-2" />
    </View>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      <View className="absolute top-0 w-full h-80 opacity-20 pointer-events-none">
          <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-8 pt-6 pb-2">
            <View className="flex-row items-center mb-3">
                <View>
                    <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase leading-tight">Social <Text className="text-orange-500">{type}</Text></Text>
                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Network Grid Protocol</Text>
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
                <View className="items-center justify-center mt-20 px-10">
                    <View className="w-24 h-24 bg-white rounded-4xl items-center justify-center mb-6 border border-slate-100 shadow-sm shadow-black/5">
                        <Ionicons name="people" size={40} color="#cbd5e1" />
                    </View>
                    <Text className="text-slate-500 font-black uppercase text-xs tracking-wide text-center">No {type} Found</Text>
                    <Text className="text-slate-300 text-2xs font-bold uppercase mt-2 text-center">There are no users in this list yet.</Text>
                </View>
                }
            />
        )}
      </SafeAreaView>
    </View>
  );
};

export default FollowersAndFollowing;
