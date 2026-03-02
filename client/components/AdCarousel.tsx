import React, { useState, useEffect, useRef } from "react";
import { View, FlatList, Image, useWindowDimensions } from "react-native";

const AD_IMAGES = [
  "https://assets.amazon.science/dims4/default/f7671f9/2147483647/strip/true/crop/1920x1008+0+36/resize/1200x630!/quality/90/?url=http%3A%2F%2Famazon-topics-brightspot.s3.amazonaws.com%2Fscience%2F38%2F85%2Faeb6c08f4768a06999974c8ad0e%2Famazonnovaaichallenge-dark-16x9.jpg",
  "https://blog.swiggy.com/wp-content/uploads/2023/10/Post-Order-Blog-Banner-1000x486.jpeg",
  "https://carousels-ads.swiggy.com/images/slider/2.jpg",
];

const AdCarousel = () => {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const imageHeight = isTablet ? 224 : 132;

  useEffect(() => {
    const interval = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= AD_IMAGES.length) {
        nextIndex = 0;
      }

      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      
      setCurrentIndex(nextIndex);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentIndex]);

  const onScrollEnd = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={AD_IMAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: width, height: imageHeight }} 
            resizeMode="cover"
          />
        )}
      />
      
      <View className="absolute bottom-3 w-full flex-row justify-center gap-2">
        {AD_IMAGES.map((_, index) => (
          <View
            key={index}
            className={`h-2 w-2 rounded-full ${
              currentIndex === index ? "bg-pink-500 w-4" : "bg-white/50"
            }`}
          />
        ))}
      </View>
    </View>
  );
};

export default AdCarousel;