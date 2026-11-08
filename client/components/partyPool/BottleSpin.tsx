import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Animated, TextInput, Image } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Button } from '../ui/kit';


const BottleSpin = () => {
  const [numPeople, setNumPeople] = useState('4');
  const [winner, setWinner] = useState<number | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const currentRotRef = useRef(0);
  const lastSegmentRef = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  // The 300px table is wider than the card on small phones; scale it to the
  // card's own measured inner width (minus p-6 and border) instead of clipping.
  const [innerW, setInnerW] = useState(300);
  const boardScale = Math.min(1, innerW / 300);

  useEffect(() => {
    // Leaving before the download finishes would otherwise orphan a loaded sound.
    let cancelled = false;
    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' }
        );
        if (cancelled) {
          sound.unloadAsync().catch(() => {});
          return;
        }
        soundRef.current = sound;
      } catch (e) {
        console.log("Failed to load sound", e);
      }
    }
    loadSound();
    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = rotateAnim.addListener(({ value }) => {
      const count = Math.min(Math.max(parseInt(numPeople) || 2, 2), 20);
      const anglePerPerson = 360 / count;
      const currentSegment = Math.floor(value / anglePerPerson);

      if (currentSegment > lastSegmentRef.current) {
        lastSegmentRef.current = currentSegment;
        
        // Play tick sound & haptic
        if (soundRef.current) {
          soundRef.current.replayAsync().catch(() => {});
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });

    return () => {
      rotateAnim.removeListener(id);
    };
  }, [numPeople, rotateAnim]);

  const spinBottle = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWinner(null);
    
    // Reset segment tracking so it ticks properly from current rotation
    const count = Math.min(Math.max(parseInt(numPeople) || 2, 2), 20);
    lastSegmentRef.current = Math.floor(currentRotRef.current / (360 / count));

    const winningIndex = Math.floor(Math.random() * count);
    
    // Calculate the exact angle to point to the winner.
    // Index 0 is at -90deg (Top). If the bottle image points RIGHT, it needs to rotate to -90 to point top.
    // If the bottle cap actually points LEFT in the generated image, change this offset to 180.
    const BOTTLE_OFFSET = 0; 
    let baseAngle = (winningIndex * (360 / count)) - 90 + BOTTLE_OFFSET;
    
    baseAngle = (baseAngle % 360 + 360) % 360;

    let extra = baseAngle - currentRotRef.current;
    if (extra < 0) extra += 360;

    const totalRotation = currentRotRef.current + 1800 + extra; // 5 full spins + exact target

    Animated.timing(rotateAnim, {
      toValue: totalRotation,
      duration: 4000,
      useNativeDriver: true,
    }).start(() => {
      setIsSpinning(false);
      setWinner(winningIndex + 1);
      currentRotRef.current = totalRotation % 360;
      rotateAnim.setValue(currentRotRef.current);
    });
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 3600],
    outputRange: ['0deg', '3600deg']
  });

  const peopleCount = Math.min(Math.max(parseInt(numPeople) || 2, 2), 20);
  const people = Array.from({ length: peopleCount });

  return (
    <View className="p-6 bg-card rounded-2xl border border-line items-center" style={{ alignSelf: 'stretch' }}
      onLayout={(e) => setInnerW(e.nativeEvent.layout.width - 50)}>
      {/* Header UI */}
      <View className="items-center mb-[30px]">
        <Text className="text-2xl font-display text-ink" accessibilityRole="header">Bottle spin</Text>
        <Text className="text-sm text-ink-3 mt-1">Truth or dare for up to 20 players</Text>
      </View>

      {/* Configuration */}
      <View className="flex-row items-center justify-between w-full mb-10 h-[50px]">
        <View className="flex-row items-center bg-paper-2 px-4 rounded-full" style={{ minHeight: 48 }}>
          <Text className="text-sm font-semibold text-ink-3 mr-2">Players (2-20)</Text>
          <TextInput
            style={{ padding: 0 }}
            className="text-base font-semibold text-ink text-center w-[30px]"
            keyboardType="numeric"
            value={numPeople}
            onChangeText={(val) => {
                const n = parseInt(val);
                if (!val) setNumPeople('');
                else if (n > 20) setNumPeople('20');
                else setNumPeople(val);
            }}
            maxLength={2}
            accessibilityLabel="Number of players"
          />
        </View>
        
        {winner && !isSpinning && (
          <View className="bg-paper-2 items-end px-3 py-1 rounded-2xl" accessibilityLiveRegion="polite">
             <Text className="text-xs font-semibold text-ink-3">Points at</Text>
             <Text className="text-sm font-semibold text-accent-text">Player {winner}</Text>
          </View>
        )}
      </View>

      <View className="w-[300px] h-[300px] justify-center items-center" style={{ transform: [{ scale: boardScale }], marginVertical: -150 * (1 - boardScale) }}>
        {/* Table Background */}
        <View className="absolute w-[260px] h-[260px] rounded-full bg-paper-2" />

        {people.map((_, i) => {
          const angle = (i * 360) / people.length - 90;
          const x = 125 * Math.cos((angle * Math.PI) / 180);
          const y = 125 * Math.sin((angle * Math.PI) / 180);
          
          return (
            <View 
              key={i} 
              className="absolute"
              style={{ transform: [{ translateX: x }, { translateY: y }] }}
            >
              <View className={`w-10 h-10 rounded-full justify-center items-center border border-line ${winner === i + 1 ? 'bg-brand-500 border-accent-text scale-[1.2]' : 'bg-card'}`}>
                <Text className={`text-sm font-display ${winner === i + 1 ? 'text-on-brand' : 'text-ink-3'}`}>{i + 1}</Text>
              </View>
            </View>
          );
        })}

        <Animated.View className="w-[180px] h-[180px] justify-center items-center z-10" style={{ transform: [{ rotate: rotation }] }}>
          <Image 
            source={require('../../assets/bottle.png')}
            className="w-full h-full"
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Button variant="primary" block title={isSpinning ? 'Spinning...' : 'Spin bottle'} onPress={spinBottle} disabled={isSpinning} style={{ marginTop: 40 }} />
    </View>
  );
};

export default BottleSpin;
