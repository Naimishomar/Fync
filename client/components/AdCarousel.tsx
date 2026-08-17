import React, { useState, useEffect, useRef } from "react";
import { View, FlatList, Image, useWindowDimensions, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import axios from "../context/axiosConfig";

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
      <View style={{ height: imageHeight }} className="items-center justify-center bg-slate-100">
        <ActivityIndicator color="#ff841fff" />
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
          <TouchableOpacity activeOpacity={item.linkUrl ? 0.85 : 1} onPress={() => handleAdPress(item)}>
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
              className={`h-2 rounded-full transition-all ${
                currentIndex === index ? "bg-orange-500 w-4" : "bg-white/60 w-2"
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default AdCarousel;
