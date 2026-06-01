import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';

const GameLeaderboard = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const gameName = route.params?.gameName || "FlappyBird"; // Default to FlappyBird

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [gameName]);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`/games/leaderboard/${gameName}`);
      setLeaderboard(res.data.leaderboard);
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    } finally {
      setLoading(false);
    }
  };

  const getGameTitle = () => {
    return gameName === "FlappyBird" ? "Flappy Bird High Scores" : "Draw & Guess Champions";
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-5 pt-12 pb-4 border-b border-slate-100 shadow-sm z-10 bg-white">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2 rounded-full">
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-900">Leaderboard</Text>
        <View className="w-10" />
      </View>

      <View className="p-6 items-center bg-indigo-50 border-b border-indigo-100">
        <Ionicons name="trophy" size={48} color="#f59e0b" />
        <Text className="text-lg font-bold text-slate-800 mt-2">{getGameTitle()}</Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : leaderboard.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-slate-400">No scores yet. Be the first!</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item, index }) => (
            <View className="flex-row items-center bg-white p-4 mb-3 rounded-2xl shadow-sm border border-slate-100">
              <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${index === 0 ? 'bg-amber-100' : index === 1 ? 'bg-slate-200' : index === 2 ? 'bg-orange-100' : 'bg-slate-50'}`}>
                <Text className={`font-bold ${index === 0 ? 'text-amber-600' : index === 1 ? 'text-slate-500' : index === 2 ? 'text-orange-600' : 'text-slate-400'}`}>
                  #{index + 1}
                </Text>
              </View>
              
              <Image 
                source={{ uri: item.user?.avatar || "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" }} 
                className="w-12 h-12 rounded-full bg-slate-200"
              />
              
              <View className="ml-3 flex-1">
                <Text className="font-bold text-slate-800 text-base">{item.user?.name}</Text>
                <Text className="text-slate-500 text-xs">@{item.user?.username}</Text>
              </View>

              <View className="items-end">
                <Text className="font-black text-indigo-600 text-lg">{item.highScore}</Text>
                <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Score</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
};

export default GameLeaderboard;
