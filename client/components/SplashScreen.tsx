import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

let animationStarted = false;

export default function SplashScreen({ navigation }: any) {
  const logoX = useRef(new Animated.Value(animationStarted ? 0 : -200)).current;
  const textX = useRef(new Animated.Value(animationStarted ? 0 : -200)).current;

  useEffect(() => {
    if (!animationStarted) {
      animationStarted = true;
      Animated.parallel([
        Animated.timing(logoX, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textX, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }

    const timer = setTimeout(() => {
      if (navigation) {
        navigation.replace('Tabs');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 bg-paper">
      {/* HEADER DECORATION */}
      <SafeAreaView className="flex-1 justify-center items-center">
        <Animated.Image
          source={require('../assets/Fync.png')}
          className="w-56 h-56 object-contain rounded-full bg-card border border-line shadow-hair"
          style={{ transform: [{ translateX: logoX }] }}
        />
        <Animated.Text
          className="text-lg font-display text-ink mt-5 uppercase"
          style={{ transform: [{ translateX: textX }] }}
        >
          Simplifying Students Life
        </Animated.Text>
      </SafeAreaView>
    </View>
  );
}
