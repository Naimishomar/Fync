import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  fetchEntertainmentHome,
  getImageUrl
} from '../../utils/tmdb';
import MovieCard from './MovieCard';

const { width } = Dimensions.get('window');

const EntertainmentHome = () => {
  const navigation = useNavigation<any>();
  const [trending, setTrending] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [topRated, setTopRated] = useState<any[]>([]);
  const [bollywoodMovies, setBollywoodMovies] = useState<any[]>([]);
  const [actionMovies, setActionMovies] = useState<any[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredMovie, setFeaturedMovie] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchEntertainmentHome();
      
      setTrending(data.trending || []);
      setPopular(data.popular || []);
      setUpcoming(data.upcoming || []);
      setTopRated(data.topRated || []);
      setBollywoodMovies(data.bollywood || []);
      setActionMovies(data.action || []);
      setHorrorMovies(data.horror || []);
      
      if (data.trending && data.trending.length > 0) {
        setFeaturedMovie(data.trending[0]);
      }
    } catch (error) {
      console.error('Error fetching movies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  const renderSection = (title: string, data: any[], type: 'trending' | 'popular' | 'upcoming' | 'bollywood') => (
    <View className="mb-6">
      <View className="flex-row justify-between items-center px-4 mb-3">
        <Text className="text-white text-lg font-bold">{title}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MovieList', { title, type })}>
          <Text className="text-rose-500 font-medium">See All</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <MovieCard
            item={item}
            onPress={() => navigation.navigate('MovieDetail', { movieId: item.id })}
          />
        )}
        contentContainerStyle={{ paddingLeft: 16 }}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* Header */}
        <View className="flex-row justify-between items-center px-4 py-3 bg-black">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-2xl font-bold tracking-tighter">Fync <Text className="text-rose-600">Cinema</Text></Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => navigation.navigate('MovieSearch')}>
              <Ionicons name="search-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Banner */}
        {featuredMovie && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('MovieDetail', { movieId: featuredMovie.id })}
            className="w-full h-[500px] mb-8"
          >
            <Image
              source={{ uri: getImageUrl(featuredMovie.poster_path, 'original') || '' }}
              className="w-full h-full"
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,1)']}
              className="absolute bottom-0 w-full h-1/2 justify-end px-6 pb-6"
            >
              <View className="items-center mb-4">
                <Text className="text-white text-3xl font-bold text-center mb-2" numberOfLines={2}>
                  {featuredMovie.title}
                </Text>
                <View className="flex-row items-center gap-2">
                  <View className="bg-rose-600 px-2 py-0.5 rounded">
                    <Text className="text-white text-2xs font-bold">TRENDING</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color="#fbbf24" />
                    <Text className="text-white text-xs ml-1 font-bold">{featuredMovie.vote_average.toFixed(1)}</Text>
                  </View>
                  <Text className="text-slate-500 text-xs">Movie</Text>
                </View>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => navigation.navigate('TrailerReels', { movies: trending, initialIndex: 0 })}
                  className="flex-1 bg-white flex-row items-center justify-center py-3 rounded-lg"
                >
                  <Ionicons name="play" size={20} color="black" />
                  <Text className="text-black font-bold ml-2">Watch Trailers</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Categories / Moods (Quick filter) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 mb-8"
          contentContainerStyle={{ gap: 10 }}
        >
          {['Action', 'Comedy', 'Horror', 'Drama', 'Sci-Fi', 'Anime'].map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => navigation.navigate('MovieList', { title: cat, type: 'trending' })}
              className="bg-slate-800 px-6 py-2.5 rounded-full border border-slate-700"
            >
              <Text className="text-white font-medium text-sm">{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Horizontal Sections */}
        {renderSection('Trending Now', trending, 'trending')}
        {renderSection('Bollywood Cinema', bollywoodMovies, 'bollywood')}
        {renderSection('Most Popular', popular, 'popular')}
        {renderSection('Top Rated', topRated, 'trending')}
        {renderSection('Action Thrillers', actionMovies, 'trending')}
        {renderSection('Chilling Horror', horrorMovies, 'trending')}
        {renderSection('Coming Soon', upcoming, 'upcoming')}

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default EntertainmentHome;
