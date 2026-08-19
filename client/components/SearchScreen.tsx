import { View, Text, TextInput, FlatList, Image, ActivityIndicator, TouchableOpacity, StatusBar } from "react-native";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Avatar from "./Avatar";
import { LinearGradient } from 'expo-linear-gradient';

interface User {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
  user_access?: 'admin' | 'user' | 'alumni';
}

const SearchScreen = () => {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Responses can land out of order -- typing "an" then "ann" and having "an"
  // reply last used to overwrite the newer results with stale ones. Only the
  // most recently issued request is allowed to write state.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const normalized = query.trim();
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
        setSearchResults(res.data.users || []);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.log("Search Error:", error);
      setSearchResults([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const handleUserPress = async (user: User) => {
    const updated = [user, ...recentSearches.filter((item) => item._id !== user._id)].slice(0, 10);
    setRecentSearches(updated);
    await AsyncStorage.setItem("recentSearches", JSON.stringify(updated));
    navigation.navigate("PublicProfile", { userId: user._id, user });
  };

  const removeItem = async (userId: string) => {
    const updated = recentSearches.filter((i) => i._id !== userId);
    setRecentSearches(updated);
    await AsyncStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  const clearAll = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem("recentSearches");
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

  const renderUserItem = ({ item, isRecent }: { item: User; isRecent: boolean }) => (
    <TouchableOpacity
      onPress={() => handleUserPress(item)}
      activeOpacity={0.8}
      className="flex-row items-center justify-between p-3 mb-2 bg-white rounded-xl border border-slate-100 shadow-sm shadow-black/5"
    >
      <View className="flex-row items-center flex-1">
        <Avatar
          user={item as any}
          size={34}
        />

        <View className="ml-4">
          <Text className="text-slate-900 font-black text-xs tracking-tight">
            {item.username}
          </Text>
          <Text className="text-slate-500 text-2xs font-bold tracking-wide">
            {item.name}
          </Text>
        </View>
      </View>

      {isRecent && (
        <TouchableOpacity
          onPress={() => removeItem(item._id)}
          className="bg-slate-50 p-2 rounded-xl border border-slate-100"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={14} color="#94A3B8" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#f97316', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>

        {/* Arena Header */}
        <View className="px-8 pt-2 bg-transparent">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                  Find <Text className="text-orange-500">Friends</Text>
                </Text>
              </View>
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Global Campus Directory</Text>
            </View>
          </View>

          {/* SEARCH DOCK */}
          <View className="flex-row items-center bg-white px-5 py-1 rounded-2xl border border-slate-100 shadow-xl shadow-black/5 mb-5">
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              className="flex-1 text-slate-900 font-bold text-sm tracking-tight p-3"
              placeholder="Search contacts..."
              placeholderTextColor="#CBD5E1"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loading && <ActivityIndicator size="small" color="#f97316" className="mr-2" />}
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* LIST RENDER */}
        {query.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => renderUserItem({ item, isRecent: false })}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
            ListHeaderComponent={() => (
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-3">Registry results</Text>
            )}
            ListEmptyComponent={
              !loading && searchResults.length === 0 ? (
                <View className="items-center mt-12 px-10">
                  <View className="w-16 h-16 bg-white rounded-full items-center justify-center mb-4 border border-slate-100 shadow-sm">
                    <Ionicons name="search-outline" size={32} color="#cbd5e1" />
                  </View>
                  <Text className="text-center text-slate-900 font-bold text-lg">
                    No users found
                  </Text>
                  <Text className="text-center text-slate-500 mt-1">
                    Try searching for a different name or username
                  </Text>
                </View>
              ) : null
            }
          />
        ) : (
          <>
            <View className="flex-row justify-between items-center px-8 mt-4 mb-4">
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Recent Registry Lookups</Text>
              {recentSearches.length > 0 && (
                <TouchableOpacity onPress={clearAll}>
                  <Text className="text-2xs font-black text-orange-500 uppercase tracking-wide">Wipe Data</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={recentSearches}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => renderUserItem({ item, isRecent: true })}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
              ListEmptyComponent={
                <View className="items-center mt-12 px-10">
                  <View className="w-20 h-20 bg-white rounded-4xl items-center justify-center mb-6 border border-slate-100 shadow-sm">
                    <Ionicons name="time-outline" size={32} color="#cbd5e1" />
                  </View>
                  <Text className="text-slate-500 font-black  uppercase text-xs tracking-wide text-center">History Empty</Text>
                  <Text className="text-slate-300 text-2xs font-bold uppercase mt-2 text-center">No previous registry lookups found.</Text>
                </View>
              }
            />
          </>
        )}
      </SafeAreaView>
    </View>
  );
};

export default SearchScreen;
