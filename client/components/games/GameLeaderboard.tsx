import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
    <View className="flex-1 bg-paper">
      <View className="flex-row items-center justify-between px-5 pt-12 pb-4 border-b border-line shadow-hair z-10 bg-card">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
          <Ionicons name="arrow-back" size={24} color="#12100E" />
        </TouchableOpacity>
        <Text className="text-xl font-display text-ink">Leaderboard</Text>
        <View className="w-10" />
      </View>

      <View className="p-6 items-center bg-recruiter/10 border-b border-recruiter/15">
        <Ionicons name="trophy" size={48} color="#B45309" />
        <Text className="text-lg font-display text-ink mt-2">{getGameTitle()}</Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : leaderboard.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-ink-3">No scores yet. Be the first!</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item, index }) => (
            <View className="flex-row items-center bg-card p-4 mb-3 rounded-card shadow-hair border border-line">
              <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${index === 0 ? 'bg-warning/15' : index === 1 ? 'bg-paper-2' : index === 2 ? 'bg-brand-100' : 'bg-paper-2'}`}>
                <Text className={`font-semibold ${index === 0 ? 'text-warning' : index === 1 ? 'text-ink-3' : index === 2 ? 'text-accent-text' : 'text-ink-3'}`}>
                  #{index + 1}
                </Text>
              </View>
              
              <Image 
                source={{ uri: item.user?.avatar || "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" }} 
                className="w-12 h-12 rounded-full bg-paper-2"
              />
              
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-ink text-base">{item.user?.name}</Text>
                <Text className="text-ink-3 text-xs">@{item.user?.username}</Text>
              </View>

              <View className="items-end">
                <Text className="font-semibold text-recruiter text-lg">{item.highScore}</Text>
                <Text className="text-ink-3 text-label uppercase font-semibold">Score</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
};

export default GameLeaderboard;
