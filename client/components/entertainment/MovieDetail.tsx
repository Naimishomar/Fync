import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchMovieDetails, getImageUrl } from '../../utils/tmdb';
import MovieCard from './MovieCard';

const MovieDetail = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { movieId } = route.params;

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
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';

  return (
    <View className="flex-1 bg-black">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Banner Section */}
        <View className="h-[450px] relative">
          <Image
            source={{ uri: getImageUrl(movie.poster_path, 'original') || '' }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,1)']}
            className="absolute top-0 w-full h-full"
          />
          
          {/* Header Controls */}
          <SafeAreaView className="absolute top-0 w-full flex-row justify-between items-center px-4" edges={['top']}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              className="w-10 h-10 bg-black/40 rounded-full items-center justify-center border border-white/10"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleShare}
              className="w-10 h-10 bg-black/40 rounded-full items-center justify-center border border-white/10"
            >
              <Ionicons name="share-outline" size={24} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Action Buttons Overlay */}
          <View className="absolute bottom-6 w-full px-6">
            <Text className="text-white text-3xl font-bold mb-2 shadow-lg">{movie.title}</Text>
            <View className="flex-row items-center gap-3 mb-6">
              <View className="flex-row items-center">
                <Ionicons name="star" size={16} color="#fbbf24" />
                <Text className="text-white text-sm ml-1 font-bold">{movie.vote_average.toFixed(1)}</Text>
              </View>
              <Text className="text-slate-500">•</Text>
              <Text className="text-slate-500 text-sm font-medium">{releaseYear}</Text>
              <Text className="text-slate-500">•</Text>
              <Text className="text-slate-500 text-sm font-medium">{runtime}</Text>
            </View>

            <View className="flex-row gap-4">
              <TouchableOpacity 
                onPress={() => navigation.navigate('TrailerReels', { movies: [movie] })}
                className="flex-1 bg-rose-600 flex-row items-center justify-center py-4 rounded-xl shadow-lg shadow-rose-600/50"
              >
                <Ionicons name="play" size={20} color="white" />
                <Text className="text-white font-bold ml-2 text-lg">Play Trailer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Details Section */}
        <View className="px-6 py-6">
          <Text className="text-white text-xl font-bold mb-3">Overview</Text>
          <Text className="text-slate-500 leading-6 text-base mb-8">
            {movie.overview}
          </Text>

          {/* More Like This */}
          <View className="mb-10">
            <Text className="text-white text-xl font-bold mb-4">More Like This</Text>
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
