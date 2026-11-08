import { View, FlatList, ActivityIndicator, Pressable, StatusBar } from "react-native";
import { useTabBarAutoHide, useTabBarClearance } from '../constants/layout';
import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Avatar from "./Avatar";
import { C } from '../constants/colors';
import { AppBar, Button, Empty, ListRow, SearchField, SectionHeader } from './ui/kit';

interface User {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
  user_access?: 'admin' | 'user' | 'alumni';
}

const SearchScreen = () => {
  const autoHideTabBar = useTabBarAutoHide();
  // Also mounted as the recruiter "Find Talent" tab, under the floating bar.
  const tabBarClearance = useTabBarClearance();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState(false);

  // Responses can land out of order -- typing "an" then "ann" and having "an"
  // reply last used to overwrite the newer results with stale ones. Only the
  // most recently issued request is allowed to write state.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const normalized = query.trim();
    setSearchError(false);
    if (!normalized) {
      requestIdRef.current += 1; // cancels any reply still in flight
      setSearchResults([]);
      setLoading(false);
      return;
    }
    // A full second of dead air after the last keystroke read as "search is
    // broken". 300ms is past the typing burst without feeling stalled.
    setLoading(true);
    const timer = setTimeout(() => {
      fetchUsers(normalized);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchUsers = async (searchText: string) => {
    const requestId = ++requestIdRef.current;
    try {
      const res = await axios.get("/user/search", { params: { q: searchText } });
      if (requestId !== requestIdRef.current) return;
      if (res.data.success) {
        setSearchError(false);
        setSearchResults(res.data.users || []);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.log("Search Error:", error);
      setSearchResults([]);
      setSearchError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  // Navigate first: waiting on storage delayed the tap, and a storage error
  // swallowed it entirely.
  const handleUserPress = useCallback((user: User) => {
    navigation.navigate("PublicProfile", { userId: user._id, user });
    setRecentSearches((prev) => {
      const updated = [user, ...prev.filter((item) => item._id !== user._id)].slice(0, 10);
      AsyncStorage.setItem("recentSearches", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [navigation]);

  const removeItem = useCallback((userId: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((i) => i._id !== userId);
      AsyncStorage.setItem("recentSearches", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const clearAll = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem("recentSearches").catch(() => {});
  };

  useFocusEffect(
    useCallback(() => {
      loadRecentSearches();
    }, [])
  );

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem("recentSearches");
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (err) {
      console.log("Failed to load recent searches", err);
    }
  };

  const renderResult = useCallback(({ item }: { item: User }) => (
    <UserRow item={item} onPress={handleUserPress} />
  ), [handleUserPress]);
  const renderRecent = useCallback(({ item }: { item: User }) => (
    <UserRow item={item} onPress={handleUserPress} onRemove={removeItem} />
  ), [handleUserPress, removeItem]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title="Find friends" onBack={() => navigation.goBack()} />
        <View className="px-gutter pb-2">
          <SearchField
            placeholder="Search people"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* LIST RENDER */}
        {query.trim().length > 0 ? (
          <FlatList
            data={searchResults}
            {...autoHideTabBar}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            renderItem={renderResult}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarClearance }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <SectionHeader
                title="Results"
                right={loading ? <ActivityIndicator size="small" color={C.brand[500]} /> : undefined}
                style={{ marginTop: 12, marginBottom: 4 }}
              />
            }
            ListEmptyComponent={
              !loading && searchError ? (
                <View className="mt-10">
                  <Empty
                    icon="cloud-offline-outline"
                    title="Couldn't search right now"
                    action={<Button title="Try again" onPress={() => { setLoading(true); fetchUsers(query.trim()); }} />}
                  />
                </View>
              ) : !loading && searchResults.length === 0 ? (
                <View className="mt-10">
                  <Empty icon="search-outline" title="No users found" hint="Try a different name or username." />
                </View>
              ) : null
            }
          />
        ) : (
          <FlatList
            data={recentSearches}
            {...autoHideTabBar}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            renderItem={renderRecent}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarClearance }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <SectionHeader
                title="Recent"
                action={recentSearches.length > 0 ? 'Clear all' : undefined}
                onAction={clearAll}
                style={{ marginTop: 12, marginBottom: 4 }}
              />
            }
            ListEmptyComponent={
              <View className="mt-10">
                <Empty icon="time-outline" title="No recent searches" hint="People you look up will show here." />
              </View>
            }
          />
        )}
      </View>
    </View>
  );
};

const UserRow = memo(function UserRow({ item, onPress, onRemove }: {
  item: User; onPress: (u: User) => void; onRemove?: (id: string) => void;
}) {
  return (
    <ListRow
      onPress={() => onPress(item)}
      leading={<Avatar user={item as any} size={44} />}
      title={item.username}
      subtitle={item.name}
      right={onRemove ? (
        <Pressable
          onPress={() => onRemove(item._id)}
          className="w-8 h-8 rounded-full bg-paper-2 items-center justify-center active:opacity-60"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.username} from recent`}
        >
          <Ionicons name="close" size={14} color={C.ink3} />
        </Pressable>
      ) : undefined}
    />
  );
});

export default SearchScreen;
