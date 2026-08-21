import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

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
    if (time < 200) return "GODLIKE REFLEXES";
    if (time < 250) return "Elite speed";
    if (time < 300) return "Pretty fast";
    return "Not bad — keep practising";
  };

  return (
    <View className="p-6 bg-card rounded-sheet border border-line shadow-hair items-center" style={{ width: width - 40 }}>
      <View className="items-center mb-[30px]">
        <Text className="text-2xl font-display text-ink uppercase">REACTION <Text className="text-fam-fun">MASTER</Text></Text>
        <Text className="text-label text-ink-3 font-display uppercase mt-1">Neural Sync Protocol v1.0</Text>
      </View>

      <TouchableOpacity 
        activeOpacity={1}
        onPress={handleTap}
        className="w-full rounded-sheet overflow-hidden bg-paper border border-line"
      >
        <Animated.View className="flex-1" style={{ transform: [{ scale: scaleAnim }] }}>
            {gameState === 'idle' && (
                <View className="flex-1 justify-center items-center p-[30px]">
                    <Ionicons name="flash-outline" size={48} color="#8B857E" />
                    <Text className="text-sm text-ink-3 font-semibold mt-[15px] mb-[30px] text-center">Ready to test your speed?</Text>
                    <TouchableOpacity onPress={startGame} className="w-full h-[54px] rounded-card overflow-hidden shadow-hair">
                        <View className="flex-1 justify-center items-center" style={{ backgroundColor: '#12100E' }}>
                            <Text className="text-white text-label font-display">START TEST</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {gameState === 'waiting' && (
                <View className="flex-1 justify-center items-center p-[30px]">
                    <Text className="text-lg font-semibold text-ink-3">WAIT FOR PINK...</Text>
                    <View className="mt-[30px] w-[60px] h-[60px] rounded-full bg-paper-2 justify-center items-center">
                         <View className="w-5 h-5 rounded-full bg-fam-fun opacity-30" />
                    </View>
                </View>
            )}

            {gameState === 'active' && (
                <View 
                    className="flex-1 justify-center items-center"
                 style={{ backgroundColor: '#db2777' }}>
                    <Text className="text-5xl font-display text-white">TAP NOW!</Text>
                </View>
            )}

            {gameState === 'result' && reactionTime && (
                <View className="flex-1 justify-center items-center p-6">
                    <View className="bg-card px-gutter py-10 rounded-sheet border border-line shadow-hair items-center w-full">
                        <Text className="font-display text-label text-ink-3 uppercase mb-2">Result logged</Text>
                        <View className="flex-row items-baseline">
                            <Text className="text-4xl font-display text-ink">{reactionTime}</Text>
                            <Text className="text-2xl font-display text-fam-fun ml-2 uppercase">ms</Text>
                        </View>
                        <Text className="text-sm font-display text-fam-fun mt-2 mb-6 text-center">{getPerformanceMessage(reactionTime)}</Text>
                        
                        <View className="flex-row bg-paper p-4 rounded-card border border-line w-full justify-around">
                            <View className="items-center">
                                <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                                  <Text className="text-label text-ink-3 font-display uppercase">PERSONAL BEST</Text>
                                  <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                                </View>
                                <Text className="text-base font-semibold text-ink">{bestTime} ms</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity onPress={startGame} className="w-full h-[58px] rounded-card overflow-hidden shadow-hair mt-8">
                        <View className="flex-1 justify-center items-center" style={{ backgroundColor: '#F97316' }}>
                            <Text className="text-ink text-xs font-display">RETRY PROTOCOL</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}
        </Animated.View>
      </TouchableOpacity>

      {gameState === 'result' && (
        <TouchableOpacity onPress={resetGame} className="mt-5">
            <Text className="text-label text-ink-3 font-display">RESET SESSION</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ReactionMaster;
