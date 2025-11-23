import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

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
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');

  const profileImage = 'https://placehold.co/40x40/000000/FFFFFF?text=P';

  const renderHeader = () => (
    <View className="flex-row items-center justify-between border-b border-gray-200 px-4 pb-3">
      <View className="flex-row items-center">
        <Image
          source={{ uri: profileImage }}
          className="mr-2 h-8 w-8 rounded-full border border-gray-400"
        />
        <Text className="text-2xl font-semibold italic">Fync</Text>
      </View>

      <View className="flex-row items-center space-x-4">
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="send-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View className="w-full flex-row border-b border-gray-300 bg-white">
      {['For You', 'Following'].map((tabTitle) => {
        const key = tabTitle === 'For You' ? 'forYou' : 'following';
        const isActive = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => setActiveTab(key)}
            className="flex-1 items-center pb-2">
            <Text
              className={`text-base font-semibold ${isActive ? 'text-black' : 'text-gray-500'}`}>
              {tabTitle}
            </Text>
            {isActive && (
              <View
                className="absolute bottom-0 h-0.5 w-full bg-black"
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
    <SafeAreaView className="absolute bottom-0 w-full border-t border-gray-200 bg-white">
      <View className="h-14 flex-row items-center justify-around">
        <Ionicons name="home-outline" size={24} color="black" />
        <Feather name="volume-2" size={24} color="gray" />
        <Ionicons name="server-outline" size={24} color="gray" />
        <Feather name="briefcase" size={24} color="gray" />
        <Ionicons name="heart-outline" size={24} color="gray" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {renderHeader()}

      {renderTabBar()}

      <ScrollView className="flex-1">{renderEmptyState()}</ScrollView>

      <TouchableOpacity
        className="absolute bottom-20 right-8 h-14 w-14 items-center justify-center rounded-full bg-black shadow-lg"
        onPress={() => console.log('Navigate to Create Post')}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {renderBottomBar()}
    </SafeAreaView>
  );
}
