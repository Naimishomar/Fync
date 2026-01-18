import React, { useEffect, useRef } from 'react';
import { Image, Text, Animated } from 'react-native';
import LogoImage from '../assets/logo.png';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplashScreen({ navigation }) {
  const logoX = useRef(new Animated.Value(-200)).current;
  const textX = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
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

    const timer = setTimeout(() => {
      navigation.replace('Tabs');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-black justify-center items-center">
      <Animated.Image
        source={LogoImage}
        className="w-56 h-28 object-contain"
        style={{ transform: [{ translateX: logoX }] }}
      />
      <Animated.Text
        className="text-md font-bold text-red-400 italic"
        style={{ transform: [{ translateX: textX }] }}
      >
        Simplifying Students Life
      </Animated.Text>
    </SafeAreaView>
  );
}
