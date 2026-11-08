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
import FollowSuggestions from './FollowSuggestions';

const RECENT_KEY = 'fync:recentSearches';
const RECENT_MAX = 8;

interface User {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
  user_access?: 'admin' | 'user' | 'alumni';
}

// A recent is either a person that was opened or a query that was submitted.
type Recent = User | { _id: string; query: string };
const isQuery = (r: Recent): r is { _id: string; query: string } => 'query' in r;

const SearchScreen = () => {
  const autoHideTabBar = useTabBarAutoHide();
  // Also mounted as the recruiter "Find Talent" tab, under the floating bar.
  const tabBarClearance = useTabBarClearance();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<Recent[]>([]);
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
  const pushRecent = useCallback((entry: Recent) => {
    setRecentSearches((prev) => {
      const updated = [entry, ...prev.filter((item) => item._id !== entry._id)].slice(0, RECENT_MAX);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const handleUserPress = useCallback((user: User) => {
    navigation.navigate("PublicProfile", { userId: user._id, user });
    pushRecent(user);
  }, [navigation, pushRecent]);

  const onSubmit = () => {
    const q = query.trim();
    if (q) pushRecent({ _id: `q:${q.toLowerCase()}`, query: q });
  };

  const removeItem = useCallback((userId: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((i) => i._id !== userId);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const clearAll = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  };

  useFocusEffect(
    useCallback(() => {
      loadRecentSearches();
    }, [])
  );

  const loadRecentSearches = async () => {
    try {
      // Old key held people only; read it once so nobody loses their history.
      const stored = (await AsyncStorage.getItem(RECENT_KEY)) ?? (await AsyncStorage.getItem("recentSearches"));
      if (stored) {
        setRecentSearches((JSON.parse(stored) as Recent[]).slice(0, RECENT_MAX));
      }
    } catch (err) {
      console.log("Failed to load recent searches", err);
    }
  };

  const renderResult = useCallback(({ item }: { item: User }) => (
    <UserRow item={item} onPress={handleUserPress} />
  ), [handleUserPress]);
  const renderRecent = useCallback(({ item }: { item: Recent }) => (
    isQuery(item)
      ? <QueryRow item={item} onPress={setQuery} onRemove={removeItem} />
      : <UserRow item={item} onPress={handleUserPress} onRemove={removeItem} />
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
            onSubmitEditing={onSubmit}
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
                  <Empty icon="search-outline" title="No results" hint={`Nobody matches "${query.trim()}". Try a different name or username.`} />
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
              <View className="mt-6">
                <Empty icon="time-outline" title="No recent searches" hint="People you look up will show here." />
              </View>
            }
            // Same endpoint and card row the feed uses (/user/suggestions).
            ListFooterComponent={<View style={{ marginTop: 16, marginHorizontal: -20 }}><FollowSuggestions /></View>}
          />
        )}
      </View>
    </View>
  );
};

const RemoveBtn = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    className="w-8 h-8 rounded-full bg-paper-2 items-center justify-center active:opacity-85"
    hitSlop={8}
    accessibilityRole="button"
    accessibilityLabel={`Remove ${label} from recent`}
  >
    <Ionicons name="close" size={14} color={C.ink3} />
  </Pressable>
);

const QueryRow = memo(function QueryRow({ item, onPress, onRemove }: {
  item: { _id: string; query: string }; onPress: (q: string) => void; onRemove: (id: string) => void;
}) {
  return (
    <ListRow
      onPress={() => onPress(item.query)}
      icon="time-outline"
      title={item.query}
      right={<RemoveBtn label={item.query} onPress={() => onRemove(item._id)} />}
    />
  );
});

const UserRow = memo(function UserRow({ item, onPress, onRemove }: {
  item: User; onPress: (u: User) => void; onRemove?: (id: string) => void;
}) {
  return (
    <ListRow
      onPress={() => onPress(item)}
      leading={<Avatar user={item as any} size={44} />}
      title={item.username}
      subtitle={item.name}
      right={onRemove ? <RemoveBtn label={item.username} onPress={() => onRemove(item._id)} /> : undefined}
    />
  );
});

export default SearchScreen;
