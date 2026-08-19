import React from 'react';
import { TouchableOpacity, Image, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getImageUrl } from '../../utils/tmdb';

interface MovieCardProps {
  item: any;
  onPress: () => void;
  width?: number;
  height?: number;
}

const MovieCard: React.FC<MovieCardProps> = ({ item, onPress, width = 140, height = 210 }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{ width, height, marginRight: 12 }}
      className="rounded-xl overflow-hidden bg-slate-900 shadow-xl"
    >
      <Image
        source={{ uri: getImageUrl(item.poster_path, 'w342') || '' }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        className="absolute bottom-0 w-full p-2"
      >
        <View className="flex-row justify-between items-end">
          <View className="flex-1 mr-1">
            <Text className="text-white text-2xs font-bold" numberOfLines={1}>
              {item.title}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <Ionicons name="star" size={10} color="#fbbf24" />
              <Text className="text-slate-300 text-2xs ml-1">{item.vote_average.toFixed(1)}</Text>
            </View>
          </View>
          <View className="bg-rose-600/80 rounded-full p-1">
            <Ionicons name="play" size={10} color="white" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

export default MovieCard;
