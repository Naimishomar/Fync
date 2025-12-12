import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth.context';
import no_post from '../assets/no_post.png';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const [profileImage, setProfileImage] = useState<string | undefined>('');
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const [feed, setFeed] = useState([]);
  const { user } = useAuth();

  const getFeed = async () => {
    const token = (await AsyncStorage.getItem('token')) || '';
    const res = await fetch('http://10.21.99.81:3000/post/feed', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (data.success) {
      setFeed(data.posts);
    }
  };

  useEffect(() => {
    if (user) {
      setProfileImage(user.avatar);
    }
    getFeed();
  }, [user, activeTab]);

  const timeAgo = (date: any) => {
    const now = new Date();
    const posted = new Date(date);
    const seconds = Math.floor((now - posted) / 1000);

    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;

    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  };

  const renderHeader = () => (
    <View className="flex-row items-center justify-between px-4 pt-14">
      <View className="flex-row items-center">
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Image
            source={{ uri: profileImage }}
            className="mr-2 h-12 w-12 rounded-full border border-pink-300"
          />
        </TouchableOpacity>
        <Text className="text-4xl font-medium text-white">Fync</Text>
      </View>

      <View className="flex-row items-center gap-8">
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={26} color="white" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="send-outline" size={24} color="white" className="-rotate-45" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View className="w-full flex-row border-b border-gray-700 pt-4">
      {['For You', 'Following'].map((tabTitle) => {
        const key = tabTitle === 'For You' ? 'forYou' : 'following';
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
                className="absolute bottom-0 h-0.5 bg-pink-300"
                style={{ width: width * 0.45 }}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderPostItem = ({ item }) => (
    <View className="mb-5 rounded-xl bg-white/10">
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center">
          <Image
            source={{ uri: item.user?.avatar }}
            className="h-12 w-12 rounded-full border border-pink-300"
          />
          <View className="ml-3">
            <Text className="text-sm font-semibold text-pink-300">{item.user?.name}</Text>
            <Text className="text-sm text-gray-400">{timeAgo(item.createdAt)}</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <TouchableOpacity className="rounded-lg border border-pink-300 px-3 py-1">
            <Text className="text-white">Follow</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {item.image?.length > 0 && (
        <Image source={{ uri: item.image[0] }} className="h-64 w-full" resizeMode="cover" />
      )}
      <View className="px-3 py-2">
        <Text className="text-md text-pink-300">{item.description}</Text>
      </View>
    </View>
  );

  const EmptyListComponent = () => (
    <View className="mt-10 flex-1 items-center px-4 pt-5">
      <Image source={no_post} className="h-48 w-[90%]" resizeMode="cover" />
      <Text className="mb-2 text-2xl font-bold text-gray-300">No posts to show... yet</Text>
      <Text className="max-w-sm px-5 text-center text-gray-500">
        Your personalized feed will appear here once creators start posting.
      </Text>
    </View>
  );

  // const renderBottomBar = () => (
  //   <SafeAreaView className="absolute bottom-0 w-full border-t border-gray-800 bg-black">
  //     <View className="flex-row items-center justify-around">
  //       <Ionicons name="home-outline" size={24} color="white" />
  //       <Feather name="volume-2" size={24} color="white" />
  //       <Ionicons name="server-outline" size={24} color="white" />
  //       <Feather name="briefcase" size={24} color="white" />
  //       <Ionicons name="heart-outline" size={24} color="white" />
  //     </View>
  //   </SafeAreaView>
  // );

  return (
    <View className="flex-1 bg-black">
      {renderHeader()}
      {renderTabBar()}
      <FlatList
        data={feed}
        renderItem={renderPostItem}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={<EmptyListComponent />}
        contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 5, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        className="absolute bottom-10 right-8 h-14 w-14 items-center justify-center rounded-full bg-pink-300 shadow-lg"
        onPress={() => navigation.navigate('CreatePost')}>
        <Ionicons name="add" size={30} color="black" />
      </TouchableOpacity>

      {/* {renderBottomBar()} */}
    </View>
  );
}
