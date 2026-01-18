import React, { useState, useEffect } from 'react';
import { 
  Text, 
  Image, 
  View, 
  Pressable, 
  FlatList, 
  Dimensions, 
  RefreshControl,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import RefreshableScreen  from './RefreshableScreen';

const { width } = Dimensions.get('window');
const COLUMN_SIZE = width / 3;

// ... (Types remain the same) ...
type UserType = {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  college?: string;
  interest?: string;
  bio?: string;
  about?: string;
  experience?: string;
  skills?: string[];
  hobbies?: string;
  github_id?: string;
  linkedIn_id?: string;
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
  
  const [activeTab, setActiveTab] = useState<'grid' | 'list' | 'tags'>('grid');
  const [refreshing, setRefreshing] = useState(false);

  const getPosts = async () => {
    try {
      const res = await axios.get('/post/posts');
      if (res.data.success) {
        setPosts(res.data.posts);
      }
    } catch (e) {
      console.log("Error fetching posts");
    }
  };

  const getShorts = async () => {
    try {
      const res = await axios.get('/shorts/get/yours'); 
      if (res.data.success) {
        setShorts(res.data.shorts);
      }
    } catch (e) {
      console.log("Error fetching shorts", e);
    }
  };

  useEffect(() => {
    getPosts();
    getShorts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([getPosts(), getShorts()]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    Toast.show({ type: 'success', text1: 'Logged out successfully!' });
  };

  // --- ABOUT SECTION ---
  const AboutSection = () => (
    <View className="px-4 py-6 bg-black pb-20">
        {user?.about && (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">About</Text>
                <Text className="text-gray-200 text-base leading-relaxed">{user.about}</Text>
            </View>
        )}
         {user?.skills && user.skills.length > 0 ? (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">Skills</Text>
                <View className="flex-row flex-wrap gap-2">
                    {user.skills.map((skill: string, index: number) => (
                        <View key={index} className="bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-500/30">
                            <Text className="text-blue-300 font-medium text-sm">{skill}</Text>
                        </View>
                    ))}
                </View>
            </View>
        ) : null}
         {user?.experience ? (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">Experience</Text>
                <View className="flex-row items-start bg-gray-900/50 p-3 rounded-xl border border-gray-800">
                    <View className="bg-gray-800 p-2 rounded-lg mr-3">
                        <Ionicons name="briefcase" size={20} color="#f9a8d4" />
                    </View>
                    <Text className="text-white text-base flex-1 mt-1">{user.experience}</Text>
                </View>
            </View>
        ) : null}
        {/* Linkedin/Github */}
        {(user?.github_id || user?.linkedIn_id) ? (
            <View className="mb-6">
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">Socials</Text>
                <View className="gap-3">
                    {user?.github_id ? (
                        <Pressable 
                            onPress={() => Linking.openURL(user.github_id!)}
                            className="flex-row items-center bg-gray-900/50 px-4 py-3 rounded-xl border border-gray-800"
                        >
                            <Ionicons name="logo-github" size={22} color="gray" />
                            <Text className="text-gray-400 ml-3 font-medium">GitHub Profile</Text>
                            <Ionicons name="open-outline" size={16} color="gray" style={{marginLeft: 'auto'}} />
                        </Pressable>
                    ) : null}
                    {user?.linkedIn_id ? (
                        <Pressable 
                            onPress={() => Linking.openURL(user.linkedIn_id!)}
                            className="flex-row items-center bg-gray-900/50 px-4 py-3 rounded-xl border border-gray-800"
                        >
                            <Ionicons name="logo-linkedin" size={22} color="#0077b5" />
                            <Text className="text-blue-400 ml-3 font-medium">LinkedIn Profile</Text>
                            <Ionicons name="open-outline" size={16} color="gray" style={{marginLeft: 'auto'}} />
                        </Pressable>
                    ) : null}
                </View>
            </View>
        ) : null}
    </View>
  );

  // --- HEADER & INFO ---
  const renderHeader = () => (
    <View className="flex-row justify-between items-center px-4 py-2 border-b border-gray-900">
      <View className="flex-row items-center gap-1">
        <Ionicons name="lock-closed-outline" size={16} color="white" />
        <Text className="text-xl font-bold text-white">{user?.username}</Text>
        <Ionicons name="chevron-down" size={16} color="white" />
      </View>
      <View className="flex-row gap-5">
        <Pressable>
          <Ionicons name="add-circle-outline" size={28} color="white" />
        </Pressable>
        <Pressable onPress={handleLogout}>
          <Ionicons name="menu-outline" size={28} color="white" />
        </Pressable>
      </View>
    </View>
  );

  const renderProfileInfo = () => (
    <View className="px-4 pt-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Image
            source={{ uri: user?.avatar || `https://ui-avatars.com/api/?name=${user?.username}&background=random&color=fff` }}
            className="h-24 w-24 rounded-full border-2 border-gray-800"
          />
          <View className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-black">
            <Ionicons name="add" size={16} color="white" />
          </View>
        </View>
        <View className="flex-1 flex-row justify-around ml-4">
          <Pressable className="items-center">
            <Text className="text-white text-lg font-bold">{posts.length}</Text>
            <Text className="text-white text-sm">Posts</Text>
          </Pressable>
          <Pressable className="items-center" onPress={()=> navigation.navigate('FollowersAndFollowing', {userId: user._id, type: 'followers'})}>
            <Text className="text-white text-lg font-bold">{user?.followers?.length || 0}</Text>
            <Text className="text-white text-sm">Followers</Text>
          </Pressable>
          <Pressable className="items-center" onPress={()=> navigation.navigate('FollowersAndFollowing', {userId: user._id, type: 'following'})}>
            <Text className="text-white text-lg font-bold">{user?.following?.length || 0}</Text>
            <Text className="text-white text-sm">Following</Text>
          </Pressable>
        </View>
      </View>
      <View className="mt-3">
        <Text className="text-white font-bold text-sm">{user?.name}</Text>
        <Text className="text-gray-300 text-sm">{user?.college || "College Student"}</Text>
        <Text className="text-white text-sm">{user?.bio || user?.about || ""}</Text>
      </View>
      <View className="flex-row gap-2 mt-4">
        <Pressable className="flex-1 bg-gray-800 py-2 rounded-lg items-center" onPress={() => navigation.navigate('EditProfile')}>
          <Text className="text-white font-semibold">Edit profile</Text>
        </Pressable>
        <Pressable className="flex-1 bg-gray-800 py-2 rounded-lg items-center">
          <Text className="text-white font-semibold">Share profile</Text>
        </Pressable>
        <Pressable className="bg-gray-800 p-2 rounded-lg items-center justify-center">
          <Ionicons name="person-add-outline" size={20} color="white" />
        </Pressable>
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View className="flex-row mt-6 border-t border-gray-900">
      <Pressable onPress={() => setActiveTab('grid')} className={`flex-1 items-center py-3 ${activeTab === 'grid' ? 'border-b-2 border-white' : ''}`}>
        <MaterialCommunityIcons name="grid" size={28} color={activeTab === 'grid' ? "white" : "gray"} />
      </Pressable>
      <Pressable onPress={() => setActiveTab('list')} className={`flex-1 items-center py-3 ${activeTab === 'list' ? 'border-b-2 border-white' : ''}`}>
        <MaterialCommunityIcons name="movie-play-outline" size={28} color={activeTab === 'list' ? "white" : "gray"} />
      </Pressable>
      <Pressable onPress={() => setActiveTab('tags')} className={`flex-1 items-center py-3 ${activeTab === 'tags' ? 'border-b-2 border-white' : ''}`}>
        <MaterialCommunityIcons name="account-box-outline" size={28} color={activeTab === 'tags' ? "white" : "gray"} />
      </Pressable>
    </View>
  );

  // --- GRID RENDERER ---
  const renderGridItem = ({ item, isShort }: { item: any, isShort?: boolean }) => (
    <Pressable onPress={() => {
      navigation.navigate('IndividualPostOrShort', { postId: item._id });
      }} className="border border-black relative" style={{ width: COLUMN_SIZE, height: isShort ? COLUMN_SIZE * 1.5 : COLUMN_SIZE }}>
      {(item.image && item.image.length > 0) || item.thumbnail || item.video ? (
        <Image 
            source={{ uri: isShort ? (item.thumbnail || 'https://via.placeholder.com/150/000000/FFFFFF/?text=Short') : item.image[0] }} 
            className="w-full h-full" 
            resizeMode="cover" 
        />
      ) : (
        <View className="w-full h-full bg-gray-800 items-center justify-center">
           <Text className="text-gray-500 text-xs p-2 text-center" numberOfLines={3}>{item.title}</Text>
        </View>
      )}
      {isShort && (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
              <Ionicons name="play-outline" size={32} color="white" />
              <Text className="text-white text-xs font-bold absolute bottom-2 left-2">{item.views || 0} views</Text>
          </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      {renderHeader()}
      
      <FlatList
        // FIX: Use activeTab as key to force re-render when switching tabs
        // This prevents "changing numColumns on the fly" error
        key={activeTab} 
        
        data={
            activeTab === 'grid' ? posts : 
            activeTab === 'list' ? shorts : 
            ['ABOUT_VIEW']
        }
        keyExtractor={(item, index) => (typeof item === 'string' ? item : item._id)}
        
        // Dynamic columns based on tab
        numColumns={activeTab === 'tags' ? 1 : 3} 
        
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
        
        ListHeaderComponent={
          <>
            {renderProfileInfo()}
            {renderTabBar()}
          </>
        }
        
        renderItem={({ item }) => {
            if (activeTab === 'tags') {
                return <AboutSection />;
            }
            if (activeTab === 'grid') {
                return renderGridItem({ item: item as PostType, isShort: false });
            }
            if (activeTab === 'list') {
                return renderGridItem({ item: item as unknown as ShortType, isShort: true });
            }
            return null;
        }}

        ListEmptyComponent={
          activeTab !== 'tags' ? (
            <View className="items-center justify-center py-20">
                <View className="w-24 h-24 rounded-full border-2 border-white items-center justify-center mb-4">
                    <Ionicons name={activeTab === 'list' ? "videocam-outline" : "camera-outline"} size={48} color="white" />
                </View>
                <Text className="text-white text-xl font-bold">
                    {activeTab === 'list' ? "No Shorts Yet" : "No Posts Yet"}
                </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

export default Profile;