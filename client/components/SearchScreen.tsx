import { View, Text, TextInput, FlatList, Image, ActivityIndicator, TouchableOpacity, StatusBar } from "react-native";
import React, { useState, useEffect, useCallback } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Avatar from "./Avatar";

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

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchUsers(normalized);
    }, 400); 
    return () => clearTimeout(timer);
  }, [query]);

  const fetchUsers = async (searchText: string) => {
    try {
      setLoading(true);
      const normalized = searchText.trim();
      const res = await axios.post("/user/search", {
        name: normalized,
      });

      if (res.data.success) {
        setSearchResults(res.data.users || []);
      }
    } catch (error) {
      console.log("Search Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = async (user: User) => {
    const updated = [user, ...recentSearches.filter((item) => item._id !== user._id)].slice(0, 10);
    setRecentSearches(updated);
    await AsyncStorage.setItem("recentSearches", JSON.stringify(updated));
    navigation.navigate("PublicProfile", { user: user });
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
      className="flex-row items-center justify-between p-4 mb-4 mx-6 bg-white rounded-2xl border border-gray-100 shadow-sm shadow-black/5"
    >
      <View className="flex-row items-center flex-1">
        <Avatar 
          user={item as any} 
          size={48} 
        />
        
        <View className="ml-4">
          <Text className="text-base font-bold text-zinc-900">
            {item.username}
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            {item.name}
          </Text>
        </View>
      </View>

      {isRecent && (
        <TouchableOpacity 
            onPress={() => removeItem(item._id)}
            className="p-2 bg-gray-50 rounded-full border border-gray-100"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#9ca3af" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#F5F7FA]">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1">
        
        {/* HEADER */}
        <View className="flex-row items-center px-6 pt-4 mb-6">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="p-2 bg-white rounded-full mr-4 border border-gray-100 shadow-sm"
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter">
            USER <Text className="text-pink-500">SEARCH</Text> 🔍
          </Text>
        </View>

        {/* SEARCH BAR */}
        <View className="px-6 mb-4">
            <View className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 border border-gray-100 shadow-sm">
                <Ionicons name="search" size={20} color="#ec4899" />
                <TextInput
                    className="flex-1 ml-3 text-base text-zinc-900 font-medium"
                    placeholder="Search for developers..."
                    placeholderTextColor="#9ca3af"
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {loading && <ActivityIndicator size="small" color="#ec4899" className="mr-2" />}
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close-circle" size={20} color="#9ca3af" />
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
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              !loading ? (
                <View className="items-center mt-12 px-10">
                    <View className="w-16 h-16 bg-white rounded-full items-center justify-center mb-4 border border-gray-100 shadow-sm">
                      <Ionicons name="search-outline" size={32} color="#cbd5e1" />
                    </View>
                    <Text className="text-center text-zinc-900 font-bold text-lg">
                    No users found
                    </Text>
                    <Text className="text-center text-gray-500 mt-1">
                    Try searching for a different name or username
                    </Text>
                </View>
              ) : null
            }
          />
        ) : (
          <>
            <View className="flex-row justify-between items-center px-6 mt-4 mb-4">
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Searches</Text>
              {recentSearches.length > 0 && (
                <TouchableOpacity onPress={clearAll}>
                  <Text className="text-xs font-bold text-pink-500 uppercase tracking-widest">Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={recentSearches}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => renderUserItem({ item, isRecent: true })}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <View className="items-center mt-12 px-10">
                    <View className="w-16 h-16 bg-white rounded-full items-center justify-center mb-4 border border-gray-100 shadow-sm">
                      <Ionicons name="time-outline" size={32} color="#cbd5e1" />
                    </View>
                    <Text className="text-center text-zinc-900 font-bold text-lg">
                    No recent searches
                    </Text>
                    <Text className="text-center text-gray-500 mt-1">
                    Start exploring our community!
                    </Text>
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