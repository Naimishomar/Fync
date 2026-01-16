import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Pressable
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../context/axiosConfig'; 
import { useAuth } from '../context/auth.context';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

// --- TYPES ---
interface NotificationItem {
  _id: string;
  type: 'follow' | 'tag' | 'like' | 'comment' | 'story_like' | 'story_comment';
  sender: {
    _id: string;
    username: string;
    avatar: string;
  };
  post?: {
    _id: string;
    image?: string[];
  }; 
  commentText?: string;
  isRead: boolean;
  createdAt: string;
}

const Notification = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- FETCH NOTIFICATIONS ---
  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/notifications'); 
      if (response.data.success) {
        setNotifications(response.data.notifications);
        markAsRead();
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async () => {
    try {
      await axios.put('/notifications/read'); 
    } catch (error) {
      console.error("Error marking read:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // --- HANDLERS ---
  const handlePress = (item: NotificationItem) => {
    if (item.type === 'follow') {
      navigation.navigate('PublicProfile', { user: item.sender });
    } else if (item.post) {
      navigation.navigate('Profile');
    }
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }: { item: NotificationItem }) => {
    let message = '';
    let iconName: any = 'notifications';
    let iconColor = '#fff';
    let iconBg = '#333';

    switch (item.type) {
      case 'follow':
        message = 'started following you.';
        iconName = 'person-add';
        iconColor = '#60a5fa'; // blue-400
        iconBg = 'rgba(96, 165, 250, 0.2)';
        break;
      case 'tag':
        message = 'tagged you in a post.';
        iconName = 'at';
        iconColor = '#a855f7'; // purple-500
        iconBg = 'rgba(168, 85, 247, 0.2)';
        break;
      case 'like':
        message = 'liked your post.';
        iconName = 'heart';
        iconColor = '#f43f5e'; // rose-500
        iconBg = 'rgba(244, 63, 94, 0.2)';
        break;
      case 'comment':
        message = `commented: "${item.commentText || 'Nice!'}"`;
        iconName = 'chatbubble';
        iconColor = '#34d399'; // emerald-400
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'story_comment':
        message = `commented: "${item.commentText || 'Nice!'} on your shorts"`;
        iconName = 'chatbubble';
        iconColor = '#34d399'; // emerald-400
        iconBg = 'rgba(52, 211, 153, 0.2)';
        break;
      case 'story_like':
        message = 'liked your shorts.';
        iconName = 'heart-circle';
        iconColor = '#fbbf24'; // amber-400
        iconBg = 'rgba(251, 191, 36, 0.2)';
        break;
    }

    return (
      <Pressable 
        className={`flex-row items-center py-3 px-2 mb-2 mx-2 rounded-2xl border ${
            !item.isRead 
            ? 'bg-indigo-900/20 border-indigo-500/30' 
            : 'bg-[#1e1e1e]/60 border-white/5'
        }`}
        onPress={() => handlePress(item)}
      >
        {/* Avatar Section */}
        <View className="relative mr-2">
          <Image 
            source={{ uri: item.sender.avatar || `https://ui-avatars.com/api/?name=${item.sender.username}` }} 
            className="w-10 h-10 rounded-full border border-white/10"
          />
        </View>

        {/* Text Section */}
        <View className="flex-1">
          <Text className="text-gray-300 text-sm leading-5">
            <Text className="font-bold text-white text-base">{item.sender.username}</Text> {message}
          </Text>
          <Text className="text-gray-500 text-[10px] mt-1 font-medium uppercase tracking-wide">
            {getTimeAgo(item.createdAt)}
          </Text>
        </View>

        {/* Right Side: Post Image or Follow Button */}
        {item.type !== 'follow' && item.post?.image && item.post.image.length > 0 ? (
          <Image 
            source={{ uri: item.post.image[0] }} 
            className="w-12 h-12 rounded-lg border border-white/10"
          />
        ) : item.type === 'follow' ? (
            <Text>.</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-black">
      {/* 🌸 BACKGROUND 🌸 */}
      <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-50" />
      <LinearGradient 
        colors={['rgba(236, 72, 153, 0.40)', 'rgba(0,0,0,0.85)', '#000000']} 
        className="absolute w-full h-full" 
      />

      <SafeAreaView className="flex-1 px-2">
        {/* Header */}
        <View className="px-2 pt-4 pb-4 flex flex-row items-center gap-2">
            <Pressable onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            <Text className="text-white text-3xl font-black shadow-lg">Notifications ⚡️</Text>
        </View>

        {/* List */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#ec4899" />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
            }
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center mt-32">
                <View className="w-20 h-20 bg-white/5 rounded-full items-center justify-center mb-4">
                    <Ionicons name="notifications-off-outline" size={40} color="#666" />
                </View>
                <Text className="text-gray-400 text-lg font-bold">All caught up!</Text>
                <Text className="text-gray-600 text-sm mt-1">No new notifications for now.</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

// --- HELPER FUNCTION: Time Ago ---
const getTimeAgo = (dateString: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default Notification;