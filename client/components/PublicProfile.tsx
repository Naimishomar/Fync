import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, Image, Pressable, ScrollView, Dimensions, 
  ActivityIndicator, Modal, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient'; 
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur'; 
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import axios from "../context/axiosConfig";
import { useAuth } from '../context/auth.context';

const { width } = Dimensions.get('window');

// --- TYPES ---
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
  codingProfiles?: {
    leetcode?: string;
    gfg?: string;
  };
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
  Profile: undefined;
};

const PublicProfile = () => {
  const { user: currentUser } = useAuth(); 
  const route = useRoute<RouteProp<RootStackParamList, 'PublicProfile'>>();
  const navigation = useNavigation<any>();
  
  const initialUser = route.params?.user;

  const [profileUser, setProfileUser] = useState<User | null>(initialUser || null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'tags'>('posts');
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // --- 1. REDIRECT IF OWN PROFILE ---
useEffect(() => {
    if (currentUser?._id && profileUser?._id) {
        if (currentUser._id === profileUser._id) {
            navigation.replace("Profile"); 
        }
    }
  }, [currentUser, profileUser]);

  // --- 2. CHECK FOLLOW STATUS ---
  useEffect(() => {
    if (!currentUser?._id || !profileUser) return;
    setIsFollowing(profileUser.followers?.includes(currentUser._id) || false);
  }, [currentUser, profileUser]);

  useFocusEffect(
    useCallback(() => {
      if (initialUser?._id) {
        fetchFullProfile();
        fetchUserPosts();
        fetchUserShorts();
      }
    }, [initialUser?._id])
  );

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

  const fetchUserShorts = async () => {
    if (!initialUser?._id) return;
    try {
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
    if (!profileUser?._id || !currentUser?._id) return;
    try {
        if (isFollowing) {
            await axios.post(`/user/unfollow/${profileUser._id}`);
            setIsFollowing(false);
            setProfileUser(prev => prev ? ({
              ...prev,
              followers: prev.followers.filter(id => id !== currentUser._id)
            }) : null);
        } else {
            await axios.post(`/user/follow/${profileUser._id}`);
            setIsFollowing(true);
            setProfileUser(prev => prev ? ({
              ...prev,
              followers: [...prev.followers, currentUser._id]
            }) : null);
        }
    } catch (error: any) {
        console.log("Follow error", error.message);
    }
  };

  const startChat = async () => {
    if (!profileUser?._id) return;
    try {
      const res = await axios.post("/chat/start", { userId: profileUser._id });
      navigation.navigate("Chat", { conversationId: res.data.conversation._id });
    } catch (err) {
      console.log("Start chat error", err);
    }
  };

  const openItem = (item: any) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  // --- GRID RENDERER ---
  const renderGridItem = ({ item }: { item: any, index: number }) => {
    const isVideo = activeTab === 'shorts';
    return (
      <Pressable 
        style={{ width: width / 3, height: isVideo ? width / 3 * 1.5 : width / 3, padding: 1 }}
        onPress={() => openItem(item)}
        className="relative border border-black/50"
      >
        {isVideo ? (
            <View className="flex-1 bg-gray-900 justify-center items-center overflow-hidden">
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute bottom-0 w-full h-1/2 z-10" />
                <Ionicons name="play-outline" size={32} color="white" style={{ opacity: 0.8 }} />
                <Text className="text-white text-xs font-bold absolute bottom-2 left-2 truncate w-[90%] z-20 shadow-sm">
                    {item.title}
                </Text>
            </View>
        ) : (
            <Image 
                source={{ uri: item.image?.[0] }} 
                className="flex-1 bg-gray-800"
                resizeMode="cover"
            />
        )}
      </Pressable>
    );
  };

  // --- ABOUT SECTION (Dark Mode) ---
  const AboutSection = () => (
    <View className="px-4 py-6 pb-32">
        {/* About Card */}
        <View className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-6 shadow-sm">
            <Text className="text-pink-500 text-xs font-bold uppercase mb-2 tracking-widest">About</Text>
            <Text className="text-gray-300 text-base leading-relaxed">
                {profileUser?.about || "This user prefers to stay mysterious."}
            </Text>
        </View>

        {/* Details Grid */}
        <View className="flex-row flex-wrap gap-4 mb-6">
            {profileUser?.experience && (
                <View className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 flex-row items-center">
                    <View className="bg-indigo-500/20 p-2 rounded-lg mr-3">
                        <Ionicons name="briefcase" size={20} color="#818cf8" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-indigo-400 text-xs font-bold uppercase tracking-wider">Experience</Text>
                        <Text className="text-gray-200 text-sm mt-0.5">{profileUser.experience}</Text>
                    </View>
                </View>
            )}
        </View>

        {/* Tags Collection */}
        {(profileUser?.skills?.length || profileUser?.hobbies || profileUser?.interest) && (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-3 tracking-wider ml-1">Tags & Interests</Text>
                <View className="flex-row flex-wrap gap-2">
                    {profileUser?.skills?.map((skill, i) => (
                        <View key={i} className="bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/30">
                            <Text className="text-blue-400 text-xs font-bold">{skill}</Text>
                        </View>
                    ))}
                    {profileUser?.interest && (
                        <View className="bg-pink-500/10 px-3 py-1.5 rounded-lg border border-pink-500/30">
                            <Text className="text-pink-400 text-xs font-bold">♥ {profileUser.interest}</Text>
                        </View>
                    )}
                    {profileUser?.hobbies && (
                        <View className="bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                            <Text className="text-emerald-400 text-xs font-bold">★ {profileUser.hobbies}</Text>
                        </View>
                    )}
                </View>
            </View>
        )}

        {/* Social Links */}
        <Text className="text-gray-500 text-xs font-bold uppercase mb-3 tracking-wider ml-1">Connect</Text>
        <View className="gap-3">
            {profileUser?.github_id && (
                <Pressable onPress={() => Linking.openURL(profileUser.github_id!)} className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                    <Ionicons name="logo-github" size={22} color="white" />
                    <Text className="text-gray-200 ml-3 font-medium">GitHub</Text>
                    <Ionicons name="open-outline" size={16} color="gray" style={{marginLeft: 'auto'}} />
                </Pressable>
            )}
            {profileUser?.linkedIn_id && (
                <Pressable onPress={() => Linking.openURL(profileUser.linkedIn_id!)} className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                    <Ionicons name="logo-linkedin" size={22} color="#0077b5" />
                    <Text className="text-gray-200 ml-3 font-medium">LinkedIn</Text>
                    <Ionicons name="open-outline" size={16} color="gray" style={{marginLeft: 'auto'}} />
                </Pressable>
            )}
            {profileUser?.codingProfiles?.leetcode && (
                <Pressable onPress={() => Linking.openURL(`https://leetcode.com/${profileUser.codingProfiles?.leetcode}`)} className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                    <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png" }} className="w-5 h-5" style={{ tintColor: '#facc15' }} />
                    <Text className="text-gray-200 ml-3 font-medium">LeetCode</Text>
                    <Ionicons name="open-outline" size={16} color="gray" style={{marginLeft: 'auto'}} />
                </Pressable>
            )}
            {profileUser?.codingProfiles?.gfg && (
                <Pressable onPress={() => Linking.openURL(`https://www.geeksforgeeks.org/user/${profileUser.codingProfiles?.gfg}`)} className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                    <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/4/43/GeeksforGeeks.svg" }} className="w-5 h-5" />
                    <Text className="text-gray-200 ml-3 font-medium">GeeksForGeeks</Text>
                    <Ionicons name="open-outline" size={16} color="gray" style={{marginLeft: 'auto'}} />
                </Pressable>
            )}
        </View>
    </View>
  );

  if (loading || !profileUser) {
      return (
          <View className="flex-1 bg-black justify-center items-center">
              <ActivityIndicator size="large" color="#ec4899" />
          </View>
      );
  }

  return (
    <View className="flex-1 bg-black">
      {/* 🔮 PURE BLACK BACKGROUND WITH PINKISH GLOW */}
      <LinearGradient 
        colors={['rgba(236, 72, 153, 0.40)', '#000000']} 
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        className="absolute w-full h-full" 
      />

      <SafeAreaView className="flex-1">
        
        {/* Header */}
        <View className="flex-row items-center px-4 py-2 z-10">
            <Pressable onPress={() => navigation.goBack()} className="bg-white/10 p-2 rounded-full border border-white/10">
                <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            <View className="ml-4">
                <Text className="text-white font-bold text-lg tracking-wide">{profileUser.username}</Text>
                <Text className="text-gray-400 text-xs font-medium">{profileUser.name}</Text>
            </View>
        </View>

        <ScrollView className="flex-1 mt-2" showsVerticalScrollIndicator={false}>
            
            {/* Top Profile Card */}
            <View className="mx-4 mt-2 mb-6 bg-white/5 rounded-3xl p-5 border border-white/10 shadow-lg">
                <View className="flex-row items-center">
                    <Image 
                        source={{ uri: profileUser.avatar || `https://ui-avatars.com/api/?name=${profileUser.username}` }}
                        className="w-20 h-20 rounded-full border-2 border-pink-500"
                    />
                    <View className="flex-1 ml-6 flex-row justify-between pr-4">
                        <View className="items-center">
                            <Text className="text-xl font-bold text-white">{posts.length}</Text>
                            <Text className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Posts</Text>
                        </View>
                        <Pressable onPress={() => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "followers" })} className="items-center">
                            <Text className="text-xl font-bold text-white">{profileUser.followers?.length || 0}</Text>
                            <Text className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Followers</Text>
                        </Pressable>
                        <Pressable onPress={() => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "following" })} className="items-center">
                            <Text className="text-xl font-bold text-white">{profileUser.following?.length || 0}</Text>
                            <Text className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Following</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Action Buttons */}
                {currentUser?._id !== profileUser._id && (
                    <View className="flex-row gap-3 mt-6">
                        <Pressable 
                            onPress={handleFollowToggle}
                            className={`flex-1 py-3 rounded-xl items-center justify-center border ${isFollowing ? 'bg-transparent border-gray-500' : 'bg-pink-600 border-pink-600'}`}
                        >
                            <Text className={`font-bold tracking-wide ${isFollowing ? 'text-gray-300' : 'text-white'}`}>
                                {isFollowing ? "Following" : "Follow"}
                            </Text>
                        </Pressable>
                        <Pressable 
                            onPress={startChat}
                            className="flex-1 bg-white/10 py-3 rounded-xl items-center justify-center border border-white/10"
                        >
                            <Text className="text-white font-bold tracking-wide">Message</Text>
                        </Pressable>
                    </View>
                )}
            </View>

            {/* Custom Tab Bar */}
            <View className="flex-row border-b border-white/10 mx-4 mb-2">
                <Pressable onPress={() => setActiveTab('posts')} className={`flex-1 items-center pb-3 ${activeTab === 'posts' ? 'border-b-2 border-pink-500' : ''}`}>
                    <Ionicons name="grid" size={22} color={activeTab === 'posts' ? '#ec4899' : '#666'} />
                </Pressable>
                <Pressable onPress={() => setActiveTab('shorts')} className={`flex-1 items-center pb-3 ${activeTab === 'shorts' ? 'border-b-2 border-pink-500' : ''}`}>
                    <Ionicons name="videocam" size={24} color={activeTab === 'shorts' ? '#ec4899' : '#666'} />
                </Pressable>
                <Pressable onPress={() => setActiveTab('tags')} className={`flex-1 items-center pb-3 ${activeTab === 'tags' ? 'border-b-2 border-pink-500' : ''}`}>
                    <MaterialCommunityIcons name="account-details" size={26} color={activeTab === 'tags' ? '#ec4899' : '#666'} />
                </Pressable>
            </View>

            {/* Content Area */}
            <View className="flex-1 min-h-[400px]">
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
                        <View className="items-center mt-20 opacity-50">
                            <Ionicons name="images-outline" size={48} color="white" />
                            <Text className="text-gray-400 mt-2">No posts yet</Text>
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
                        <View className="items-center mt-20 opacity-50">
                            <Ionicons name="videocam-off-outline" size={48} color="white" />
                            <Text className="text-gray-400 mt-2">No shorts yet</Text>
                        </View>
                    )
                )}
            </View>
        </ScrollView>

        {/* Dark Modal */}
        <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
            <BlurView intensity={90} tint="dark" className="flex-1 justify-center items-center px-4">
                <Pressable style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}} onPress={() => setModalVisible(false)} />
                
                {selectedItem && (
                    <View className="w-full bg-[#121212] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                        <View className="w-full h-96 bg-black justify-center items-center relative">
                            {activeTab === 'shorts' ? (
                                <View className="items-center">
                                    <Ionicons name="play-circle" size={64} color="#ec4899" />
                                    <Text className="text-gray-500 mt-2 text-xs">PREVIEW MODE</Text>
                                </View>
                            ) : (
                                <Image source={{ uri: selectedItem.image ? selectedItem.image[0] : '' }} className="w-full h-full" resizeMode="contain" />
                            )}
                            <Pressable onPress={() => setModalVisible(false)} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full">
                                <Ionicons name="close" size={20} color="white" />
                            </Pressable>
                        </View>
                        <View className="p-5">
                            {activeTab === 'shorts' && <Text className="text-xl font-bold text-white mb-2">{selectedItem.title}</Text>}
                            <Text className="text-gray-400 leading-6">{selectedItem.description || "No caption."}</Text>
                        </View>
                    </View>
                )}
            </BlurView>
        </Modal>

      </SafeAreaView>
    </View>
  );
};

export default PublicProfile;