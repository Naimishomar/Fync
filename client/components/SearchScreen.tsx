import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import React, { useState, useEffect, useCallback } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
}

const SearchScreen = () => {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const normalized = query.replace(/\s+/g, "").trim();
    if (!normalized) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchUsers(normalized);
    }, 700);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchUsers = async (searchText: string) => {
    try {
      setLoading(true);
      const normalized = searchText.replace(/\s+/g, "").trim();
      const res = await axios.post("http://192.168.28.112:3000/user/search", {
        name: normalized,
      });

      if (res.data.success) {
        setSearchResults(res.data.users || []);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = async (user: User) => {
    const updated = [user,...recentSearches.filter((item) => item._id !== user._id),].slice(0, 10);
    setRecentSearches(updated);
    await AsyncStorage.setItem("recentSearches", JSON.stringify(updated));
    navigation.navigate("PublicProfile", { user });
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
      className="flex-row items-center justify-between py-3 border-b border-gray-100"
    >
      <View className="flex-row items-center flex-1">
        <Image 
          source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}&background=random&color=fff` }}
          className="w-12 h-12 rounded-full bg-gray-200"
        />
        
        <View className="ml-3">
          <Text className="text-base font-semibold text-black">
            {item.username}
          </Text>
          <Text className="text-sm text-gray-500">
            {item.name}
          </Text>
        </View>
      </View>

      {isRecent && (
        <TouchableOpacity onPress={() => removeItem(item._id)}>
          <Ionicons name="close" size={18} color="#555" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white px-4">
      <Ionicons name="arrow-back" size={24} color="black" onPress={()=> navigation.goBack()} />
      <View className="flex-row items-center bg-gray-100 rounded-full px-3 mt-2">
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          className="flex-1 ml-2 text-base text-black"
          placeholder="Search"
          placeholderTextColor="#888"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator size="small" color="#888" />}
        <Ionicons name="close" size={20} color="#888" onPress={()=> setQuery("")} />
      </View>

      {query.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => renderUserItem({ item, isRecent: false })}
          ListEmptyComponent={
            !loading ? (
              <Text className="text-center text-gray-400 mt-12">
                No users found
              </Text>
            ) : null
          }
        />
      ) : (
        <>
          <View className="flex-row justify-between items-center mt-6 mb-3">
            <Text className="text-base font-semibold text-black">Recent</Text>
            {recentSearches.length > 0 && (
              <TouchableOpacity onPress={clearAll}>
                <Text className="text-sm text-blue-500">Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={recentSearches}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => renderUserItem({ item, isRecent: true })}
            ListEmptyComponent={
              <Text className="text-center text-gray-400 mt-12">
                No recent searches
              </Text>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
};

export default SearchScreen;