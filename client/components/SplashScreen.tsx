import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

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
    <View className="flex-1 bg-[#F8FAFC]">
      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-40">
        <LinearGradient 
          colors={['#f97316', 'transparent']} 
          className="w-full h-full"
        />
      </View>
      <SafeAreaView className="flex-1 justify-center items-center">
        <Animated.Image
          source={require('../assets/Fync.png')}
          className="w-56 h-56 object-contain rounded-full bg-white border border-slate-100 shadow-xl shadow-orange-500/20"
          style={{ transform: [{ translateX: logoX }] }}
        />
        <Animated.Text
          className="text-lg font-bold text-slate-900 mt-5 tracking-[2px] uppercase"
          style={{ transform: [{ translateX: textX }] }}
        >
          Simplifying Students Life
        </Animated.Text>
      </SafeAreaView>
    </View>
  );
}
