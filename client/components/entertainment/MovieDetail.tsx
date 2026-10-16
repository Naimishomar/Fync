import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchMovieDetails, getImageUrl } from '../../utils/tmdb';
import MovieCard from './MovieCard';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Empty } from '../ui/kit';

const MovieDetail = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const movieId = route.params?.movieId;

  const [movie, setMovie] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovieDetails();
  }, [movieId]);

  const loadMovieDetails = async () => {
    try {
      setLoading(true);
      const data = await fetchMovieDetails(movieId);
      setMovie(data);
    } catch (error) {
      console.error('Error fetching movie details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!movie) return;
    try {
      const shareUrl = `https://fync-api.duckdns.org/movie?id=${movie.id}`;
      await Share.share({
        message: `Check out the trailer for ${movie.title} on Fync!\n\n${movie.overview}\n\nWatch here: ${shareUrl}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-ink justify-center items-center">
        <ActivityIndicator size="large" color={C.fam.fun} />
      </View>
    );
  }

  // A failed fetch used to fall through to `movie.release_date` on null and crash.
  if (!movie) {
    return (
      <SafeAreaView className="flex-1 bg-ink" edges={['top']}>
        <AppBar night onBack={() => navigation.goBack()} />
        <Empty icon="film-outline" title="Couldn't load this movie" hint="Check your connection and try again." />
      </SafeAreaView>
    );
  }

  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';

  return (
    <View className="flex-1 bg-ink">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Banner Section */}
        <View className="h-[450px] relative">
          <Image
            source={{ uri: getImageUrl(movie.poster_path, 'w780') || '' }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,1)']}
            className="absolute top-0 w-full h-full"
          />
          
          {/* Header Controls */}
          <SafeAreaView className="absolute top-0 w-full" edges={['top']}>
            <AppBar overlay onBack={() => navigation.goBack()}
              right={<IconBtn overlay name="share-outline" size={24} onPress={handleShare} />} />
          </SafeAreaView>

          {/* Action Buttons Overlay */}
          <View className="absolute bottom-6 w-full px-5">
            <Text className="text-white text-3xl font-display mb-2 shadow-hair">{movie.title}</Text>
            <View className="flex-row items-center gap-3 mb-6">
              <View className="flex-row items-center">
                <Ionicons name="star" size={16} color={C.warning} />
                <Text className="text-white text-sm ml-1 font-semibold">{Number(movie.vote_average ?? 0).toFixed(1)}</Text>
              </View>
              <Text className="text-ink-3">•</Text>
              <Text className="text-ink-3 text-sm font-medium">{releaseYear}</Text>
              <Text className="text-ink-3">•</Text>
              <Text className="text-ink-3 text-sm font-medium">{runtime}</Text>
            </View>

            <View className="flex-row gap-4">
              <TouchableOpacity 
                onPress={() => navigation.navigate('TrailerReels', { movies: [movie] })}
                className="flex-1 bg-danger flex-row items-center justify-center py-4 rounded-xl shadow-hair"
              >
                <Ionicons name="play" size={20} color="white" />
                <Text className="text-white font-display ml-2 text-lg">Play Trailer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Details Section */}
        <View className="px-5 py-6">
          <Text className="text-white text-xl font-display mb-3">Overview</Text>
          <Text className="text-ink-3 leading-6 text-base mb-8">
            {movie.overview}
          </Text>

          {/* More Like This */}
          <View className="mb-10">
            <Text className="text-white text-xl font-display mb-4">More Like This</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {movie.similar?.results?.map((item: any) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  onPress={() => navigation.push('MovieDetail', { movieId: item.id })}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default MovieDetail;
