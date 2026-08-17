import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const ReactionMaster = () => {
  const [gameState, setGameState] = useState<'idle' | 'waiting' | 'active' | 'result'>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  
  const startTime = useRef<number>(0);
  const timerTimeout = useRef<any>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const startGame = () => {
    setGameState('waiting');
    setReactionTime(null);
    const randomDelay = 2000 + Math.random() * 3000; 

    timerTimeout.current = setTimeout(() => {
      setGameState('active');
      startTime.current = Date.now();
    }, randomDelay);
  };

  const handleTap = () => {
    if (gameState === 'waiting') {
      clearTimeout(timerTimeout.current);
      setGameState('idle');
      alert("TOO EARLY! Wait for the pink screen.");
      return;
    }

    if (gameState === 'active') {
      const endTime = Date.now();
      const time = endTime - startTime.current;
      setReactionTime(time);
      setGameState('result');
      if (!bestTime || time < bestTime) setBestTime(time);

      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true })
      ]).start();
    }
  };

  const resetGame = () => {
    setGameState('idle');
    setReactionTime(null);
  };

  const getPerformanceMessage = (time: number) => {
    if (time < 200) return "GODLIKE REFLEXES! ⚡";
    if (time < 250) return "ELITE SPEED! 🔥";
    if (time < 300) return "PRETTY FAST! 😎";
    return "NOT BAD, KEEP PRACTICING! 🐢";
  };

  return (
    <View className="p-6 bg-white rounded-5xl border border-[#F1F5F9] shadow-sm items-center" style={{ width: width - 40 }}>
      <View className="items-center mb-[30px]">
        <Text className="text-2xl font-black text-[#1A1A1A] uppercase tracking-[-1px]">REACTION <Text className="text-[#db2777]">MASTER</Text></Text>
        <Text className="text-2xs text-[#94A3B8] font-black uppercase tracking-wide mt-1">Neural Sync Protocol v1.0</Text>
      </View>

      <TouchableOpacity 
        activeOpacity={1}
        onPress={handleTap}
        className="w-full rounded-4xl overflow-hidden bg-[#F8FAFC] border border-[#F1F5F9]"
      >
        <Animated.View className="flex-1" style={{ transform: [{ scale: scaleAnim }] }}>
            {gameState === 'idle' && (
                <View className="flex-1 justify-center items-center p-[30px]">
                    <Ionicons name="flash-outline" size={48} color="#94A3B8" />
                    <Text className="text-sm text-[#64748B] font-semibold mt-[15px] mb-[30px] text-center">Ready to test your speed?</Text>
                    <TouchableOpacity onPress={startGame} className="w-full h-[54px] rounded-2xl overflow-hidden shadow-sm">
                        <LinearGradient colors={['#1A1A1A', '#000']} className="flex-1 justify-center items-center">
                            <Text className="text-white text-2xs font-black tracking-wide">START TEST</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {gameState === 'waiting' && (
                <View className="flex-1 justify-center items-center p-[30px]">
                    <Text className="text-lg font-black text-[#94A3B8] tracking-[2px]">WAIT FOR PINK...</Text>
                    <View className="mt-[30px] w-[60px] h-[60px] rounded-full bg-[#F1F5F9] justify-center items-center">
                         <View className="w-5 h-5 rounded-full bg-[#db2777] opacity-30" />
                    </View>
                </View>
            )}

            {gameState === 'active' && (
                <LinearGradient 
                    colors={['#db2777', '#9d174d']} 
                    className="flex-1 justify-center items-center"
                >
                    <Text className="text-5xl font-black text-white tracking-[-2px]">TAP NOW!</Text>
                </LinearGradient>
            )}

            {gameState === 'result' && reactionTime && (
                <View className="flex-1 justify-center items-center p-6">
                    <View className="bg-white px-8 py-10 rounded-4xl border border-[#F1F5F9] shadow-xl items-center w-full">
                        <Text className="text-2xs font-black text-[#94A3B8] tracking-wide mb-2 uppercase">RESULT LOGGED</Text>
                        <View className="flex-row items-baseline">
                            <Text className="text-4xl font-black text-[#1A1A1A] tracking-[-4px]">{reactionTime}</Text>
                            <Text className="text-2xl font-black text-[#db2777] ml-2 uppercase">ms</Text>
                        </View>
                        <Text className="text-sm font-black text-[#db2777] mt-2 mb-6 text-center">{getPerformanceMessage(reactionTime)}</Text>
                        
                        <View className="flex-row bg-[#F8FAFC] p-4 rounded-2xl border border-[#F1F5F9] w-full justify-around">
                            <View className="items-center">
                                <Text className="text-2xs text-[#94A3B8] font-black mb-1 uppercase tracking-wide">PERSONAL BEST</Text>
                                <Text className="text-base font-black text-[#1A1A1A]">{bestTime} ms</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity onPress={startGame} className="w-full h-[58px] rounded-2xl overflow-hidden shadow-lg mt-8">
                        <LinearGradient colors={['#f97316', '#ea580c']} className="flex-1 justify-center items-center">
                            <Text className="text-white text-xs font-black tracking-wide">RETRY PROTOCOL</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}
        </Animated.View>
      </TouchableOpacity>

      {gameState === 'result' && (
        <TouchableOpacity onPress={resetGame} className="mt-5">
            <Text className="text-2xs text-[#94A3B8] font-black tracking-wide">RESET SESSION</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ReactionMaster;
