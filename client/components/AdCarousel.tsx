import React, { useState, useEffect, useRef } from "react";
import { View, FlatList, Image, useWindowDimensions, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import axios from "../context/axiosConfig";

import { StampCard } from './ui/kit';
const AdCarousel = () => {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const imageHeight = isTablet ? 224 : 132;

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
        <ActivityIndicator color="#F97316" />
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
          // Home's hero slot, so it carries the screen's one stamp. Inset to the
          // 20px gutter rather than full-bleed, so it lines up with the feed
          // cards and the section rules underneath it.
          <TouchableOpacity
            activeOpacity={item.linkUrl ? 0.85 : 1}
            onPress={() => handleAdPress(item)}
            accessibilityRole={item.linkUrl ? 'link' : 'image'}
            accessibilityLabel={item.title || 'Sponsored'}
            style={{ width, paddingHorizontal: 20, paddingTop: 8 }}
          >
            <StampCard>
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: width - 44, height: imageHeight }}
                resizeMode="cover"
              />
            </StampCard>
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
