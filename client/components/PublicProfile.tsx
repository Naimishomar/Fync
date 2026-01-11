import { View, Text, Image, Pressable, ScrollView, Dimensions, FlatList, ActivityIndicator, Modal, Linking } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "@expo/vector-icons/Ionicons";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from "../context/axiosConfig";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from "jwt-decode";
import { BlurView } from 'expo-blur'; 

const { width } = Dimensions.get('window');

interface User {
  _id: string;
  username: string;
  name: string;
  avatar?: string;
  followers: string[];
  following: string[];
  about?: string;
  experience?: string;
  skills?: string[];
  hobbies?: string;
  interest?: string;
  github_id?: string;
  linkedIn_id?: string;
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
  description?: string;
}

type RootStackParamList = {
  PublicProfile: { user: User };
  FollowersAndFollowing: { userId: string; type: string };
};

const PublicProfile = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'PublicProfile'>>();
  const navigation = useNavigation<any>();
  
  const initialUser = route.params?.user;

  const [profileUser, setProfileUser] = useState<User | null>(initialUser || null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'tags'>('posts');
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string>("");
  const [isFollowing, setIsFollowing] = useState(false);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!myId || !profileUser) return;
    setIsFollowing(profileUser.followers?.includes(myId) || false);
  }, [myId, profileUser]);

  useFocusEffect(
    useCallback(() => {
      if (initialUser?._id) {
        fetchFullProfile();
        fetchUserPosts();
        fetchUserShorts();
        checkIfMe();
      }
    }, [initialUser?._id])
  );

  const checkIfMe = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    const decoded: any = jwtDecode(token);
    setMyId(decoded.id);
  };

  const fetchFullProfile = async () => {
    if (!initialUser?._id) return;
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
    if (!initialUser?._id) return;
    try {
      const res = await axios.get(`/post/feed/${initialUser._id}`);
      if (res.data.success) {
        setPosts(res.data.posts || []);
      }
    } catch (error) {
      console.log("Error fetching posts:", error);
    }
  };

  // --- 1. FETCH SHORTS FOR USER ---
  const fetchUserShorts = async () => {
    if (!initialUser?._id) return;
    try {
      // Using the endpoint provided: router.get("/feed/:userId", authMiddleware, getShortsByUserId);
      const res = await axios.get(`/shorts/feed/${initialUser._id}`);
      if (res.data.success) {
        setShorts(res.data.shorts || []);
      }
    } catch (error) {
      console.log("Error fetching shorts:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!profileUser?._id) return;
    try {
        if (isFollowing) {
            await axios.post(`/user/unfollow/${profileUser._id}`);
            setIsFollowing(false);
            setProfileUser(prev => prev ? ({
              ...prev,
              followers: prev.followers.filter(id => id !== myId)
            }) : null);
        } else {
            await axios.post(`/user/follow/${profileUser._id}`);
            setIsFollowing(true);
            setProfileUser(prev => prev ? ({
              ...prev,
              followers: [...prev.followers, myId]
            }) : null);
        }
    } catch (error: any) {
        console.log("Follow error", error.message);
        alert("Something went wrong");
    }
  };

  const openItem = (item: any) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const closeItem = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };

  const startChat = async () => {
    if (!profileUser?._id) return;
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

  // --- 2. GRID RENDERER FOR BOTH POSTS & SHORTS ---
  const renderGridItem = ({ item, index }: { item: any, index: number }) => {
    const isVideo = activeTab === 'shorts';
    return (
      <Pressable 
        style={{ width: width / 3, height: isVideo ? width / 3 * 1.5 : width / 3, padding: 1 }} // Taller aspect ratio for shorts
        onPress={() => openItem(item)}
        className="relative bg-gray-200"
      >
        {isVideo ? (
            // For shorts, try to show thumbnail if available, else show play icon placeholder
            <View className="flex-1 bg-black justify-center items-center overflow-hidden">
                {/* <Image source={{ uri: item.thumbnail }} className="w-full h-full absolute" resizeMode="cover" /> */}
                <Ionicons name="play-outline" size={32} color="white" />
                <Text className="text-white text-xs font-bold absolute bottom-2 left-2 truncate w-[90%]">
                    {item.title}
                </Text>
            </View>
        ) : (
            <Image 
                source={{ uri: item.image?.[0] }} 
                className="flex-1"
                resizeMode="cover"
            />
        )}
      </Pressable>
    );
  };

  const AboutSection = () => (
    <View className="px-4 py-6 bg-white pb-20">
        {/* About */}
        {profileUser?.about ? (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">About</Text>
                <Text className="text-gray-800 text-base leading-relaxed">{profileUser.about}</Text>
            </View>
        ) : null}

        {/* Experience */}
        {profileUser?.experience ? (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">Experience</Text>
                <View className="flex-row items-start bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <View className="bg-white p-2 rounded-lg mr-3 border border-gray-100">
                        <Ionicons name="briefcase" size={20} color="#f9a8d4" />
                    </View>
                    <Text className="text-gray-800 text-base flex-1 mt-1">{profileUser.experience}</Text>
                </View>
            </View>
        ) : null}

        {/* Skills */}
        {profileUser?.skills && profileUser.skills.length > 0 ? (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">Skills</Text>
                <View className="flex-row flex-wrap gap-2">
                    {profileUser.skills.map((skill: string, index: number) => (
                        <View key={index} className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                            <Text className="text-blue-600 font-medium text-sm">{skill}</Text>
                        </View>
                    ))}
                </View>
            </View>
        ) : null}

        {/* Hobbies & Interests */}
        {(profileUser?.hobbies || profileUser?.interest) ? (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">Interests & Hobbies</Text>
                <View className="flex-row flex-wrap gap-2">
                    {profileUser?.interest && (
                        <View className="bg-pink-50 px-3 py-1.5 rounded-lg border border-pink-200">
                            <Text className="text-pink-600 font-medium text-sm">Interest: {profileUser.interest}</Text>
                        </View>
                    )}
                    {profileUser?.hobbies && (
                        <View className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                            <Text className="text-green-600 font-medium text-sm">Hobby: {profileUser.hobbies}</Text>
                        </View>
                    )}
                </View>
            </View>
        ) : null}

        {/* Social Links */}
        {(profileUser?.github_id || profileUser?.linkedIn_id) ? (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">Socials</Text>
                <View className="gap-3">
                    {profileUser?.github_id ? (
                        <Pressable 
                            onPress={() => Linking.openURL(profileUser.github_id!)}
                            className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
                        >
                            <Ionicons name="logo-github" size={22} color="black" />
                            <Text className="text-black ml-3 font-medium">GitHub Profile</Text>
                            <Ionicons name="open-outline" size={16} color="gray" style={{marginLeft: 'auto'}} />
                        </Pressable>
                    ) : null}
                    {profileUser?.linkedIn_id ? (
                        <Pressable 
                            onPress={() => Linking.openURL(profileUser.linkedIn_id!)}
                            className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
                        >
                            <Ionicons name="logo-linkedin" size={22} color="#0077b5" />
                            <Text className="text-black ml-3 font-medium">LinkedIn Profile</Text>
                            <Ionicons name="open-outline" size={16} color="gray" style={{marginLeft: 'auto'}} />
                        </Pressable>
                    ) : null}
                </View>
            </View>
        ) : null}

        {/* Empty State */}
        {(!profileUser?.about && !profileUser?.experience && !profileUser?.skills?.length && !profileUser?.github_id) && (
            <View className="items-center justify-center py-10 opacity-50">
                <MaterialCommunityIcons name="text-box-outline" size={48} color="gray" />
                <Text className="text-gray-400 mt-2">This user has not added details yet.</Text>
            </View>
        )}
    </View>
  );

  if (loading || !profileUser) {
      return (
          <SafeAreaView className="flex-1 bg-white justify-center items-center">
              <ActivityIndicator size="large" color="#000" />
          </SafeAreaView>
      );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-2 border-b border-gray-100">
        <Pressable onPress={() => navigation.goBack()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="black" />
        </Pressable>
        <Text className="text-xl font-bold text-black">{profileUser.username}</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-3 flex-row items-center">
          <Image 
            source={{ uri: profileUser.avatar || `https://ui-avatars.com/api/?name=${profileUser.username}&background=random&color=fff` }}
            className="w-20 h-20 rounded-full bg-gray-200"
          />
          
          <View className="flex-1 ml-6 flex-row justify-around">
            <View className="items-center">
              <Text className="text-lg font-bold text-black">{posts.length}</Text>
              <Text className="text-sm text-gray-500">Posts</Text>
            </View>

            <Pressable
              className="items-center"
              onPress={() => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "followers" })}
            >
              <Text className="text-lg font-bold text-black">{profileUser.followers?.length || 0}</Text>
              <Text className="text-sm text-gray-500">Followers</Text>
            </Pressable>

            <Pressable
              className="items-center"
              onPress={() => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "following" })}
            >
              <Text className="text-lg font-bold text-black">{profileUser.following?.length || 0}</Text>
              <Text className="text-sm text-gray-500">Following</Text>
            </Pressable>
          </View>
        </View>

        <View className="px-4 pb-4">
          <Text className="font-semibold text-black text-base">{profileUser.name}</Text>
          <Text className="text-gray-600 mt-1">{profileUser.about || "No bio yet."}</Text>
        </View>

        {myId !== profileUser._id && (
            <View className="px-4 flex-row gap-5 mb-4">
                <Pressable 
                    onPress={handleFollowToggle}
                    className={`flex-1 py-2 rounded-lg items-center ${isFollowing ? 'bg-gray-200' : 'bg-blue-500'}`}
                >
                    <Text className={`font-semibold ${isFollowing ? 'text-black' : 'text-white'}`}>
                        {isFollowing ? "Following" : "Follow"}
                    </Text>
                </Pressable>
                <Pressable className="flex-1 bg-gray-100 py-2 rounded-lg items-center" onPress={startChat}>
                    <Text className="text-black font-semibold">Message</Text>
                </Pressable>
            </View>
        )}

        <View className="flex-row border-t border-gray-200">
            <Pressable 
                onPress={() => setActiveTab('posts')}
                className={`flex-1 items-center py-3 ${activeTab === 'posts' ? 'border-b-2 border-black' : ''}`}
            >
                <Ionicons name="grid-outline" size={24} color={activeTab === 'posts' ? 'black' : 'gray'} />
            </Pressable>
            <Pressable 
                onPress={() => setActiveTab('shorts')}
                className={`flex-1 items-center py-3 ${activeTab === 'shorts' ? 'border-b-2 border-black' : ''}`}
            >
                <Ionicons name="videocam-outline" size={26} color={activeTab === 'shorts' ? 'black' : 'gray'} />
            </Pressable>
            <Pressable 
                onPress={() => setActiveTab('tags')} 
                className={`flex-1 items-center py-3 ${activeTab === 'tags' ? 'border-b-2 border-black' : ''}`}
            >
                <MaterialCommunityIcons name="account-box-outline" size={28} color={activeTab === 'tags' ? "black" : "gray"} />
            </Pressable>
        </View>

        <View className="flex-1 min-h-[300px]">
            {/* 3. SWITCH RENDER BASED ON TAB */}
            {activeTab === 'tags' ? (
                <AboutSection />
            ) : activeTab === 'posts' ? (
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
      </ScrollView>

      {/* --- Detail Modal --- */}
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
            <Pressable 
                style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}} 
                onPress={closeItem} 
            />

            {selectedItem && (
                <View className="w-full bg-white rounded-2xl overflow-hidden shadow-lg">
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
                        <Pressable onPress={closeItem} className="absolute top-3 right-3 bg-black/50 p-1 rounded-full">
                            <Ionicons name="close" size={24} color="white" />
                        </Pressable>
                    </View>
                    <View className="p-5">
                        {activeTab === 'shorts' && (
                            <Text className="text-xl font-bold text-black mb-2">{selectedItem.title}</Text>
                        )}
                        <ScrollView style={{ maxHeight: 150 }}>
                            <Text className="text-base text-gray-700 leading-6">
                                {selectedItem.description || "No description provided."}
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            )}
        </BlurView>
      </Modal>

    </SafeAreaView>
  );
};

export default PublicProfile;