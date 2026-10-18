import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getImageUrl } from '../../utils/tmdb';
import { C } from '../../constants/colors';

interface MovieCardProps {
  item: any;
  onPress: () => void;
  width?: number;
  height?: number;
  /** Gap after the card in a horizontal rail. Grids space cells themselves and pass 0. */
  marginRight?: number;
}

const MovieCard: React.FC<MovieCardProps> = ({ item, onPress, width = 140, height = 210, marginRight = 12 }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{ width, height, marginRight }}
      className="rounded-xl overflow-hidden bg-night shadow-hair"
    >
      <Image
        source={{ uri: getImageUrl(item.poster_path, 'w342') || '' }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={String(item.id)}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        className="absolute bottom-0 w-full p-2"
      >
        <View className="flex-row justify-between items-end">
          <View className="flex-1 mr-1">
            <Text className="text-white text-label font-semibold" numberOfLines={1}>
              {item.title}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <Ionicons name="star" size={10} color={C.warning} />
              <Text className="text-night-ink/80 text-label ml-1">{Number(item.vote_average ?? 0).toFixed(1)}</Text>
            </View>
          </View>
          <View className="bg-danger/80 rounded-full p-1">
            <Ionicons name="play" size={10} color="white" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

export default React.memo(MovieCard);
