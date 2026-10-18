import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { searchMovies } from '../../utils/tmdb';
import MovieCard from './MovieCard';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

const { width } = Dimensions.get('window');
const numColumns = 3;
// 12px list padding each side + 6px margin each side of every cell.
const cardWidth = (width - 24 - 12 * numColumns) / numColumns;

const MovieSearch = () => {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Only the newest search may write results; a slow older one is dropped.
  const latest = useRef(0);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length > 2) {
        performSearch(query);
      } else {
        latest.current++;
        setResults([]);
        setLoading(false);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async (text: string) => {
    const id = ++latest.current;
    setLoading(true);
    try {
      const data = await searchMovies(text);
      if (id === latest.current) setResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      if (id === latest.current) setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-night" edges={['bottom']}>
      <AppBar night title="Search Movies" onBack={() => navigation.goBack()} />
      <View className="px-5 pb-4">
        <View className="flex-1 bg-night rounded-full flex-row items-center px-4 py-2 border border-night">
          <Ionicons name="search" size={20} color={C.night3} />
          <TextInput
            autoFocus
            placeholder="Search movies, trailers..."
            placeholderTextColor={C.ink3}
            className="flex-1 ml-2 text-white text-base"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={12}>
              <Ionicons name="close-circle" size={20} color={C.night3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={C.fam.fun} />
        </View>
      ) : (
        <FlatList
          data={results}
          numColumns={numColumns}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <View style={{ margin: 6 }}>
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
            query.length > 2 ? (
              <View className="flex-1 items-center mt-20">
                <Ionicons name="film-outline" size={64} color={C.ink2} />
                <Text className="text-ink-3 mt-4 text-lg">No movies found for "{query}"</Text>
              </View>
            ) : (
              <View className="flex-1 items-center mt-20">
                <Ionicons name="search-outline" size={64} color={C.ink2} />
                <Text className="text-ink-3 mt-4 text-lg text-center px-gutter">
                  Search for your favorite movies and watch their trailers.
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
};

export default MovieSearch;
