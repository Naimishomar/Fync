import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchPopularMovies, fetchTrendingMovies, fetchUpcomingMovies, fetchBollywoodMovies, fetchMoviesByGenre } from '../../utils/tmdb';
import MovieCard from './MovieCard';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';

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
  const { title, type, genre } = route.params ?? {};

  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('all');

  useEffect(() => {
    loadMovies();
  }, []);

  const filteredMovies = useMemo(
    () => (selectedGenre === 'all' ? movies : movies.filter(m => m.genre_ids?.includes(selectedGenre))),
    [selectedGenre, movies],
  );

  const loadMovies = async () => {
    try {
      let data;
      if (genre) data = await fetchMoviesByGenre(genre);
      else if (type === 'trending') data = await fetchTrendingMovies();
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
    <SafeAreaView className="flex-1 bg-night" edges={['bottom']}>
      {/* Header */}
      <AppBar night title={title} onBack={() => navigation.goBack()}
        right={<IconBtn name="search" size={24} color="white" accessibilityLabel="Search movies" onPress={() => navigation.navigate('MovieSearch')} />} />

      {/* Genre Filters — pointless on a list that is already one genre. */}
      {!genre && <View className="mb-4">
        <ScrollView keyboardShouldPersistTaps="handled" 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        >
          {GENRES.map((genre: any) => (
            <Pressable
              key={genre.id}
              onPress={() => setSelectedGenre(genre.id)}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedGenre === genre.id }}
              className={`mr-2 px-4 h-9 justify-center rounded-full border active:opacity-85 ${selectedGenre === genre.id ? 'bg-brand-500 border-brand-500' : 'bg-white/10 border-white/15'}`}
            >
              <Text className={`text-sm font-medium ${selectedGenre === genre.id ? 'text-on-brand' : 'text-white/80'}`}>
                {genre.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>}

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={C.fam.fun} />
        </View>
      ) : (
        <View className="flex-1">
          <FlatList keyboardShouldPersistTaps="handled"
            data={filteredMovies}
            numColumns={numColumns}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: SPACING }}
            renderItem={({ item }) => (
              <View style={{ margin: SPACING / 2 }}>
                <MovieCard
                  item={item}
                  width={cardWidth}
                  height={cardWidth * 1.5}
                  marginRight={0}
                  onPress={() => navigation.navigate('MovieDetail', { movieId: item.id })}
                />
              </View>
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center mt-20">
                <Ionicons name="film-outline" size={48} color="rgba(255,255,255,0.4)" />
                <Text className="text-white/70 mt-4 text-base font-semibold">No movies found in this category</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

export default MovieList;
