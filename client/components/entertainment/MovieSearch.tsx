import React, { useState, useEffect, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { searchMovies } from '../../utils/tmdb';
import MovieCard from './MovieCard';

const { width } = Dimensions.get('window');
const numColumns = 3;
const cardWidth = (width - 48) / numColumns;

const MovieSearch = () => {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length > 2) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async (text: string) => {
    setLoading(true);
    try {
      const data = await searchMovies(text);
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="px-4 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1 bg-slate-900 rounded-full flex-row items-center px-4 py-2 border border-slate-800">
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            autoFocus
            placeholder="Search movies, trailers..."
            placeholderTextColor="#6b7280"
            className="flex-1 ml-2 text-white text-base"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#e11d48" />
        </View>
      ) : (
        <FlatList
          data={results}
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
            query.length > 2 ? (
              <View className="flex-1 items-center mt-20">
                <Ionicons name="film-outline" size={64} color="#1f2937" />
                <Text className="text-slate-500 mt-4 text-lg">No movies found for "{query}"</Text>
              </View>
            ) : (
              <View className="flex-1 items-center mt-20">
                <Ionicons name="search-outline" size={64} color="#1f2937" />
                <Text className="text-slate-500 mt-4 text-lg text-center px-10">
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
