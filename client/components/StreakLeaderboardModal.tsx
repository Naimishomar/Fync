import React, { useEffect, useState } from 'react';
import {View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator, Image, Dimensions} from 'react-native'
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import axios from '../context/axiosConfig';
import { Alert } from './ui/AlertModal';

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
        
        <View className="bg-paper rounded-t-sheet h-[80%] border-t border-line">

          {/* Header */}
          <View className="px-gutter pt-10 pb-6">
            <View className="flex-row items-center justify-between mb-8">
              <View>
                <Text className="text-ink font-display uppercase text-h1">
                  Campus <Text className="text-accent-text">Legends</Text>
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-ink-3 text-label font-display uppercase">Daily Contribution Elite</Text>
                </View>
              </View>
              
              <View className="flex-row items-center gap-3">
                <TouchableOpacity 
                  onPress={() => {
                    Alert.alert(
                      "Streak Rules",
                      "Keep the flame alive and climb the ranks!\n\n1. Post a Daily Post or Short to increase your streak.\n2. Consistency is key: You must post every single day.\n3. If you miss a day, your streak resets to 0 by the end of the day.\n\nTop 10 users with the highest streaks get featured as Campus Legends!",
                      [{ text: "Got it!" }]
                    );
                  }}
                  className="w-11 h-11 bg-paper-2 rounded-card items-center justify-center border border-line"
                >
                  <Ionicons name="information-circle-outline" size={22} color="#57534E" />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={onClose}
                  className="w-11 h-11 bg-paper-2 rounded-card items-center justify-center border border-line"
                >
                  <Ionicons name="close" size={22} color="#12100E" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Current User Rank Card - High Contrast Orange */}
            <View 
              className="bg-brand-500 p-6 rounded-sheet border-2 border-ink"
              style={{
                shadowColor: "#12100E",
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 6
              }}
            >
               <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="bg-card/20 w-12 h-12 rounded-card items-center justify-center mr-4">
                      <Text className="text-ink font-display text-xl">#{userRank > 0 ? userRank : '--'}</Text>
                    </View>
                    <View>
                      <View className="flex-row items-center mt-6 mb-0.5" style={{ gap: 12 }}>
                        <Text className="text-white/70 text-label font-display uppercase">Your Position</Text>
                        <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                      </View>
                      <Text className="text-white text-base font-display uppercase">Global Ranking</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center mt-6 mb-0.5" style={{ gap: 12 }}>
                      <Text className="text-white/70 text-label font-display uppercase">Current Streak</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>
                    <View className="flex-row items-center">
                      <Text className="text-white text-2xl font-display">{userStreak}</Text>
                      <MaterialCommunityIcons name="fire" size={24} color="white" className="ml-1" />
                    </View>
                    
                    <View className="mt-1">
                      {completedToday ? (
                        <View className="flex-row items-center bg-card/20 px-2 py-1 rounded-full">
                          <MaterialCommunityIcons name="check-circle" size={10} color="#fff" />
                          <Text className="text-white text-label font-display uppercase ml-1">Secured Today</Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center bg-danger/40 px-2 py-1 rounded-full border border-danger/50">
                          <MaterialCommunityIcons name="clock-alert-outline" size={10} color="#fff" />
                          <Text className="text-white text-label font-display uppercase ml-1">Post To Secure</Text>
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
                <ActivityIndicator size="large" color="#F97316" />
              </View>
            ) : (
              <FlatList
                data={data}
                renderItem={({ item, index }) => (
                  <View 
                    className="flex-row items-center px-4 py-4 mb-4 bg-card rounded-card border border-line"
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
                          color={index === 0 ? "#F5B700" : index === 1 ? "#8B857E" : "#B45309"} 
                        />
                      ) : (
                        <Text className="text-ink-4 font-display text-sm">#{index + 1}</Text>
                      )}
                    </View>
                    
                    <Image 
                      source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} 
                      className="w-11 h-11 rounded-card mr-4 border border-line"
                    />
                    
                    <View className="flex-1">
                      <Text className="text-ink font-display text-sm uppercase" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text className="text-ink-3 text-label font-semibold uppercase">
                        {item.college || 'Fync Student'}
                      </Text>
                    </View>

                    <View className="flex-row items-center bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
                      <Text className="text-accent-text font-display text-xs mr-1">{item.streakCount}</Text>
                      <MaterialCommunityIcons name="fire" size={16} color="#F97316" />
                    </View>
                  </View>
                )}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }}
                ListEmptyComponent={() => (
                  <View className="items-center mt-20 px-gutter">
                    <View className="bg-paper-2 p-card-pad rounded-full mb-6">
                      <MaterialCommunityIcons name="fire-off" size={64} color="#C4BEB6" />
                    </View>
                    <Text className="text-ink font-display text-lg uppercase text-center">Ecosystem Inactive</Text>
                    <Text className="font-sans text-sm text-ink-3 text-center mt-2">
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
