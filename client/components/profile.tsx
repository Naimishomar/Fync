import React, { useState, useEffect } from 'react';
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
      const token = (await AsyncStorage.getItem('token')) || '';
      const res = await fetch('http://10.21.99.81:3000/post/posts', {
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
                  className="h-12 w-12 rounded-full border border-pink-300"
                />

                <View className="ml-3">
                  <Text className="text-sm font-semibold text-pink-300">{item.user?.name}</Text>

                  <Text className="text-xs text-gray-400">@{item.user?.username}</Text>
                  <Text className="text-xs text-gray-400">{item.user?.college}</Text>
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
                className="h-64 w-full rounded-xl"
                resizeMode="cover"
              />
            )}

            <Text className="text-xl text-white">{item.title}</Text>
            <Text className="text-md text-gray-500">{item.description}</Text>
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
            <Text className="text-xl text-white">{item.title}</Text>
            <Text className="text-md text-gray-500">{item.description}</Text>
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
            {isActive && <View className="absolute bottom-0 h-0.5 w-full bg-pink-300" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView className="relative h-full bg-black p-3">
      <View className="mb-3 flex-row items-center gap-2">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="white" />
        </TouchableOpacity>
        <Text className="text-2xl text-white">Back</Text>
      </View>
      <Image
        source={{ uri: user?.banner }}
        className="h-44 w-full rounded-2xl"
        resizeMode="cover"
      />
      <View className="absolute left-1/2 top-[27%]" style={{ transform: [{ translateX: -50 }] }}>
        <Image
          source={{ uri: user?.avatar }}
          className="h-32 w-32 rounded-full border-4 border-pink-300"
          resizeMode="cover"
        />
      </View>

      <View className="mt-20 w-full items-center">
        <Text className="text-3xl font-bold text-white">{user?.name}</Text>
        <Text className="text-xl font-semibold text-gray-400">@{user?.username}</Text>
        <Text className="text-xl font-semibold text-gray-400">{user?.interest}</Text>
      </View>

      <View className="mb-5 flex-row items-center justify-evenly gap-10">
        <TouchableOpacity>
          <Text className="text-center text-4xl text-white">{posts?.length}</Text>
          <Text className="text-md text-gray-400">Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text className="text-center text-4xl text-white">{user?.followers?.length}</Text>
          <Text className="text-md text-gray-400">Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text className="text-center text-4xl text-white">{user?.following?.length}</Text>
          <Text className="text-md text-gray-400">Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handlePayment(50, user, navigation)}
          className="rounded-md border border-pink-300 p-2">
          <Text className="text-white">Pay Now</Text>
        </TouchableOpacity>
      </View>

      {renderTabBar()}

      {activeTab === 'posts' ? <Posts /> : <About />}
    </SafeAreaView>
  );
}

export default Profile;
