import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, FlatList, Image,
  TouchableOpacity, ScrollView, ActivityIndicator, Keyboard, Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetchRadioByCategory, searchRadioStations } from "../../constants/musicService";
import { useAuth } from "../../context/auth.context"; // Added to get current user
import socket from "../../utils/socket"; // Import your socket instance
import axios from "../../context/axiosConfig";

//@ts-ignore
import FYNC_LOGO from '../../assets/logo.png';

interface User {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
}

export default function GroupJamSetup({ navigation }: any) {
  const { user: currentUser } = useAuth(); // Get current logged-in user as Host

  // SQUAD STATES
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  // RADIO STATES
  const [stations, setStations] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [activeCategory, setActiveCategory] = useState('bollywood');
  const [musicSearchQuery, setMusicSearchQuery] = useState("");

  useEffect(() => {
    loadCategoryRadio('bollywood');
  }, []);

  const loadCategoryRadio = async (category: string) => {
    setActiveCategory(category);
    setMusicSearchQuery('');
    setLoadingMusic(true);
    try {
      const data = await fetchRadioByCategory(category);
      if (data && data.length > 0) {
        setStations(data);
        if (!selectedStation) setSelectedStation(data[0]);
      } else {
        setStations([]);
      }
    } catch (error) {
      console.error("Failed to load category:", error);
    } finally {
      setLoadingMusic(false);
    }
  };

  const handleMusicSearch = async () => {
    if (!musicSearchQuery.trim()) return;
    Keyboard.dismiss();
    setActiveCategory('search');
    setLoadingMusic(true);
    try {
      const data = await searchRadioStations(musicSearchQuery);
      setStations(data);
      if (data.length > 0) setSelectedStation(data[0]);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoadingMusic(false);
    }
  };

  const searchUsers = async (q: string) => {
    setUserQuery(q);
    if (q.trim().length < 2) {
      setUsers([]);
      return;
    }
    try {
      const res = await axios.post("/user/search", { name: q.trim() });
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (error) {
      console.log("User search error:", error);
    }
  };

  const toggleUser = (user: User) => {
    const exists = selectedUsers.find(u => u._id === user._id);
    if (exists) {
      setSelectedUsers(prev => prev.filter(u => u._id !== user._id));
    } else {
      setSelectedUsers(prev => [...prev, user]);
    }
  };

  // 🔥 UPDATED LAUNCH LOGIC
  const handleLaunchSession = () => {
    console.log("1. Launch button pressed");

    if (!selectedStation) {
      console.log("Error: No station selected");
      return;
    }

    if (!socket.connected) {
      console.log("2. Socket NOT connected. ID:", socket.id);
      // Force a manual connect if it's dead
      socket.connect();
    }

    const roomId = `jam_${Date.now()}`;
    const jamData = {
      roomId,
      station: selectedStation,
      participants: selectedUsers,
      host: {
        _id: currentUser?._id,
        username: currentUser?.username,
        avatar: currentUser?.avatar
      }
    };

    console.log("3. Emitting invite-squad...");
    socket.emit("invite-squad", jamData);

    navigation.navigate("GroupJamPlayer", jamData);
  };

  return (
    <View className="flex-1 bg-black">
      <LinearGradient colors={['#ec489933', '#000']} className="absolute inset-0" />
      <SafeAreaView className="flex-1 px-6">

        {/* HEADER */}
        <View className="flex-row items-center justify-between mt-4">
          <Text className="text-white text-3xl font-black italic uppercase tracking-tighter">
            FYNC <Text className="text-pink-500">JAM</Text>
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} className="bg-white/10 p-2 rounded-full border border-white/10">
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* STEP 1: MUSIC SELECTION */}
        <View className="mt-6">
          <Text className="text-gray-400 font-bold uppercase text-[10px] tracking-[2px] mb-3">Step 1: Pick the Station</Text>

          <View className="flex-row items-center bg-white/5 rounded-xl px-4 py-2 border border-white/10 mb-4">
            <Ionicons name="search" size={16} color="#ec4899" />
            <TextInput
              value={musicSearchQuery}
              onChangeText={setMusicSearchQuery}
              onSubmitEditing={handleMusicSearch}
              placeholder="Search station or vibe..."
              placeholderTextColor="#555"
              className="flex-1 text-white ml-2 text-xs font-medium"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {['bollywood', 'lofi', 'study', 'punjabi', 'english'].map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => loadCategoryRadio(cat)}
                className={`px-4 py-2 rounded-full mr-2 border ${activeCategory === cat ? 'bg-pink-500 border-pink-500' : 'bg-white/5 border-white/10'}`}
              >
                <Text className={`text-[10px] font-bold uppercase ${activeCategory === cat ? 'text-white' : 'text-gray-400'}`}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ height: 110 }}>
            {loadingMusic ? (
              <ActivityIndicator color="#ec4899" className="mt-4" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {stations.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedStation(item)}
                    className={`mr-4 p-2 rounded-3xl border ${selectedStation?.id === item.id ? 'border-pink-500 bg-pink-500/20' : 'border-white/10 bg-white/5'}`}
                  >
                    <Image
                      source={item.artwork ? { uri: item.artwork } : FYNC_LOGO}
                      className="w-14 h-14 rounded-2xl mb-2"
                    />
                    <Text className="text-white text-[8px] font-bold w-14 text-center" numberOfLines={1}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* STEP 2: INVITE SQUAD */}
        <View className="flex-1 mt-6">
          <Text className="text-gray-400 font-bold uppercase text-[10px] tracking-[2px] mb-3">Step 2: Invite Squad ({selectedUsers.length})</Text>

          {selectedUsers.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-grow-0 mb-4 py-2">
              {selectedUsers.map(u => (
                <View key={u._id} className="mr-3 relative">
                  <Image source={{ uri: u.avatar || `https://ui-avatars.com/api/?name=${u.username}` }} className="w-10 h-10 rounded-full border border-pink-500" />
                  <TouchableOpacity
                    onPress={() => toggleUser(u)}
                    className="absolute -top-1 -right-1 bg-pink-600 rounded-full"
                  >
                    <Ionicons name="close-circle" size={14} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <View className="bg-white/5 rounded-2xl flex-row items-center px-4 py-4 border border-white/10 mb-4">
            <Ionicons name="people-outline" size={20} color="#ec4899" />
            <TextInput
              className="flex-1 ml-3 text-white font-medium"
              placeholder="Search friends by name..."
              placeholderTextColor="#555"
              value={userQuery}
              onChangeText={searchUsers}
            />
          </View>

          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => toggleUser(item)}
                className={`flex-row items-center p-4 mb-3 rounded-2xl border ${selectedUsers.find(u => u._id === item._id) ? 'border-pink-500 bg-pink-500/10' : 'border-white/5 bg-white/5'}`}
              >
                <Image source={{ uri: item?.avatar || `https://ui-avatars.com/api/?name=${item.username}` }} className="w-12 h-12 rounded-full mr-4" />
                <View className="flex-1">
                  <Text className="text-white font-bold">{item?.username}</Text>
                  <Text className="text-gray-500 text-[10px] uppercase tracking-tighter">{item?.name}</Text>
                </View>
                <Ionicons
                  name={selectedUsers.find(u => u._id === item._id) ? "checkmark-circle" : "add-circle-outline"}
                  size={24}
                  color={selectedUsers.find(u => u._id === item._id) ? "#ec4899" : "#333"}
                />
              </TouchableOpacity>
            )}
            ListFooterComponent={<View className="h-32" />}
          />
        </View>

        {/* LAUNCH BUTTON */}
        {selectedStation && selectedUsers.length > 0 && (
          <TouchableOpacity
            onPress={handleLaunchSession}
            className="absolute bottom-10 left-6 right-6"
          >
            <LinearGradient
              colors={['#ec4899', '#7e22ce']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              className="py-4 rounded-2xl items-center shadow-2xl shadow-pink-500/50"
            >
              <Text className="text-white font-black uppercase tracking-[2px]">Launch Session 🚀</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}