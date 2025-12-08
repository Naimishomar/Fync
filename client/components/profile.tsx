import React,{useState, useEffect} from 'react';
import { Text, Image, View, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handlePayment } from 'utils/payment';

type UserType = {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  college?: string;
};

type PostType = {
  _id: string;
  title: string;
  description: string;
  image: string[];
  createdAt: string;
  user: UserType;
};


function Profile() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [about, setAbout] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'about'>('posts');

  useEffect(() => {
    const getPosts = async () => {
      const token = await AsyncStorage.getItem('token') || '';
      const res = await fetch('http://192.168.28.228:3000/post/posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
      }
    };
    getPosts();
  }, []);

const Posts = () => (
  <View className="flex-1 bg-black">
    <FlatList
      data={posts}
      renderItem={({ item }) => (
        <View className="mb-5">
          {/* User Info */}
          <View className="flex-row items-center justify-between p-3">
            <View className="flex-row items-center">
              <Image
                source={{ uri: item.user?.avatar }}
                className="w-12 h-12 rounded-full border border-pink-300"
              />

              <View className="ml-3">
                <Text className="text-sm font-semibold text-pink-300">
                  {item.user?.name}
                </Text>

                <Text className="text-xs text-gray-400">
                  @{item.user?.username}
                </Text>
                <Text className="text-xs text-gray-400">
                  {item.user?.college}
                </Text>
              </View>
            </View>

            <Text className="text-sm text-gray-400">
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {/* POST IMAGE (FIXED) */}
          {item.image?.length > 0 && (
            <Image
              source={{ uri: item.image[0] }}
              className="w-full h-64 rounded-xl"
              resizeMode="cover"
            />
          )}

          <Text className="text-white text-xl">{item.title}</Text>
          <Text className="text-gray-500 text-md">{item.description}</Text>
        </View>
      )}
      keyExtractor={(item) => item._id}
    />
  </View>
);

const About = () => (
  <View className="flex-1 bg-black">
    <FlatList
      data={about}
      renderItem={({ item }) => (
        <View className="mb-5">
          <Text className="text-white text-xl">{item.title}</Text>
          <Text className="text-gray-500 text-md">{item.description}</Text>
        </View>
      )}
      keyExtractor={(item) => item._id}
    />
  </View>
);


  const renderTabBar = () => (
    <View className="w-full flex-row border-b border-gray-700">
      {['Posts', 'About'].map((tabTitle) => {
        const key = tabTitle === 'Posts' ? 'posts' : 'about';
        const isActive = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => setActiveTab(key)}
            className="flex-1 items-center pb-2">
            <Text
              className={`text-base font-semibold ${isActive ? 'text-white' : 'text-gray-400'}`}>
              {tabTitle}
            </Text>
            {isActive && (
              <View
                className="absolute bottom-0 h-0.5 w-full bg-pink-300"
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView className="p-3 bg-black h-full relative">
      <View className="flex-row items-center gap-2 mb-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl">Back</Text>
      </View>
      <Image
        source={{ uri: user?.banner }}
        className="w-full h-44 rounded-2xl"
        resizeMode="cover"
      />
      <View className="absolute left-1/2 top-[27%]" style={{ transform: [{ translateX: -50 }] }}>
        <Image
          source={{ uri: user?.avatar }}
          className="w-32 h-32 rounded-full border-4 border-pink-300"
          resizeMode="cover"
        />
      </View>

      <View className="mt-20 w-full items-center">
        <Text className="text-white text-3xl font-bold">{user?.name}</Text>
        <Text className="text-gray-400 text-xl font-semibold">@{user?.username}</Text>
        <Text className="text-gray-400 text-xl font-semibold">{user?.interest}</Text>
      </View>

      <View className='flex-row justify-evenly items-center gap-10 mb-5'>
        <TouchableOpacity>
            <Text className='text-white text-4xl text-center'>{posts?.length}</Text>
            <Text className="text-gray-400 text-md">Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity>
            <Text className='text-white text-4xl text-center'>{user?.followers?.length}</Text>
            <Text className="text-gray-400 text-md">Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity>
            <Text className='text-white text-4xl text-center'>{user?.following?.length}</Text>
            <Text className="text-gray-400 text-md">Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>handlePayment(50, user)} className='border border-pink-300 p-2 rounded-md'>
          <Text className='text-white'>Pay Now</Text>
        </TouchableOpacity>
      </View>

      {renderTabBar()}

      {activeTab === 'posts' ? <Posts /> : <About />}

    </SafeAreaView>
  );
}

export default Profile;
