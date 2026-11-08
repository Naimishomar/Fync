import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native';
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
      <View className="flex-1 bg-night justify-center items-center">
        <ActivityIndicator size="large" color={C.fam.fun} />
      </View>
    );
  }

  // A failed fetch used to fall through to `movie.release_date` on null and crash.
  if (!movie) {
    return (
      <View className="flex-1 bg-night">
        <AppBar night title="Movie" onBack={() => navigation.goBack()} />
        <Empty icon="film-outline" title="Couldn't load this movie" hint="Check your connection and try again." />
      </View>
    );
  }

  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';

  return (
    <View className="flex-1 bg-night">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="flex-1">
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
          
          {/* Action Buttons Overlay */}
          <View className="absolute bottom-6 w-full px-gutter">
            <Text className="text-white text-3xl font-display mb-2" accessibilityRole="header">{movie.title}</Text>
            <View className="flex-row items-center gap-3 mb-6">
              <View className="flex-row items-center">
                <Ionicons name="star" size={16} color={C.warning} />
                <Text className="text-white text-sm ml-1 font-semibold">{Number(movie.vote_average ?? 0).toFixed(1)}</Text>
              </View>
              <Text className="text-white/60">•</Text>
              <Text className="text-white/60 text-sm font-medium">{releaseYear}</Text>
              <Text className="text-white/60">•</Text>
              <Text className="text-white/60 text-sm font-medium">{runtime}</Text>
            </View>

            <View className="flex-row gap-4">
              <Pressable
                onPress={() => navigation.navigate('TrailerReels', { movies: [movie] })}
                className="flex-1 bg-danger flex-row items-center justify-center min-h-[48px] rounded-full active:opacity-85"
                accessibilityRole="button"
              >
                <Ionicons name="play" size={20} color={C.paper} />
                <Text className="text-paper font-semibold ml-2 text-base">Play trailer</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Details Section */}
        <View className="px-gutter py-6">
          <Text className="text-white text-base font-semibold mb-2" accessibilityRole="header">Overview</Text>
          <Text className="text-white/70 leading-6 text-base mb-6">
            {movie.overview}
          </Text>

          {/* More Like This */}
          <View className="mb-10">
            <Text className="text-white text-base font-semibold mb-3" accessibilityRole="header">More like this</Text>
            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false}>
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

      {/* Header Controls — outside the scroll so they stay put */}
      <View className="absolute top-0 w-full" pointerEvents="box-none">
        <AppBar overlay onBack={() => navigation.goBack()}
          right={<IconBtn overlay name="share-outline" size={24} accessibilityLabel="Share movie" onPress={handleShare} />} />
      </View>
    </View>
  );
};

export default MovieDetail;
