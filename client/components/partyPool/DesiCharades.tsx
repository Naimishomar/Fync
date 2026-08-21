import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
    <View className="p-6 bg-card rounded-sheet border border-line shadow-hair items-center" style={{ width: width - 40 }}>
      <View className="items-center mb-6">
        <Text className="text-2xl font-display text-ink uppercase">DESI <Text className="text-fam-fun">CHARADES</Text></Text>
        <Text className="text-label text-ink-3 font-display uppercase mt-1">Cultural Expression Engine v2.0</Text>
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
            className={`px-6 py-2 rounded-full mx-1 border ${activeCategory === cat ? 'bg-ink border-ink' : 'bg-card border-paper-2'}`}
          >
            <Text className={`text-label font-display uppercase ${activeCategory === cat ? 'text-white' : 'text-ink-3'}`}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Card Display */}
      <View className="w-full h-[180px] mb-8">
        <View
            className="flex-1 rounded-sheet border border-fam-fun/10 items-center justify-center p-6"
         style={{ backgroundColor: '#EDE8E0' }}>
            {currentPrompt ? (
                <>
                    <Text className="text-label font-display text-fam-fun uppercase mb-2">{activeCategory}</Text>
                    <Text className="text-2xl font-display text-ink text-center" numberOfLines={3}>
                        {currentPrompt}
                    </Text>
                    <Text className="text-label font-semibold text-ink-3 mt-2 uppercase">Items in collection: {CATEGORIES[activeCategory].length}</Text>
                </>
            ) : (
                <View className="items-center">
                    <Ionicons name="sparkles" size={32} color="#8B857E" />
                    <Text className="font-sans text-sm text-ink-3 mt-2 text-center">
                        {activeCategory === 'BOLLYWOOD' ? '1000+ MOVIES LOADED' : '200+ PERSONALITIES LOADED'}
                    </Text>
                </View>
            )}
        </View>
      </View>

      {/* Timer Display */}
      {timer !== null && (
          <View className="flex-row items-center mb-8 bg-paper px-6 py-3 rounded-card border border-line">
              <Ionicons name="timer-outline" size={20} color={timer < 10 ? '#db2777' : '#8B857E'} />
              <Text className={`text-xl font-display ml-2 ${timer < 10 ? 'text-fam-fun' : 'text-ink'}`}>
                00:{timer < 10 ? `0${timer}` : timer}
              </Text>
              <TouchableOpacity onPress={toggleTimer} className="ml-4">
                  <Ionicons name={isTimerRunning ? "pause-circle" : "play-circle"} size={28} color="#12100E" />
              </TouchableOpacity>
          </View>
      )}

      <TouchableOpacity 
        onPress={generatePrompt}
        className="w-full h-[60px] rounded-card overflow-hidden shadow-hair"
      >
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: '#db2777' }}>
            <Text className="text-white text-xs font-display uppercase">GENERATE PROMPT</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default DesiCharades;
