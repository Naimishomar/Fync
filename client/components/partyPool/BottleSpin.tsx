import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Animated, TouchableOpacity, TextInput, Dimensions, Image, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const BottleSpin = () => {
  const [numPeople, setNumPeople] = useState('4');
  const [winner, setWinner] = useState<number | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const currentRotRef = useRef(0);
  const lastSegmentRef = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' }
        );
        soundRef.current = sound;
      } catch (e) {
        console.log("Failed to load sound", e);
      }
    }
    loadSound();
    return () => {
      soundRef.current?.unloadAsync();
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
    <View className="p-6 bg-card rounded-sheet border border-paper-2 shadow-hair items-center" style={{ width: width - 40 }}>
      {/* Header UI */}
      <View className="items-center mb-[30px]">
        <Text className="text-2xl font-display text-ink uppercase">BOTTLE <Text className="text-brand-500">SPIN</Text></Text>
        <Text className="text-label text-ink-3 font-display uppercase mt-1">Social Interaction Protocol v2.0</Text>
      </View>

      {/* Configuration */}
      <View className="flex-row items-center justify-between w-full mb-10 h-[50px]">
        <View className="flex-row items-center bg-paper p-[10px] rounded-lg border-2 border-ink">
          <Text className="text-label font-display text-ink-3 mr-[10px]">PLAYERS (2-20)</Text>
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
          />
        </View>
        
        {winner && !isSpinning && (
          <View className="bg-paper-2 border border-line items-end px-2.5 py-1 rounded-full">
             <Text className="text-label font-display text-brand-500">POINTS AT:</Text>
             <Text className="text-xs font-display text-brand-500 uppercase">PLAYER {winner}</Text>
          </View>
        )}
      </View>

      <View className="w-[300px] h-[300px] justify-center items-center">
        {/* Table Background */}
        <View className="absolute w-[260px] h-[260px] rounded-sheet overflow-hidden bg-paper-2">
        </View>

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
              <View className={`w-10 h-10 rounded-full justify-center items-center border border-paper-2 shadow-hair ${winner === i + 1 ? 'bg-brand-500 border-accent-text scale-[1.2]' : 'bg-card'}`}>
                <Text className={`text-sm font-display ${winner === i + 1 ? 'text-ink' : 'text-ink-3'}`}>{i + 1}</Text>
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

      <TouchableOpacity 
        onPress={spinBottle} 
        disabled={isSpinning}
        activeOpacity={0.8}
        className="w-full h-[60px] rounded-card mt-10 overflow-hidden shadow-hair"
      >
        <View
          style={{ backgroundColor: isSpinning ? '#8B857E' : '#F97316' }}
          className="flex-1 justify-center items-center"
        >
          <Text className="text-ink text-sm font-display uppercase">{isSpinning ? 'SCANNING...' : 'SPIN BOTTLE'}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default BottleSpin;
