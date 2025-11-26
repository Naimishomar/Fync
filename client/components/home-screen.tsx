import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth.context';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home1'>;

const { width } = Dimensions.get('window');

const EmptyStateIllustration = () => (
  <View className="mb-10 w-full items-center">
    <View style={{ width: width * 0.7, height: 100 }} className="border-b border-gray-400">
      <Feather
        name="users"
        size={80}
        color="#E5E7EB"
        style={{ alignSelf: 'center', marginTop: 10 }}
      />
      <Text className="mt-2 text-center text-xs text-gray-400">Personalized Feed Illustration</Text>
    </View>
  </View>
);

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [profileImage, setProfileImage] = useState<string | undefined>('');
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setProfileImage(user.avatar);
    }
  }, [user]);


  const renderHeader = () => (
    <View className="flex-row items-center justify-between px-4 py-3">
      <TouchableOpacity className="flex-row items-center" onPress={()=> navigation.navigate("Profile")}>
        <Image
          source={{ uri: profileImage }}
          className="mr-2 h-12 w-12 rounded-full border border-pink-300"
        />
        <Text className="text-4xl font-medium text-white">Fync</Text>
      </TouchableOpacity>

      <View className="flex-row items-center gap-8">
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={26} color="white" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="send-outline" size={24} color="white" className='-rotate-45' />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View className="w-full flex-row border-b border-gray-700">
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
                className="absolute bottom-0 h-0.5 w-full bg-pink-300"
                style={{ width: width * 0.45 }}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-8 pt-20">
      <EmptyStateIllustration />
      <Text className="mb-2 text-xl font-bold text-gray-800">No posts to show... yet</Text>
      <Text className="max-w-sm text-center text-gray-500">
        Your personalized feed will appear here once creators start posting.
      </Text>
    </View>
  );

  const renderBottomBar = () => (
    <SafeAreaView className="absolute bottom-0 w-full border-t border-gray-800">
      <View className="flex-row items-center justify-around">
        <Ionicons name="home-outline" size={24} color="white" />
        <Feather name="volume-2" size={24} color="white" />
        <Ionicons name="server-outline" size={24} color="white" />
        <Feather name="briefcase" size={24} color="white" />
        <Ionicons name="heart-outline" size={24} color="white" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      {renderHeader()}

      {renderTabBar()}

      <ScrollView className="flex-1">{renderEmptyState()}</ScrollView>

      <TouchableOpacity
        className="absolute bottom-36 right-8 h-14 w-14 items-center justify-center rounded-full bg-pink-300 shadow-lg"
        onPress={() => console.log('Navigate to Create Post')}>
        <Ionicons name="add" size={30} color="black" />
      </TouchableOpacity>

      {renderBottomBar()}
    </SafeAreaView>
  );
}
