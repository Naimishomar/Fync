import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BOLLYWOOD_MOVIES, INDIAN_PERSONALITIES } from './charadesData';

const { width } = Dimensions.get('window');

const CATEGORIES = {
  BOLLYWOOD: BOLLYWOOD_MOVIES,
  PERSONALITIES: INDIAN_PERSONALITIES
};

const DesiCharades = () => {
  const [activeCategory, setActiveCategory] = useState<keyof typeof CATEGORIES>('BOLLYWOOD');
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timer && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => (prev ? prev - 1 : null));
      }, 1000);
    } else if (timer === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  const generatePrompt = () => {
    const list = CATEGORIES[activeCategory];
    const randomIndex = Math.floor(Math.random() * list.length);
    setCurrentPrompt(list[randomIndex]);
    setTimer(60);
    setIsTimerRunning(true);
  };

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);

  return (
    <View className="p-6 bg-white rounded-[40px] border border-[#F1F5F9] shadow-sm items-center" style={{ width: width - 40 }}>
      <View className="items-center mb-6">
        <Text className="text-2xl font-black text-[#1A1A1A] uppercase tracking-[-1px]">DESI <Text className="text-[#db2777]">CHARADES</Text></Text>
        <Text className="text-[8px] text-[#94A3B8] font-black uppercase tracking-[2px] mt-1">Cultural Expression Engine v2.0</Text>
      </View>

      {/* Category Picker */}
      <View className="flex-row mb-6 w-full justify-center">
        {Object.keys(CATEGORIES).map((cat) => (
          <TouchableOpacity 
            key={cat}
            onPress={() => {
                setActiveCategory(cat as any);
                setCurrentPrompt(null);
                setTimer(null);
                setIsTimerRunning(false);
            }}
            className={`px-6 py-2 rounded-full mx-1 border ${activeCategory === cat ? 'bg-[#1A1A1A] border-[#1A1A1A]' : 'bg-white border-[#F1F5F9]'}`}
          >
            <Text className={`text-[10px] font-black uppercase tracking-widest ${activeCategory === cat ? 'text-white' : 'text-[#94A3B8]'}`}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Card Display */}
      <View className="w-full h-[180px] mb-8">
        <LinearGradient
            colors={['#FDF2F8', '#fff']}
            className="flex-1 rounded-[32px] border border-[#FCE7F3] items-center justify-center p-6"
        >
            {currentPrompt ? (
                <>
                    <Text className="text-[10px] font-black text-[#db2777] uppercase tracking-[2px] mb-2">{activeCategory}</Text>
                    <Text className="text-2xl font-black text-[#1A1A1A] text-center" numberOfLines={3}>
                        {currentPrompt}
                    </Text>
                    <Text className="text-[8px] font-bold text-[#94A3B8] mt-2 uppercase">Items in collection: {CATEGORIES[activeCategory].length}</Text>
                </>
            ) : (
                <View className="items-center">
                    <Ionicons name="sparkles" size={32} color="#94A3B8" />
                    <Text className="text-[10px] font-black text-[#94A3B8] uppercase mt-2 text-center">
                        {activeCategory === 'BOLLYWOOD' ? '1000+ MOVIES LOADED' : '200+ PERSONALITIES LOADED'}
                    </Text>
                </View>
            )}
        </LinearGradient>
      </View>

      {/* Timer Display */}
      {timer !== null && (
          <View className="flex-row items-center mb-8 bg-[#F8FAFC] px-6 py-3 rounded-2xl border border-[#F1F5F9]">
              <Ionicons name="timer-outline" size={20} color={timer < 10 ? '#db2777' : '#64748B'} />
              <Text className={`text-xl font-black ml-2 ${timer < 10 ? 'text-[#db2777]' : 'text-[#1A1A1A]'}`}>
                00:{timer < 10 ? `0${timer}` : timer}
              </Text>
              <TouchableOpacity onPress={toggleTimer} className="ml-4">
                  <Ionicons name={isTimerRunning ? "pause-circle" : "play-circle"} size={28} color="#1A1A1A" />
              </TouchableOpacity>
          </View>
      )}

      <TouchableOpacity 
        onPress={generatePrompt}
        className="w-full h-[60px] rounded-2xl overflow-hidden shadow-lg"
      >
        <LinearGradient colors={['#db2777', '#9d174d']} className="flex-1 justify-center items-center">
            <Text className="text-white text-xs font-black tracking-[3px] uppercase">GENERATE PROMPT</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

export default DesiCharades;
