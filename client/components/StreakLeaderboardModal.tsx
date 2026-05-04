import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from '../context/axiosConfig';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface LeaderboardUser {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  streakCount: number;
  college: string;
}

const StreakLeaderboardModal = ({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardUser[]>([]);
  const [userRank, setUserRank] = useState(-1);
  const [userStreak, setUserStreak] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);

  useEffect(() => {
    if (isVisible) {
      fetchLeaderboard();
    }
  }, [isVisible]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/user/streak-leaderboard');
      if (res.data.success) {
        setData(res.data.leaderboard);
        setUserRank(res.data.userRank);
        setUserStreak(res.data.userStreak);
        setCompletedToday(res.data.completedToday);
      }
    } catch (error) {
      console.error("Leaderboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <BlurView intensity={80} tint="dark" className="absolute inset-0" />
        
        <View className="bg-[#FDFDFF] rounded-t-[48px] h-[80%] border-t border-slate-100">
          {/* Accent Gradient */}
          <LinearGradient
            colors={['rgba(249, 115, 22, 0.05)', 'transparent']}
            className="absolute top-0 left-0 right-0 h-64 rounded-t-[48px]"
          />

          {/* Header */}
          <View className="px-8 pt-10 pb-6">
            <View className="flex-row items-center justify-between mb-8">
              <View>
                <Text className="text-zinc-900 text-3xl font-black uppercase tracking-tighter">
                  Campus <Text className="text-orange-500">Legends</Text>
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[3px]">Daily Contribution Elite</Text>
                </View>
              </View>
              
              <View className="flex-row items-center gap-3">
                <TouchableOpacity 
                  onPress={() => {
                    Alert.alert(
                      "🔥 Streak Rules",
                      "Keep the flame alive and climb the ranks!\n\n1. Post a Daily Post or Short to increase your streak.\n2. Consistency is key: You must post every single day.\n3. If you miss a day, your streak resets to 0 by the end of the day.\n\nTop 10 users with the highest streaks get featured as Campus Legends!",
                      [{ text: "Got it!" }]
                    );
                  }}
                  className="w-11 h-11 bg-slate-200 rounded-2xl items-center justify-center border border-slate-100"
                >
                  <Ionicons name="information-circle-outline" size={22} color="#475569" />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={onClose}
                  className="w-11 h-11 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100"
                >
                  <Ionicons name="close" size={22} color="#1e293b" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Current User Rank Card - High Contrast Orange */}
            <View 
              className="bg-orange-500 p-6 rounded-[32px]"
              style={{
                shadowColor: "#f97316",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 15,
                elevation: 10
              }}
            >
               <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="bg-white/20 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                      <Text className="text-white font-black text-xl">#{userRank > 0 ? userRank : '--'}</Text>
                    </View>
                    <View>
                      <Text className="text-white/70 text-[9px] font-black uppercase tracking-widest mb-0.5">Your Position</Text>
                      <Text className="text-white text-base font-black uppercase tracking-tight">Global Ranking</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-white/70 text-[9px] font-black uppercase tracking-widest mb-0.5">Current Streak</Text>
                    <View className="flex-row items-center">
                      <Text className="text-white text-2xl font-black">{userStreak}</Text>
                      <MaterialCommunityIcons name="fire" size={24} color="white" className="ml-1" />
                    </View>
                    
                    <View className="mt-1">
                      {completedToday ? (
                        <View className="flex-row items-center bg-white/20 px-2 py-1 rounded-full">
                          <MaterialCommunityIcons name="check-circle" size={10} color="#fff" />
                          <Text className="text-white text-[8px] font-black uppercase tracking-widest ml-1">Secured Today</Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center bg-red-500/40 px-2 py-1 rounded-full border border-red-400/50">
                          <MaterialCommunityIcons name="clock-alert-outline" size={10} color="#fff" />
                          <Text className="text-white text-[8px] font-black uppercase tracking-widest ml-1">Post To Secure</Text>
                        </View>
                      )}
                    </View>
                  </View>
               </View>
            </View>
          </View>

          {/* List Section */}
          <View className="flex-1 px-5">
            {loading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#f97316" />
              </View>
            ) : (
              <FlatList
                data={data}
                renderItem={({ item, index }) => (
                  <View 
                    className="flex-row items-center px-4 py-4 mb-4 bg-white rounded-3xl border border-slate-100"
                    style={{
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.03,
                      shadowRadius: 5,
                      elevation: 1
                    }}
                  >
                    <View className="w-8 items-center mr-3">
                      {index < 3 ? (
                        <MaterialCommunityIcons 
                          name="crown" 
                          size={22} 
                          color={index === 0 ? "#FFD700" : index === 1 ? "#94a3b8" : "#d97706"} 
                        />
                      ) : (
                        <Text className="text-slate-300 font-black text-sm">#{index + 1}</Text>
                      )}
                    </View>
                    
                    <Image 
                      source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} 
                      className="w-11 h-11 rounded-2xl mr-4 border border-slate-50"
                    />
                    
                    <View className="flex-1">
                      <Text className="text-slate-800 font-black text-sm uppercase tracking-tight" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        {item.college || 'Fync Student'}
                      </Text>
                    </View>

                    <View className="flex-row items-center bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                      <Text className="text-orange-600 font-black text-xs mr-1">{item.streakCount}</Text>
                      <MaterialCommunityIcons name="fire" size={16} color="#f97316" />
                    </View>
                  </View>
                )}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }}
                ListEmptyComponent={() => (
                  <View className="items-center mt-20 px-10">
                    <View className="bg-slate-50 p-8 rounded-full mb-6">
                      <MaterialCommunityIcons name="fire-off" size={64} color="#cbd5e1" />
                    </View>
                    <Text className="text-slate-800 font-black text-lg uppercase text-center">Ecosystem Inactive</Text>
                    <Text className="text-slate-400 text-[10px] font-black text-center mt-2 uppercase tracking-widest leading-4">
                      No active streaks detected.{'\n'}Be the first to start the flame!
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default StreakLeaderboardModal;
