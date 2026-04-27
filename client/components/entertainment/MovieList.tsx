import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchPopularMovies, fetchTrendingMovies, fetchUpcomingMovies, fetchBollywoodMovies, getImageUrl } from '../../utils/tmdb';
import MovieCard from './MovieCard';

const { width } = Dimensions.get('window');
const numColumns = 3;
const SPACING = 8;
const cardWidth = (width - (SPACING * (numColumns + 1))) / numColumns;

const GENRES = [
// ... existing genres ...
  { id: 'all', name: 'All' },
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
  { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
];

const MovieList = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { title, type } = route.params;

  const [movies, setMovies] = useState<any[]>([]);
  const [filteredMovies, setFilteredMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('all');

  useEffect(() => {
    loadMovies();
  }, []);

  useEffect(() => {
    if (selectedGenre === 'all') {
      setFilteredMovies(movies);
    } else {
      setFilteredMovies(movies.filter(m => m.genre_ids?.includes(selectedGenre)));
    }
  }, [selectedGenre, movies]);

  const loadMovies = async () => {
    try {
      let data;
      if (type === 'trending') data = await fetchTrendingMovies();
      else if (type === 'popular') data = await fetchPopularMovies();
      else if (type === 'upcoming') data = await fetchUpcomingMovies();
      else if (type === 'bollywood') data = await fetchBollywoodMovies();
      
      setMovies(data || []);
    } catch (error) {
      console.error('Error loading movies:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">{title}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('MovieSearch')}>
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Genre Filters */}
      <View className="mb-4">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {GENRES.map((genre: any) => (
            <TouchableOpacity
              key={genre.id}
              onPress={() => setSelectedGenre(genre.id)}
              className={`mr-3 px-6 py-2 rounded-full border ${
                selectedGenre === genre.id 
                  ? 'bg-rose-600 border-rose-600' 
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <Text className={`font-bold ${
                selectedGenre === genre.id ? 'text-white' : 'text-gray-400'
              }`}>
                {genre.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#e11d48" />
        </View>
      ) : (
        <View className="flex-1">
          <FlatList
            data={filteredMovies}
            numColumns={numColumns}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ padding: SPACING }}
            renderItem={({ item }) => (
              <View style={{ margin: SPACING / 2 }}>
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
                <Ionicons name="film-outline" size={64} color="#1f2937" />
                <Text className="text-gray-500 mt-4 text-lg">No movies found in this category</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

export default MovieList;
