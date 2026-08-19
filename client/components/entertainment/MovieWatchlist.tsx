import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchTrendingMovies } from '../../utils/tmdb';
import MovieCard from './MovieCard';

const { width } = Dimensions.get('window');
const numColumns = 3;
const cardWidth = (width - 48) / numColumns;

const WATCHLIST_KEY = '@fync_movie_watchlist';

const MovieWatchlist = () => {
  const navigation = useNavigation<any>();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      setLoading(true);
      const stored = await AsyncStorage.getItem(WATCHLIST_KEY);
      if (stored) {
        setWatchlist(JSON.parse(stored));
      } else {
        // Fallback for demo: show trending if watchlist is empty
        const trending = await fetchTrendingMovies();
        setWatchlist(trending.slice(0, 6));
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">My <Text className="text-rose-600">Watchlist</Text></Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#e11d48" />
        </View>
      ) : (
        <FlatList
          data={watchlist}
          numColumns={numColumns}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={{ margin: 6 }}>
              <MovieCard
                item={item}
                width={cardWidth}
                height={cardWidth * 1.5}
                onPress={() => navigation.navigate('MovieDetail', { movieId: item.id })}
              />
            </View>
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center mt-20">
              <Ionicons name="bookmark-outline" size={64} color="#1f2937" />
              <Text className="text-slate-500 mt-4 text-lg">Your watchlist is empty</Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('EntertainmentHome')}
                className="mt-6 bg-rose-600 px-8 py-3 rounded-full"
              >
                <Text className="text-white font-bold">Discover Movies</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default MovieWatchlist;
