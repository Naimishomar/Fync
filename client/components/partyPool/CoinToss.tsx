import React, { useState, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const CoinToss = () => {
  const [result, setResult] = useState<'Heads' | 'Tails' | null>(null);
  const [flipping, setFlipping] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const tossCoin = () => {
    if (flipping) return;
    setFlipping(true);
    setResult(null);

    const newResult = Math.random() > 0.5 ? 'Heads' : 'Tails';

    Animated.sequence([
      Animated.timing(flipAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(flipAnim, { toValue: 0, duration: 0, useNativeDriver: true })
    ]).start(() => {
      setResult(newResult);
      setFlipping(false);
    });
  };

  const spin = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1800deg']
  });

  return (
    <View className="p-8 bg-white rounded-[40px] border border-[#F1F5F9] shadow-sm items-center" style={{ width: width - 40 }}>
      {/* Header */}
      <View className="items-center mb-[50px]">
        <Text className="text-2xl font-black text-[#1A1A1A] uppercase tracking-[-1px]">COIN <Text className="text-[#f97316]">TOSS</Text></Text>
        <Text className="text-[8px] text-[#94A3B8] font-black uppercase tracking-[2px] mt-1">Probability Engine v1.4</Text>
      </View>

      <View className="items-center mb-[50px]">
        <Animated.View className="w-[180px] h-[180px] rounded-full shadow-lg shadow-[#f97316]/40" style={{ transform: [{ rotateY: spin }] }}>
          <LinearGradient
            colors={['#f97316', '#fb923c', '#ea580c']}
            className="w-full h-full rounded-full justify-center items-center border-[8px] border-white/20"
          >
            <View className="w-[140px] h-[140px] rounded-full bg-white/10 justify-center items-center border border-white/30">
                <Ionicons 
                    name={result === 'Tails' ? "logo-bitcoin" : "flash"} 
                    size={60} 
                    color="rgba(255,255,255,0.9)" 
                />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Shadow */}
        <View className="w-[100px] h-[10px] bg-black/5 rounded-full mt-5 scale-x-[1.5]" />
      </View>
      
      <View className="h-20 justify-center mb-10">
        {result ? (
          <View className="items-center bg-[#F8FAFC] px-6 py-3 rounded-2xl border border-[#F1F5F9]">
            <Text className="text-[8px] font-black text-[#94A3B8] tracking-[1px] mb-1">OUTCOME DETECTED</Text>
            <Text className="text-[28px] font-black text-[#f97316]">{result.toUpperCase()}</Text>
          </View>
        ) : (
          <Text className="text-sm color-[#94A3B8] font-semibold italic">Awaiting Transmission...</Text>
        )}
      </View>

      <TouchableOpacity 
        onPress={tossCoin} 
        disabled={flipping}
        activeOpacity={0.8}
        className="w-full h-16 rounded-3xl overflow-hidden shadow-sm"
      >
        <LinearGradient
          colors={flipping ? ['#94A3B8', '#64748B'] : ['#1A1A1A', '#000']}
          className="flex-1 justify-center items-center"
        >
          <Text className="text-white text-sm font-black uppercase tracking-[2px]">{flipping ? 'FLIPPING...' : 'EXECUTE TOSS'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

export default CoinToss;
