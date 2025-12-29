import { View, Text, Image, TouchableOpacity, ScrollView, Dimensions, FlatList, ActivityIndicator, Modal } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "../context/axiosConfig";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from "jwt-decode";
import { BlurView } from 'expo-blur'; // Import BlurView

// --- Types ---
interface User {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
  followers: string[];
  following: string[];
}

interface Post {
  _id: string;
  image: string[];
  description: string;
}

interface Short {
  _id: string;
  video: string;
  title: string;
  description?: string; // Added description optional
}

type RootStackParamList = {
  PublicProfile: { user: User };
  FollowersAndFollowing: { userId: string; type: string };
};

const { width, height } = Dimensions.get('window');

const PublicProfile = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'PublicProfile'>>();
  const navigation = useNavigation();
  
  const initialUser = route.params.user;

  // --- State ---
  const [profileUser, setProfileUser] = useState<User>(initialUser);
  const [posts, setPosts] = useState<Post[]>([]);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'shorts'>('posts');
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string>("");
  const [isFollowing, setIsFollowing] = useState(false);

  // --- Modal State ---
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!myId || !profileUser) return;

    setIsFollowing(profileUser.followers.includes(myId));
  }, [myId, profileUser]);

  useFocusEffect(
    useCallback(() => {
      fetchFullProfile();
      fetchUserPosts();
      fetchUserShorts();
      checkIfMe();
    }, [initialUser._id])
  );

  const checkIfMe = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;

    const decoded: any = jwtDecode(token);
    setMyId(decoded.id);
  };

  const fetchFullProfile = async () => {
    try {
      const res = await axios.get(`/user/profile/${initialUser._id}`);
      if (res.data.success) {
        setProfileUser(res.data.user);
      }
    } catch (error) {
      console.log("Error fetching profile:", error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const res = await axios.get(`/post/feed/${initialUser._id}`);
      if (res.data.success) {
        setPosts(res.data.posts);
      }
    } catch (error) {
      console.log("Error fetching posts:", error);
    }
  };

  const fetchUserShorts = async () => {
    try {
      const res = await axios.get(`/shorts/feed/${initialUser._id}`);
      if (res.data.success) {
        setShorts(res.data.shorts);
      }
    } catch (error) {
      console.log("Error fetching shorts:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    try {
        if (isFollowing) {
            await axios.post(`/user/unfollow/${profileUser._id}`);
            setIsFollowing(false);
            setProfileUser(prev => ({
              ...prev,
              followers: prev.followers.filter(id => id !== myId)
            }));
        } else {
            await axios.post(`/user/follow/${profileUser._id}`);
            setIsFollowing(true);
            setProfileUser(prev => ({
              ...prev,
              followers: prev.followers.includes(myId)
                ? prev.followers
                : [...prev.followers, myId]
            }));
        }
    } catch (error: any) {
        console.log("Follow error", error.message);
        alert("Something went wrong");
    }
  };

  // --- Open Modal Function ---
  const openItem = (item: any) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const closeItem = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };

  const startChat = async () => {
    try {
      const res = await axios.post("/chat/start", {
        userId: profileUser._id,
      });

      navigation.navigate("Chat", {
        conversationId: res.data.conversation._id,
      });
    } catch (err) {
      console.log("Start chat error", err);
    }
  };

  const renderGridItem = ({ item, index }: { item: any, index: number }) => {
    const isVideo = activeTab === 'shorts';
    return (
      <TouchableOpacity 
        style={{ width: width / 3, height: width / 3, padding: 1 }}
        onPress={() => openItem(item)} // Changed to open Modal
      >
        {isVideo ? (
            <View className="flex-1 bg-gray-800 justify-center items-center">
                <Ionicons name="play" size={24} color="white" />
            </View>
        ) : (
            <Image 
                source={{ uri: item.image[0] }} 
                className="flex-1 bg-gray-200"
                resizeMode="cover"
            />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-2 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-black">{profileUser.username}</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-3 flex-row items-center">
          <Image 
            source={{ uri: profileUser.avatar || `https://ui-avatars.com/api/?name=${profileUser.username}&background=random&color=fff` }}
            className="w-20 h-20 rounded-full bg-gray-200"
          />
          
          <View className="flex-1 ml-6 flex-row justify-around">
            {/* POSTS */}
            <View className="items-center">
              <Text className="text-lg font-bold text-black">{posts.length}</Text>
              <Text className="text-sm text-gray-500">Posts</Text>
            </View>

            {/* FOLLOWERS */}
            <TouchableOpacity
              className="items-center"
              onPress={() =>
                navigation.navigate("FollowersAndFollowing", {
                  userId: profileUser._id,
                  type: "followers",
                })
              }
            >
              <Text className="text-lg font-bold text-black">
                {profileUser.followers?.length || 0}
              </Text>
              <Text className="text-sm text-gray-500">Followers</Text>
            </TouchableOpacity>

            {/* FOLLOWING */}
            <TouchableOpacity
              className="items-center"
              onPress={() =>
                navigation.navigate("FollowersAndFollowing", {
                  userId: profileUser._id,
                  type: "following",
                })
              }
            >
              <Text className="text-lg font-bold text-black">
                {profileUser.following?.length || 0}
              </Text>
              <Text className="text-sm text-gray-500">Following</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-4 pb-4">
          <Text className="font-semibold text-black text-base">{profileUser.name}</Text>
          <Text className="text-gray-600 mt-1">
            {(profileUser as any).about || "No bio yet."}
          </Text>
        </View>

        {myId !== profileUser._id && (
            <View className="px-4 flex-row gap-5 mb-4">
                <TouchableOpacity 
                    onPress={handleFollowToggle}
                    className={`flex-1 py-2 rounded-lg items-center ${isFollowing ? 'bg-gray-200' : 'bg-blue-500'}`}
                >
                    <Text className={`font-semibold ${isFollowing ? 'text-black' : 'text-white'}`}>
                        {isFollowing ? "Following" : "Follow"}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-gray-100 py-2 rounded-lg items-center" onPress={startChat}>
                    <Text className="text-black font-semibold">Message</Text>
                </TouchableOpacity>
            </View>
        )}

        <View className="flex-row border-t border-gray-200">
            <TouchableOpacity 
                onPress={() => setActiveTab('posts')}
                className={`flex-1 items-center py-3 ${activeTab === 'posts' ? 'border-b-2 border-black' : ''}`}
            >
                <Ionicons name="grid-outline" size={24} color={activeTab === 'posts' ? 'black' : 'gray'} />
            </TouchableOpacity>
            <TouchableOpacity 
                onPress={() => setActiveTab('shorts')}
                className={`flex-1 items-center py-3 ${activeTab === 'shorts' ? 'border-b-2 border-black' : ''}`}
            >
                <Ionicons name="videocam-outline" size={26} color={activeTab === 'shorts' ? 'black' : 'gray'} />
            </TouchableOpacity>
        </View>

        {loading ? (
            <View className="mt-10">
                <ActivityIndicator size="large" color="#000" />
            </View>
        ) : (
            <View className="flex-1 min-h-[300px]">
                {activeTab === 'posts' ? (
                    posts.length > 0 ? (
                        <View className="flex-row flex-wrap">
                            {posts.map((item, index) => (
                                <View key={item._id}>
                                    {renderGridItem({ item, index })}
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View className="items-center mt-10">
                            <Text className="text-gray-500">No posts yet</Text>
                        </View>
                    )
                ) : (
                    shorts.length > 0 ? (
                        <View className="flex-row flex-wrap">
                             {shorts.map((item, index) => (
                                <View key={item._id}>
                                    {renderGridItem({ item, index })}
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View className="items-center mt-10">
                             <Text className="text-gray-500">No shorts yet</Text>
                        </View>
                    )
                )}
            </View>
        )}
      </ScrollView>

      {/* --- Detail Modal with Blur --- */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeItem}
      >
        <BlurView 
            intensity={90} 
            tint="dark" 
            className="flex-1 justify-center items-center px-4"
        >
            {/* Close Button Area (Click background to close) */}
            <TouchableOpacity 
                style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}} 
                onPress={closeItem} 
            />

            {/* Modal Content */}
            {selectedItem && (
                <View className="w-full bg-white rounded-2xl overflow-hidden shadow-lg">
                    {/* Media Header */}
                    <View className="bg-black w-full h-80 justify-center items-center">
                        {activeTab === 'shorts' ? (
                            <View className="items-center justify-center">
                                <Ionicons name="play-circle-outline" size={64} color="white" />
                                <Text className="text-gray-400 mt-2">Short Video Preview</Text>
                            </View>
                        ) : (
                             <Image 
                                source={{ uri: selectedItem.image ? selectedItem.image[0] : '' }}
                                className="w-full h-full"
                                resizeMode="cover"
                            />
                        )}
                        
                        {/* Close Button inside card */}
                        <TouchableOpacity 
                            onPress={closeItem}
                            className="absolute top-3 right-3 bg-black/50 p-1 rounded-full"
                        >
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Details Body */}
                    <View className="p-5">
                        {/* Show Title ONLY if it is a Short */}
                        {activeTab === 'shorts' && (
                            <Text className="text-xl font-bold text-black mb-2">
                                {selectedItem.title}
                            </Text>
                        )}
                        
                        {/* Description */}
                        <ScrollView style={{ maxHeight: 150 }}>
                            <Text className="text-base text-gray-700 leading-6">
                                {selectedItem.description || "No description provided."}
                            </Text>
                        </ScrollView>

                        {/* Date/Footer Info */}
                        <View className="mt-4 pt-4 border-t border-gray-100 flex-row justify-between">
                            <Text className="text-gray-400 text-xs">
                                {activeTab === 'shorts' ? 'Short' : 'Post'} Details
                            </Text>
                        </View>
                    </View>
                </View>
            )}
        </BlurView>
      </Modal>

    </SafeAreaView>
  );
};

export default PublicProfile;