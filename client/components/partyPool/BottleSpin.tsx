import React, { useState, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, TextInput, Dimensions, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const BottleSpin = () => {
  const [numPeople, setNumPeople] = useState('4');
  const [winner, setWinner] = useState<number | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [isSpinning, setIsSpinning] = useState(false);

  const spinBottle = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWinner(null);

    const randomExtra = Math.random() * 360;
    const totalRotation = 1800 + randomExtra; 

    Animated.timing(rotateAnim, {
      toValue: totalRotation,
      duration: 4000,
      useNativeDriver: true,
    }).start(() => {
      setIsSpinning(false);
      const count = Math.min(Math.max(parseInt(numPeople) || 2, 2), 20);
      const anglePerPerson = 360 / count;
      const finalRotation = totalRotation % 360;
      const winningIndex = Math.round(finalRotation / anglePerPerson) % count;
      setWinner(winningIndex + 1);
      rotateAnim.setValue(finalRotation);
    });
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 3600],
    outputRange: ['0deg', '3600deg']
  });

  const peopleCount = Math.min(Math.max(parseInt(numPeople) || 2, 2), 20);
  const people = Array.from({ length: peopleCount });

  return (
    <View className="p-6 bg-white rounded-[40px] border border-[#F1F5F9] shadow-sm items-center" style={{ width: width - 40 }}>
      {/* Header UI */}
      <View className="items-center mb-[30px]">
        <Text className="text-2xl font-black text-[#1A1A1A] uppercase tracking-[-1px]">BOTTLE <Text className="text-[#f97316]">SPIN</Text></Text>
        <Text className="text-[8px] text-[#94A3B8] font-black uppercase tracking-[2px] mt-1">Social Interaction Protocol v2.0</Text>
      </View>

      {/* Configuration */}
      <View className="flex-row items-center justify-between w-full mb-10 h-[50px]">
        <View className="flex-row items-center bg-[#F8FAFC] p-[10px] rounded-[16px] border border-[#E2E8F0]">
          <Text className="text-[8px] font-black text-[#94A3B8] mr-[10px] tracking-[1px]">PLAYERS (2-20)</Text>
          <TextInput
            style={{ padding: 0 }}
            className="text-base font-black text-[#1A1A1A] text-center w-[30px]"
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
          <View className="bg-[#FFF7ED] px-3 py-2 rounded-xl border border-[#FFEDD5] items-end">
             <Text className="text-[7px] font-black text-[#f97316] tracking-[1px]">POINTS AT:</Text>
             <Text className="text-xs font-black text-[#f97316] uppercase">PLAYER {winner}</Text>
          </View>
        )}
      </View>

      <View className="w-[300px] h-[300px] justify-center items-center">
        {/* Table Background */}
        <View className="absolute w-[260px] h-[260px] rounded-[130px] overflow-hidden border border-[#F1F5F9]">
          <LinearGradient colors={['#F8FAFC', '#F1F5F9']} className="flex-1" />
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
              <View className={`w-10 h-10 rounded-full justify-center items-center border border-[#F1F5F9] shadow-sm ${winner === i + 1 ? 'bg-[#f97316] border-[#ea580c] scale-[1.2]' : 'bg-white'}`}>
                <Text className={`text-sm font-black ${winner === i + 1 ? 'text-white' : 'text-[#64748B]'}`}>{i + 1}</Text>
              </View>
            </View>
          );
        })}

        <Animated.View className="w-[140px] h-[140px] justify-center items-center z-10" style={{ transform: [{ rotate: rotation }] }}>
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
        className="w-full h-[60px] rounded-[20px] mt-10 overflow-hidden shadow-sm"
      >
        <LinearGradient
          colors={isSpinning ? ['#94A3B8', '#64748B'] : ['#f97316', '#ea580c']}
          className="flex-1 justify-center items-center"
        >
          <Text className="text-white text-sm font-black uppercase tracking-[2px]">{isSpinning ? 'SCANNING...' : 'SPIN BOTTLE'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

export default BottleSpin;
