import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { AppBar, Empty, IconTile } from '../ui/kit';
import { useBottomInset } from '../../constants/layout';

const PLACEHOLDER = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

const ScoreRow = React.memo(function ScoreRow({ item, index }: { item: any; index: number }) {
  return (
    <View className="flex-row items-center bg-card p-4 mb-3 rounded-2xl border border-line">
      <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${index === 0 ? 'bg-warning/15' : index === 2 ? 'bg-brand-100' : 'bg-paper-2'}`}>
        <Text className={`font-semibold ${index === 0 ? 'text-warning' : index === 2 ? 'text-accent-text' : 'text-ink-3'}`}>
          #{index + 1}
        </Text>
      </View>
      <Image
        source={{ uri: item.user?.avatar || PLACEHOLDER }}
        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.paper2 }}
        cachePolicy="memory-disk"
      />
      <View className="ml-3 flex-1">
        <Text className="font-semibold text-ink text-base" numberOfLines={1}>{item.user?.name || 'Player'}</Text>
        <Text className="text-ink-3 text-xs" numberOfLines={1}>@{item.user?.username}</Text>
      </View>
      <View className="items-end">
        <Text className="font-display text-ink text-lg">{item.highScore}</Text>
        <Text className="text-ink-3 text-xs font-semibold">Score</Text>
      </View>
    </View>
  );
});
const renderRow = ({ item, index }: { item: any; index: number }) => <ScoreRow item={item} index={index} />;
const keyOf = (item: any) => item._id;

const GameLeaderboard = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const bottomInset = useBottomInset();
  const gameName = route.params?.gameName || "FlappyBird"; // Default to FlappyBird

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [gameName]);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`/games/leaderboard/${gameName}`);
      setLeaderboard(res.data?.leaderboard ?? []);
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    } finally {
      setLoading(false);
    }
  };

  const getGameTitle = () => {
    if (route.params?.title) return route.params.title;
    return gameName === "FlappyBird" ? "Flappy Bird High Scores" : "Draw & Guess Champions";
  };

  return (
    <View className="flex-1 bg-paper">
      <AppBar title="Leaderboard" onBack={() => navigation.goBack()} />

      <View className="px-gutter pt-2 pb-5 items-center border-b border-line">
        <IconTile icon="trophy-outline" size={56} iconSize={26} color={C.warning} />
        <Text className="text-lg font-display text-ink mt-3" accessibilityRole="header">{getGameTitle()}</Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={C.brand[500]} />
        </View>
      ) : leaderboard.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Empty icon="trophy-outline" title="No scores yet" hint="Be the first to set one." />
        </View>
      ) : (
        <FlatList keyboardShouldPersistTaps="handled"
          data={leaderboard}
          keyExtractor={keyOf}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 + bottomInset }}
          renderItem={renderRow}
        />
      )}
    </View>
  );
};

export default GameLeaderboard;
