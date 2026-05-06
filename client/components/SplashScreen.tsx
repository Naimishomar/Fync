import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
//@ts-ignore
import LogoImage from '../assets/Fync.png';
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
    <SafeAreaView className="flex-1 bg-white justify-center items-center">
      <Animated.Image
        source={LogoImage}
        className="w-56 h-56 object-contain rounded-full"
        style={{ transform: [{ translateX: logoX }] }}
      />
      <Animated.Text
        className="text-md font-bold text-red-400  mt-5"
        style={{ transform: [{ translateX: textX }] }}
      >
        Simplifying Students Life
      </Animated.Text>
    </SafeAreaView>
  );
}
