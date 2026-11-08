import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { C } from '../../constants/colors';

/**
 * Two-column product card shared by the OLX market and the reward store:
 * square image, optional corner badge / cover note, name, price, footer slot.
 */
export const ProductTile = memo(function ProductTile({
  image, title, price, onPress, width, badge, cover, footer, contain,
}: {
  image?: string; title: string; price: string; onPress: () => void; width: number;
  badge?: string; cover?: string; footer?: React.ReactNode; contain?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${price}`}
      className="bg-card rounded-2xl overflow-hidden border border-line mb-3 active:opacity-70"
      style={{ width }}
    >
      <View className="bg-paper-2 items-center justify-center" style={{ aspectRatio: 1 }}>
        <ExpoImage
          source={{ uri: image }}
          style={contain ? { width: '85%', height: '85%' } : { width: '100%', height: '100%' }}
          contentFit={contain ? 'contain' : 'cover'}
          cachePolicy="memory-disk"
        />
        {badge ? (
          <View className="absolute bottom-2 left-2 bg-card px-2 py-0.5 rounded-full border border-line">
            <Text className="text-ink-2 text-xs font-medium capitalize">{badge}</Text>
          </View>
        ) : null}
        {cover ? (
          <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: C.scrim }}>
            <View className="bg-card px-3 py-1 rounded-full">
              <Text className="text-ink text-xs font-semibold">{cover}</Text>
            </View>
          </View>
        ) : null}
      </View>
      <View className="p-3" style={{ gap: 4 }}>
        <Text className="text-ink font-medium text-sm" numberOfLines={1}>{title}</Text>
        <Text className="text-ink font-semibold text-base">{price}</Text>
        {footer}
      </View>
    </Pressable>
  );
});
