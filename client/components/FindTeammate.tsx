import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, Image, 
  ActivityIndicator, RefreshControl, Linking, Alert, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import axios from '../context/axiosConfig';
import socket from '../utils/socket';

const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

interface UserProfile {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  skills: string[];
  college: string;
  year: number;
  major: string;
  experience?: string;
  about?: string;
  github_id?: string;
  linkedIn_id?: string;
}

export default function FindTeammate() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'global' | 'college'>('global');
  const [developers, setDevelopers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const CURRENT_USER_ID = user?._id || user?.id;
  
  // 🔍 NEW: Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Track which specific user is being connected to (for the loading spinner)
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // --- 1. FETCH DEVELOPERS ---
  const fetchDevelopers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/user/find-team', {
        params: { type: activeTab }
      });

      if (response.data.success) {
        setDevelopers(response.data.developers);
      }
    } catch (error: any) {
      console.error("Fetch error:", error);
      const msg = error.response?.data?.message || "Check your internet connection.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDevelopers();
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDevelopers();
  };

  // --- 🔍 FILTER LOGIC (New) ---
  const filteredDevelopers = developers.filter((dev) => {
      const query = searchQuery.toLowerCase();
      return (
          dev.skills.some(skill => skill.toLowerCase().includes(query)) || 
          dev.name.toLowerCase().includes(query) ||                        
          dev.username.toLowerCase().includes(query)                       
      );
  });

  const handleMessage = async (targetUser: UserProfile) => {
    if (connectingId) return;

    try {
      setConnectingId(targetUser._id);

      const response = await axios.post("/chat/start", {
        userId: targetUser._id
      });

      const conversationId = response.data.conversation._id;

      socket.emit("join", { conversationId });

      navigation.navigate("Chat", {
        conversationId,
        otherUser: {
          _id: targetUser._id,
          name: targetUser.name,
          username: targetUser.username,
          avatar: targetUser.avatar
        }
      });
    } catch (error: any) {
      console.error("Connection Error:", error?.response?.data || error);
      Alert.alert("Error", error?.response?.data?.message || "Could not start chat");
    } finally {
      setConnectingId(null);
    }
  };

  const openLink = (url: string | undefined) => {
    if (url) Linking.openURL(url).catch(() => Alert.alert("Error", "Invalid Link"));
  };

  // --- 3. RENDER CARD ---
  const renderCard = ({ item }: { item: UserProfile }) => (
    <View className="bg-[#1e1e1e]/80 rounded-3xl p-5 mb-5 border border-white/10 shadow-lg">
      
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <Image 
          source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.name}` }} 
          className="w-14 h-14 rounded-full border-2 border-indigo-500"
        />
        <View className="ml-3 flex-1">
          <Text className="text-white text-lg font-bold">{item.name}</Text>
          <Text className="text-gray-400 text-xs font-medium">@{item.username}</Text>
          <View className="flex-row items-center mt-1">
             <MaterialCommunityIcons name="school" size={12} color="#9ca3af" />
             <Text className="text-gray-400 text-[10px] ml-1">
                {item.year}th Year • {item.major}
             </Text>
          </View>
        </View>
        
        {/* Social Icons */}
        <View className="flex-row space-x-3">
            {item.github_id && (
                <TouchableOpacity onPress={() => openLink(item.github_id)}>
                    <FontAwesome name="github" size={20} color="white" />
                </TouchableOpacity>
            )}
            {item.linkedIn_id && (
                <TouchableOpacity onPress={() => openLink(item.linkedIn_id)}>
                    <FontAwesome name="linkedin-square" size={20} color="#0077b5" />
                </TouchableOpacity>
            )}
        </View>
      </View>

      {/* Skills */}
      <View className="flex-row flex-wrap gap-2 mb-4">
        {item.skills?.slice(0, 5).map((skill, index) => (
          <View key={index} className="bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
            <Text className="text-indigo-300 text-[10px] font-bold uppercase">{skill}</Text>
          </View>
        ))}
        {item.skills?.length > 5 && (
             <Text className="text-gray-500 text-xs mt-1">+{item.skills.length - 5} more</Text>
        )}
      </View>

      {/* Bio */}
      {(item.about || item.experience) && (
          <View className="bg-black/30 p-3 rounded-xl mb-4 border border-white/5">
              <Text className="text-gray-300 text-sm leading-5" numberOfLines={3}>
                  {item.about || item.experience || "No bio available."}
              </Text>
          </View>
      )}

      {/* Footer */}
      <View className="flex-row justify-between items-center mt-2">
          <View className="flex-row items-center flex-1 mr-4">
              <Ionicons name="location-outline" size={14} color="#6b7280" />
              <Text className="text-gray-500 text-xs ml-1 flex-1" numberOfLines={1}>
                  {item.college}
              </Text>
          </View>

          <TouchableOpacity onPress={() => handleMessage(item)} disabled={connectingId !== null} className='rounded-2xl'>
              <LinearGradient
                  colors={['#6366f1', '#a855f7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="px-6 py-2 rounded-2xl flex-row items-center shadow-md shadow-indigo-500/30"
              >
                  {connectingId === item._id ? (
                      <ActivityIndicator size="small" color="white" />
                  ) : (
                      <>
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color="white" />
                        <Text className="text-white font-bold ml-2 text-sm">Connect</Text>
                      </>
                  )}
              </LinearGradient>
          </TouchableOpacity>
      </View>

    </View>
  );

  // --- RENDER MAIN ---
  return (
    <View className="flex-1 bg-black">
      {/* 🌸 BACKGROUND GRADIENT & IMAGE 🌸 */}
      <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-50" />
      <LinearGradient 
        colors={['rgba(236, 72, 153, 0.40)', 'rgba(0,0,0,0.85)', '#000000']} 
        className="absolute w-full h-full" 
      />

      <SafeAreaView className="flex-1 px-4">
        
        {/* HEADER */}
        <View className="px-5 pt-2 pb-2">
            <Text className="text-white text-3xl font-black shadow-lg">Find Partner 🚀</Text>
            <Text className="text-gray-300 text-sm mt-1 font-medium">
                Build your dream team for the next Hackathon.
            </Text>
        </View>

        {/* 🔍 SEARCH BAR (Added) */}
        <View className="mx-5 mt-4 mb-4">
            <View className="flex-row items-center rounded-2xl px-4 border border-white/10 shadow-md">
                <Ionicons name="search" size={20} color="#9ca3af" />
                <TextInput 
                    placeholder="Search by skill (e.g. React, Node)..."
                    placeholderTextColor="#6b7280"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 ml-3 text-white text-base font-medium bg-transparent"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <Ionicons name="close-circle" size={20} color="#6b7280" />
                    </TouchableOpacity>
                )}
            </View>
        </View>

        {/* TABS */}
        <View className="flex-row mb-4 bg-[#1a1a1a]/80 p-1 rounded-2xl border border-white/10">
            <TouchableOpacity 
                className={`flex-1 py-2 rounded-xl items-center justify-center ${activeTab === 'global' ? 'bg-[#333]' : 'bg-transparent'}`}
                onPress={() => setActiveTab('global')}
            >
                <Text className={`font-bold ${activeTab === 'global' ? 'text-white' : 'text-gray-500'}`}>
                    🌍 Global
                </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                className={`flex-1 py-2 rounded-xl items-center justify-center ${activeTab === 'college' ? 'bg-[#333]' : 'bg-transparent'}`}
                onPress={() => setActiveTab('college')}
            >
                <Text className={`font-bold ${activeTab === 'college' ? 'text-white' : 'text-gray-500'}`}>
                    🎓 My College
                </Text>
            </TouchableOpacity>
        </View>

        {/* LIST (Uses filteredDevelopers now) */}
        {loading ? (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#ec4899" />
            </View>
        ) : (
            <FlatList
                data={filteredDevelopers}
                keyExtractor={(item) => item._id}
                renderItem={renderCard}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                }
                ListEmptyComponent={
                    <View className="items-center mt-20">
                        <MaterialCommunityIcons name="account-search" size={60} color="#333" />
                        <Text className="text-gray-500 mt-4 text-center px-10">
                            {searchQuery ? "No developers found matching your search." : "No developers found yet. Be the first!"}
                        </Text>
                    </View>
                }
            />
        )}

      </SafeAreaView>
    </View>
  );
}