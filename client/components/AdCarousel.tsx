import React, { useState, useEffect, useRef } from "react";
import { View, FlatList, Image, useWindowDimensions, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import axios from "../context/axiosConfig";
import { C } from '../constants/colors';

const AdCarousel = () => {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  // Edge-to-edge poster, but capped: 168 ate a third of a phone viewport
  // before the feed started. 16:9 keeps it a banner, not a screen.
  const imageHeight = isTablet ? 220 : Math.round(width * 0.30);

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      const res = await axios.get("/ads");
      if (res.data.success && res.data.ads.length > 0) {
        setAds(res.data.ads);
      }
    } catch (error) {
      console.error("AdCarousel fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= ads.length) nextIndex = 0;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentIndex, ads.length]);

  const onScrollEnd = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  const handleAdPress = (ad: any) => {
    if (ad.linkUrl) {
      Linking.openURL(ad.linkUrl).catch(() => {});
    }
  };

  if (loading) {
    return (
      <View style={{ height: imageHeight }} className="items-center justify-center bg-paper-2">
        <ActivityIndicator color={C.brand[500]} />
      </View>
    );
  }

  if (ads.length === 0) return null;

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={ads}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          // Full-bleed. The gutter, the stamp and its 4px offset are all gone:
          // each of those reserved horizontal space, and an inset banner with a
          // border reads as a card rather than as the poster it is.
          <TouchableOpacity
            activeOpacity={item.linkUrl ? 0.85 : 1}
            onPress={() => handleAdPress(item)}
            accessibilityRole={item.linkUrl ? 'link' : 'image'}
            accessibilityLabel={item.title || 'Sponsored'}
            style={{ width }}
          >
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width, height: imageHeight }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      />

      {/* Dot indicators */}
      {ads.length > 1 && (
        <View className="absolute bottom-3 w-full flex-row justify-center gap-2">
          {ads.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full transition-all ${ currentIndex === index ? "bg-brand-500 w-4" : "bg-card/60 w-2" }`}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default AdCarousel;
