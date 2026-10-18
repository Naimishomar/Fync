import React, { useState, useEffect, useMemo } from 'react';
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
        right={<IconBtn name="search" size={24} color="white" onPress={() => navigation.navigate('MovieSearch')} />} />

      {/* Genre Filters — pointless on a list that is already one genre. */}
      {!genre && <View className="mb-4">
        <ScrollView keyboardShouldPersistTaps="handled" 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        >
          {GENRES.map((genre: any) => (
            <TouchableOpacity
              key={genre.id}
              onPress={() => setSelectedGenre(genre.id)}
              className={`mr-3 px-6 py-2 rounded-full border ${ selectedGenre === genre.id ? 'bg-danger border-danger' : 'bg-night border-night' }`}
            >
              <Text className={`font-semibold ${ selectedGenre === genre.id ? 'text-white' : 'text-ink-3' }`}>
                {genre.name}
              </Text>
            </TouchableOpacity>
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
                <Ionicons name="film-outline" size={64} color={C.ink2} />
                <Text className="text-ink-3 mt-4 text-lg">No movies found in this category</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

export default MovieList;
