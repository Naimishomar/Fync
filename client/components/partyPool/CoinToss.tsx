import React, { useState, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { Button } from '../ui/kit';


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
    <View className="p-5 bg-card rounded-2xl border border-line items-center" style={{ alignSelf: 'stretch' }}>
      {/* Header */}
      <View className="items-center mb-[50px]">
        <Text className="text-2xl font-display text-ink" accessibilityRole="header">Coin toss</Text>
        <Text className="text-sm text-ink-3 mt-1">Heads or tails, settled fairly</Text>
      </View>

      <View className="items-center mb-[50px]">
        <Animated.View className="w-[180px] h-[180px] rounded-full" style={{ transform: [{ rotateY: spin }] }}>
          <View
            className="w-full h-full rounded-full justify-center items-center border-[8px] border-white/20"
           style={{ backgroundColor: C.brand[500] }}>
            <View className="w-[140px] h-[140px] rounded-full bg-white/10 justify-center items-center border border-white/30">
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
          <View className="items-center bg-paper-2 px-6 py-3 rounded-2xl" accessibilityLiveRegion="polite">
            <Text className="text-sm font-semibold text-ink-3 mb-1">Result</Text>
            <Text className="text-2xl font-display text-ink">{result}</Text>
          </View>
        ) : (
          <Text className="text-sm text-ink-3">Tap toss to flip the coin</Text>
        )}
      </View>

      <Button variant="primary" block title={flipping ? 'Flipping...' : 'Toss coin'} onPress={tossCoin} disabled={flipping} />
    </View>
  );
};

export default CoinToss;
