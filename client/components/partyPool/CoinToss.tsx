import React, { useState, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

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
    <View className="p-card-pad bg-card rounded-sheet border border-paper-2 shadow-hair items-center" style={{ width: width - 40 }}>
      {/* Header */}
      <View className="items-center mb-[50px]">
        <Text className="text-2xl font-display text-ink uppercase">COIN <Text className="text-brand-500">TOSS</Text></Text>
        <Text className="text-label text-ink-3 font-display uppercase mt-1">Probability Engine v1.4</Text>
      </View>

      <View className="items-center mb-[50px]">
        <Animated.View className="w-[180px] h-[180px] rounded-full shadow-hair shadow-[#F97316]" style={{ transform: [{ rotateY: spin }] }}>
          <View
            className="w-full h-full rounded-full justify-center items-center border-[8px] border-white/20"
           style={{ backgroundColor: '#F97316' }}>
            <View className="w-[140px] h-[140px] rounded-full bg-card/10 justify-center items-center border border-white/30">
                <Ionicons 
                    name={result === 'Tails' ? "logo-bitcoin" : "flash"} 
                    size={60} 
                    color="rgba(255,255,255,0.9)" 
                />
            </View>
          </View>
        </Animated.View>

        {/* Shadow */}
        <View className="w-[100px] h-[10px] bg-black/5 rounded-full mt-5 scale-x-[1.5]" />
      </View>
      
      <View className="h-20 justify-center mb-10">
        {result ? (
          <View className="items-center bg-paper px-6 py-3 rounded-card border border-paper-2">
            <Text className="text-label font-display text-ink-3 mb-1">OUTCOME DETECTED</Text>
            <Text className="text-2xl font-display text-brand-500">{result.toUpperCase()}</Text>
          </View>
        ) : (
          <Text className="text-sm color-[#8B857E] font-semibold italic">Awaiting Transmission...</Text>
        )}
      </View>

      <TouchableOpacity 
        onPress={tossCoin} 
        disabled={flipping}
        activeOpacity={0.8}
        className="w-full h-16 rounded-card overflow-hidden shadow-hair"
      >
        <View
          style={{ backgroundColor: flipping ? '#8B857E' : '#12100E' }}
          className="flex-1 justify-center items-center"
        >
          <Text className="text-paper text-sm font-display uppercase">{flipping ? 'FLIPPING...' : 'EXECUTE TOSS'}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default CoinToss;
