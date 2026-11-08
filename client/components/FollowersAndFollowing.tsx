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
import { AppBar, Button, Empty, ListRow } from './ui/kit';
import Avatar from './Avatar';
import { tapHaptic } from '../utils/haptics';

import FyncRefreshControl from './ui/FyncRefreshControl';
type User = {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
  followers: string[];
};

const ItemSkeleton = () => (
  <View className="mx-gutter flex-row items-center" style={{ minHeight: 64 }}>
      <View className="w-11 h-11 bg-paper-2 rounded-full mr-3" />
      <View className="flex-1 justify-center">
          <View className="h-3.5 bg-paper-2 rounded-full w-1/2 mb-2" />
          <View className="h-3 bg-paper-2 rounded-full w-1/3" />
      </View>
      <View className="w-20 h-9 bg-paper-2 rounded-full ml-2" />
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
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

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
        setFailed(false);
      }
    } catch (err) {
      // An empty "No followers" on a network error read as the truth.
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // One request per row at a time; a second tap mid-flight would race the first.
  const pending = useRef(new Set<string>());

  const toggleFollow = async (targetId: string, isFollowing: boolean) => {
    if (!myId || targetId === myId || pending.current.has(targetId)) return;
    pending.current.add(targetId);
    tapHaptic();

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
      <ListRow
        style={{ paddingHorizontal: 20 }}
        onPress={() => navigation.push("PublicProfile", { user: item })}
        leading={<Avatar user={item} size={44} showBadge={false} />}
        title={item.username}
        subtitle={item.name}
        right={!isMe ? (
          <Button
            small
            variant={isFollowing ? 'secondary' : 'primary'}
            title={isFollowing ? "Following" : "Follow"}
            accessibilityLabel={isFollowing ? `Unfollow ${item.username}` : `Follow ${item.username}`}
            onPress={() => toggleFollow(item._id, isFollowing)}
          />
        ) : undefined}
        chevron={false}
      />
    );
  };


  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title={type === "following" ? "Following" : "Followers"} onBack={() => navigation.goBack()} />

        {loading ? (
            <View className="pt-2">
                {[1, 2, 3, 4, 5, 6].map(i => <ItemSkeleton key={i} />)}
            </View>
        ) : (
            <FlatList keyboardShouldPersistTaps="handled"
                data={users}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchList(); }} />}
                ListEmptyComponent={
                <View className="mt-16">
                    <Empty
                        icon={failed ? "cloud-offline-outline" : "people-outline"}
                        title={failed ? "Couldn't load this list" : type === "following" ? "Not following anyone yet" : "No followers yet"}
                        hint={failed ? "Pull down to try again." : "There are no users in this list yet."}
                    />
                </View>
                }
            />
        )}
      </View>
    </View>
  );
};

export default FollowersAndFollowing;
