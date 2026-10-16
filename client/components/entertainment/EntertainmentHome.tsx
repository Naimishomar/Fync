import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import {
  fetchEntertainmentHome,
  getImageUrl
} from '../../utils/tmdb';
import MovieCard from './MovieCard';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';

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
      <View className="flex-1 bg-ink justify-center items-center">
        <ActivityIndicator size="large" color={C.fam.fun} />
      </View>
    );
  }

  const renderSection = (title: string, data: any[], type: 'trending' | 'popular' | 'upcoming' | 'bollywood') => (
    <View className="mb-6">
      <View className="flex-row justify-between items-center px-5 mb-3">
        <Text className="text-white text-lg font-display">{title}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MovieList', { title, type })}>
          <Text className="text-danger font-medium">See All</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
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
    <SafeAreaView className="flex-1 bg-ink" edges={['bottom']}>
      <StatusBar barStyle="light-content" />
      <AppBar night title="Fync Cinema" onBack={() => navigation.goBack()}
        right={<IconBtn name="search-outline" color="white" onPress={() => navigation.navigate('MovieSearch')} />} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero Banner */}
        {featuredMovie && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('MovieDetail', { movieId: featuredMovie.id })}
            className="w-full h-[500px] mb-8"
          >
            <Image
              source={{ uri: getImageUrl(featuredMovie.poster_path, 'w780') || '' }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,1)']}
              className="absolute bottom-0 w-full h-1/2 justify-end px-5 pb-6"
            >
              <View className="items-center mb-4">
                <Text className="text-white text-3xl font-display text-center mb-2" numberOfLines={2}>
                  {featuredMovie.title}
                </Text>
                <View className="flex-row items-center gap-2">
                  <View
                    className="bg-danger px-2.5 py-1 border-2 border-ink"
                    style={{
                      borderRadius: 4, transform: [{ rotate: '-1.6deg' }],
                      shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0,
                      shadowOffset: { width: 2, height: 2 }, elevation: 0,
                    }}
                  >
                    <Text className="font-display text-white uppercase" style={{ fontSize: 10, letterSpacing: 1 }}>Trending</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color={C.warning} />
                    <Text className="text-white text-xs ml-1 font-semibold">{Number(featuredMovie.vote_average ?? 0).toFixed(1)}</Text>
                  </View>
                  <Text className="font-sans text-sm text-night-3">Movie</Text>
                </View>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => navigation.navigate('TrailerReels', { movies: trending, initialIndex: 0 })}
                  className="flex-1 bg-paper flex-row items-center justify-center py-3 rounded-lg"
                >
                  <Ionicons name="play" size={20} color="black" />
                  <Text className="text-ink font-semibold ml-2">Watch Trailers</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Categories / Moods (Quick filter) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-5 mb-8"
          contentContainerStyle={{ gap: 10 }}
        >
          {/* TMDB genre ids; "Anime" maps to TMDB's Animation genre. */}
          {([['Action', 28], ['Comedy', 35], ['Horror', 27], ['Drama', 18], ['Sci-Fi', 878], ['Anime', 16]] as const).map(([cat, genre]) => (
            <TouchableOpacity
              key={cat}
              onPress={() => navigation.navigate('MovieList', { title: cat, genre })}
              className="bg-ink px-6 py-2.5 rounded-full border border-ink"
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
