import React, { useState, useEffect } from 'react';
import {
  Text,
  Image,
  View,
  Pressable,
  FlatList,
  Dimensions,
  RefreshControl,
  Linking,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import Avatar from './Avatar';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const COLUMN_SIZE = width / 3;

// ... (Types remain the same) ...
type UserType = {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  user_access?: 'admin' | 'user' | 'alumni';
  college?: string;
  interest?: string;
  bio?: string;
  about?: string;
  experience?: string;
  skills?: string[];
  hobbies?: string;
  github_id?: string;
  linkedIn_id?: string;
  banner?: string;
  upiId?: string;
  codingProfiles?: {
    leetcode?: string;
    gfg?: string;
  };
  followers?: any[];
  following?: any[];
};

type PostType = {
  _id: string;
  title: string;
  description: string;
  image: string[];
  createdAt: string;
  user: UserType;
};

type ShortType = {
  _id: string;
  title: string;
  video: string;
  thumbnail?: string;
  views: number;
};

function Profile() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();

  const [posts, setPosts] = useState<PostType[]>([]);
  const [shorts, setShorts] = useState<ShortType[]>([]);

  const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'about'>('posts');
  const [refreshing, setRefreshing] = useState(false);

  const [postsPage, setPostsPage] = useState(1);
  const [shortsPage, setShortsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreShorts, setHasMoreShorts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const getPosts = async (page = 1, isInitial = false) => {
    try {
      setIsLoadingMore(true);
      const res = await axios.get(`/post/posts?page=${page}&limit=12`);
      if (res.data.success) {
        setPosts(prev => {
          const newPosts = res.data.posts || [];
          if (isInitial) return newPosts;
          const existingIds = new Set(prev.map(p => p._id));
          const filteredNew = newPosts.filter((p: any) => !existingIds.has(p._id));
          return [...prev, ...filteredNew];
        });
        setHasMorePosts(res.data.hasMore);
        setPostsPage(page);
      }
    } catch (e) {
      console.log("Error fetching posts");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getShorts = async (page = 1, isInitial = false) => {
    try {
      setIsLoadingMore(true);
      const res = await axios.get(`/shorts/your?page=${page}&limit=12`);
      if (res.data.success) {
        setShorts(prev => {
          const newShorts = res.data.shorts || [];
          if (isInitial) return newShorts;
          const existingIds = new Set(prev.map(s => s._id));
          const filteredNew = newShorts.filter((s: any) => !existingIds.has(s._id));
          return [...prev, ...filteredNew];
        });
        setHasMoreShorts(res.data.hasMore === true);
        setShortsPage(page);
      } else {
        setHasMoreShorts(false);
      }
    } catch (e) {
      console.log("Error fetching shorts", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    getPosts(1, true);
    getShorts(1, true);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([getPosts(1, true), getShorts(1, true)]);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (isLoadingMore) return;
    if (activeTab === 'posts' && hasMorePosts) {
      getPosts(postsPage + 1);
    } else if (activeTab === 'shorts' && hasMoreShorts) {
      getShorts(shortsPage + 1);
    }
  };

  const deletePost = async (id: string) => {
    try {
      const res = await axios.delete(`/post/${id}`);
      if (res.data.success) {
        setPosts(prev => prev.filter(p => p._id !== id));
        Toast.show({ type: 'success', text1: 'Post deleted successfully' });
      }
    } catch (error) {
      console.log('Failed to delete post', error);
      Toast.show({ type: 'error', text1: 'Failed to delete post' });
    }
  };

  const deleteShort = async (id: string) => {
    try {
      const res = await axios.post(`/shorts/delete/${id}`);
      if (res.data.success) {
        setShorts(prev => prev.filter(s => s._id !== id));
        Toast.show({ type: 'success', text1: 'Short deleted successfully' });
      }
    } catch (error) {
      console.log("Delete failed", error);
      Toast.show({ type: 'error', text1: 'Failed to delete short' });
    }
  };

  const handleLogout = async () => {
    await logout();
    Toast.show({ type: 'success', text1: 'Logged out successfully!' });
  };

  const clearAppCache = async () => {
    try {
      if (FileSystem.cacheDirectory) {
        const cacheDirInfo = await FileSystem.getInfoAsync(FileSystem.cacheDirectory);
        if (cacheDirInfo.exists) {
          const content = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);

          let totalFreed = 0;
          for (const item of content) {
            const itemPath = `${FileSystem.cacheDirectory}${item}`;
            const itemInfo = await FileSystem.getInfoAsync(itemPath);
            if (itemInfo.exists && !itemInfo.isDirectory) {
              totalFreed += itemInfo.size || 0;
            }
            await FileSystem.deleteAsync(itemPath, { idempotent: true });
          }

          await ExpoImage.clearDiskCache();
          await ExpoImage.clearMemoryCache();

          const freedMB = (totalFreed / (1024 * 1024)).toFixed(2);

          Alert.alert(
            "Cache Cleared 🧹",
            `Successfully reclaimed ${freedMB} MB of storage space! The app should run smoother now.`
          );
        }
      }
    } catch (e) {
      console.log('Error clearing cache', e);
      Toast.show({ type: 'error', text1: 'Failed to clear cache' });
    }
  };

  // --- PROFILE INFO ---
  const renderProfileInfo = () => (
    <View className="bg-white">
      {/* Cover Photo */}
      <View className="h-64 w-full relative">
        <ExpoImage 
          source={{ uri: user?.banner || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1000&auto=format&fit=crop' }} 
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="disk"
        />
        {/* Dark overlay for top icons visibility */}
        <View className="absolute inset-0 bg-black/10" />
        
        {/* Top Icons */}
        <View className="absolute top-12 right-4 flex-row gap-5 bg-white p-2 rounded-full">
          <Pressable onPress={() => {
            Alert.alert("Logout", "Are you sure you want to logout?", [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", onPress: handleLogout, style: 'destructive' },
            ]);
          }}>
            <Ionicons name="log-out-outline" size={24} color="red" />
          </Pressable>
        </View>
      </View>

      {/* Profile Details Container */}
      <View className="items-center pb-4 px-4 bg-white rounded-t-[30px]">
        {/* Avatar with white ring - Half on cover, half on container */}
        <View className="-mt-[54px] p-1 bg-white rounded-full shadow-lg">
          <Avatar 
            user={user as any} 
            size={100} 
          />
        </View>

        {/* Name and Edit Icon */}
        <View className="flex-row items-center mt-3 gap-2">
          <Text className="text-2xl font-bold text-gray-900">{user?.name || user?.username}</Text>
          <Pressable onPress={() => navigation.navigate('EditProfile')} className='bg-blue-300 rounded-full p-1'>
            <Ionicons name="shield-checkmark-outline" size={15} color="#4b5563"/>
          </Pressable>
        </View>

        {/* Bio / Description */}
        <Text className="text-gray-400 text-center mt-1 px-10 text-xs leading-4">
          {user?.bio || user?.about || "I'm delighted to introduce myself as a fync member"} 💫
        </Text>

        <View className="flex-row items-center mt-1 px-3 py-1 bg-gray-100 rounded-full mt-2 gap-1">
          <Ionicons name="school-outline" size={15} color="#4b5563"/>
          <Text className="text-gray-400 text-sm font-semibold">{user?.college}</Text>
        </View>

        {/* Stats Row */}
        <View className="flex-row w-full justify-around mt-6 border-t border-b border-gray-50 py-4">
          <View className="items-center flex-1">
            <Text className="text-lg font-bold text-gray-900">{posts.length}</Text>
            <Text className="text-gray-400 text-[10px] uppercase tracking-tighter">Posts</Text>
          </View>
          <View className="w-[1px] h-6 self-center bg-gray-100" />
          <Pressable className="items-center flex-1" onPress={() => navigation.navigate('FollowersAndFollowing', { userId: user._id, type: 'followers' })}>
            <Text className="text-lg font-bold text-gray-900">{user?.followers?.length || 0}</Text>
            <Text className="text-gray-400 text-[10px] uppercase tracking-tighter">Followers</Text>
          </Pressable>
          <View className="w-[1px] h-6 self-center bg-gray-100" />
          <Pressable className="items-center flex-1" onPress={() => navigation.navigate('FollowersAndFollowing', { userId: user._id, type: 'following' })}>
            <Text className="text-lg font-bold text-gray-900">{user?.following?.length || 0}</Text>
            <Text className="text-gray-400 text-[10px] uppercase tracking-tighter">Followings</Text>
          </Pressable>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3 mt-6 w-full">
          <Pressable onPress={() => navigation.navigate('EditProfile')} className="flex-1 bg-white border border-gray-100 py-2.5 rounded-xl items-center shadow-sm">
            <Text className="text-gray-900 font-semibold">Edit Profile</Text>
          </Pressable>
          <Pressable onPress={logout} className="flex-1 bg-blue-50 border border-blue-100 py-2.5 rounded-xl items-center shadow-sm">
            <Text className="text-blue-500 font-semibold">Fync Resume</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // --- ABOUT SECTION (Light Mode) ---
  const AboutSection = () => (
    <View className="px-4 py-6 bg-white flex-1 min-h-[500px]">
        {/* About Card */}
        <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-6 shadow-sm">
            <Text className="text-pink-500 text-[10px] font-bold uppercase mb-2 tracking-widest">About You</Text>
            <Text className="text-gray-700 text-sm leading-relaxed">
                {user?.about || user?.experience || "You haven't shared your story yet. Add some details in Edit Profile!"}
            </Text>
        </View>

        {/* Details Grid */}
        <View className="gap-4 mb-6">
            {user?.experience && (
                <View className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-100 flex-row items-center">
                    <View className="bg-indigo-50 p-2 rounded-lg mr-3">
                        <Ionicons name="briefcase" size={20} color="#6366f1" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider">Experience</Text>
                        <Text className="text-gray-700 text-sm mt-0.5">{user.experience}</Text>
                    </View>
                </View>
            )}
        </View>

        {/* Tags Collection */}
        {(user?.skills?.length || user?.hobbies || user?.interest) && (
            <View className="mb-6">
                <Text className="text-gray-400 text-[10px] font-bold uppercase mb-3 tracking-wider ml-1">Tags & Interests</Text>
                <View className="flex-row flex-wrap gap-2">
                    {user?.skills?.map((skill: string, i: number) => (
                        <View key={i} className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                            <Text className="text-blue-600 text-xs font-bold">{skill}</Text>
                        </View>
                    ))}
                    {user?.interest && (
                        <View className="bg-pink-50 px-3 py-1.5 rounded-lg border border-pink-100">
                            <Text className="text-pink-600 text-xs font-bold">♥ {user.interest}</Text>
                        </View>
                    )}
                    {user?.hobbies && (
                        <View className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            <Text className="text-emerald-600 text-xs font-bold">★ {user.hobbies}</Text>
                        </View>
                    )}
                </View>
            </View>
        )}

        {/* Social Links */}
        <Text className="text-gray-400 text-[10px] font-bold uppercase mb-3 tracking-wider ml-1">Connect & Social</Text>
        <View className="gap-3">
            {user?.github_id && (
                <Pressable onPress={() => Linking.openURL(user.github_id!)} className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <Ionicons name="logo-github" size={22} color="#1F2937" />
                    <Text className="text-gray-700 ml-3 font-medium">GitHub</Text>
                    <Ionicons name="open-outline" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                </Pressable>
            )}
            {user?.linkedIn_id && (
                <Pressable onPress={() => Linking.openURL(user.linkedIn_id!)} className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <Ionicons name="logo-linkedin" size={22} color="#0077b5" />
                    <Text className="text-gray-700 ml-3 font-medium">LinkedIn</Text>
                    <Ionicons name="open-outline" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                </Pressable>
            )}
            {user?.codingProfiles?.leetcode && (
                <Pressable onPress={() => Linking.openURL(`https://leetcode.com/${user.codingProfiles?.leetcode}`)} className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <Image source={{ uri: "https://assets.streamlinehq.com/image/private/w_300,h_300,ar_1/f_auto/v1/icons/logos/leetcode-xp0gbbxtpmnkjk8uhdrmhg.png/leetcode-jj5yfhjdsmrt5j9xb3sec.png?_a=DATAiZiuZAA0" }} className="w-5 h-5" />
                    <Text className="text-gray-700 ml-3 font-medium">LeetCode</Text>
                    <Ionicons name="open-outline" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                </Pressable>
            )}
            {user?.codingProfiles?.gfg && (
                <Pressable onPress={() => Linking.openURL(`https://www.geeksforgeeks.org/user/${user.codingProfiles?.gfg}`)} className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/e/eb/GeeksForGeeks_logo.png" }} className="w-5 h-5" />
                    <Text className="text-gray-700 ml-3 font-medium">GeeksForGeeks</Text>
                    <Ionicons name="open-outline" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                </Pressable>
            )}
            {user?.upiId && (
                <View className="flex-row items-center bg-green-50 px-4 py-3 rounded-xl border border-green-100">
                    <Ionicons name="wallet-outline" size={22} color="#059669" />
                    <View className="ml-3">
                        <Text className="text-green-800 text-[10px] font-bold uppercase">UPI ID</Text>
                        <Text className="text-green-700 font-medium">{user.upiId}</Text>
                    </View>
                </View>
            )}
        </View>
    </View>
  );

  const renderTabBar = () => (
    <View className="flex-row bg-white border-t border-gray-50 py-1">
      <Pressable onPress={() => setActiveTab('posts')} className="flex-1 items-center py-3">
        <MaterialCommunityIcons name="grid" size={26} color={activeTab === 'posts' ? "black" : "#d1d5db"} />
        {activeTab === 'posts' && <View className="absolute bottom-1 w-8 h-0.5 bg-black rounded-full" />}
      </Pressable>
      <Pressable onPress={() => setActiveTab('shorts')} className="flex-1 items-center py-3">
        <MaterialCommunityIcons name="movie-play-outline" size={26} color={activeTab === 'shorts' ? "black" : "#d1d5db"} />
        {activeTab === 'shorts' && <View className="absolute bottom-1 w-8 h-0.5 bg-black rounded-full" />}
      </Pressable>
      <Pressable onPress={() => setActiveTab('about')} className="flex-1 items-center py-3">
        <MaterialCommunityIcons name="account-details-outline" size={30} color={activeTab === 'about' ? "black" : "#d1d5db"} />
        {activeTab === 'about' && <View className="absolute bottom-1 w-8 h-0.5 bg-black rounded-full" />}
      </Pressable>
    </View>
  );

  // --- GRID RENDERER ---
  const renderGridItem = ({ item, isShort }: { item: any, isShort?: boolean }) => (
    <Pressable
      onPress={() => {
        if (isShort) {
          navigation.navigate('IndividualPostOrShort', { shortId: item._id });
        } else {
          navigation.navigate('IndividualPostOrShort', { postId: item._id });
        }
      }}
      onLongPress={() => {
        Alert.alert(
          isShort ? "Delete Short" : "Delete Post",
          `Are you sure you want to delete this ${isShort ? 'short' : 'post'}?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => isShort ? deleteShort(item._id) : deletePost(item._id)
            }
          ]
        );
      }}
      className="m-[0.5px]"
      style={{ width: (width / 3) - 1, height: isShort ? (width / 2) : (width / 3), overflow: 'hidden' }}
    >

      {/* Thumbnail / Image / Video Frame */}
      {isShort ? (
        <View className="w-full h-full bg-gray-100 overflow-hidden">
          <Video
            source={{ uri: item.video }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            positionMillis={100}
          />
          <View className="absolute inset-0 bg-black/10" />
        </View>
      ) : (item.image && item.image.length > 0) ? (
        <Image
          source={{ uri: item.image[0] }}
          className="w-full h-full"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-full bg-gray-50 items-center justify-center">
          <Text className="text-gray-400 text-xs p-2 text-center" numberOfLines={3}>{item.title}</Text>
        </View>
      )}

      {/* Overlay info */}
      {!isShort && item.image && item.image.length > 1 && (
        <View className="absolute top-2 right-2 bg-black/30 px-2 py-1 rounded-full">
          <Ionicons name="copy" size={10} color="white" />
        </View>
      )}

      {isShort && (
        <View className="absolute bottom-2 left-2 flex-row items-center gap-1">
          <Ionicons name="play" size={12} color="white" />
          <Text className="text-white text-[10px] font-bold">{item.views || 0}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <StatusBar style="dark" />
      <FlatList
        key={activeTab}
        data={
          (activeTab === 'posts' ? posts :
            activeTab === 'shorts' ? shorts :
              activeTab === 'about' ? (['ABOUT']) :
                []) as any
        }
        keyExtractor={(item, index) => (typeof item === 'string' ? item : item._id + index)}
        numColumns={activeTab === 'about' ? 1 : 3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {renderProfileInfo()}
            {renderTabBar()}
          </>
        }
        renderItem={({ item }) => {
          if (activeTab === 'about') return <AboutSection />;
          if (activeTab === 'posts') {
            return renderGridItem({ item: item as PostType, isShort: false });
          }
          if (activeTab === 'shorts') {
            return renderGridItem({ item: item as unknown as ShortType, isShort: true });
          }
          return null;
        }}
        ListFooterComponent={
          isLoadingMore ? (
            <View className="py-4">
              <ActivityIndicator size="small" color="#000000" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons name="images-outline" size={48} color="#d1d5db" />
            <Text className="text-gray-400 mt-4 font-medium">No content here yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

export default Profile;