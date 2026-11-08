import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BOLLYWOOD_MOVIES, INDIAN_PERSONALITIES } from './charadesData';
import { C } from '../../constants/colors';
import { Button, SegmentedTabs } from '../ui/kit';

const CAT_KEYS = ['BOLLYWOOD', 'PERSONALITIES'] as const;
const CAT_LABELS = { BOLLYWOOD: 'Bollywood', PERSONALITIES: 'Personalities' };


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
    <View className="p-5 bg-card rounded-2xl border border-line items-center" style={{ alignSelf: 'stretch' }}>
      <View className="items-center mb-6">
        <Text className="text-2xl font-display text-ink" accessibilityRole="header">Desi charades</Text>
        <Text className="text-sm text-ink-3 mt-1">Act it out, no talking</Text>
      </View>

      {/* Category Picker */}
      <SegmentedTabs
        items={CAT_KEYS}
        labels={CAT_LABELS}
        value={activeCategory}
        onChange={(cat) => {
          setActiveCategory(cat);
          setCurrentPrompt(null);
          setTimer(null);
          setIsTimerRunning(false);
        }}
        style={{ alignSelf: 'stretch', marginBottom: 24 }}
      />

      {/* Card Display */}
      <View className="w-full h-[180px] mb-8">
        <View
            className="flex-1 rounded-2xl items-center justify-center p-6"
         style={{ backgroundColor: C.paper2 }}>
            {currentPrompt ? (
                <>
                    <Text className="text-sm font-semibold text-ink-3 mb-2">{CAT_LABELS[activeCategory]}</Text>
                    <Text className="text-2xl font-display text-ink text-center" numberOfLines={3}>
                        {currentPrompt}
                    </Text>
                    <Text className="text-xs text-ink-3 mt-2">{CATEGORIES[activeCategory].length} in this deck</Text>
                </>
            ) : (
                <View className="items-center">
                    <Ionicons name="sparkles" size={32} color={C.ink3} />
                    <Text className="font-sans text-sm text-ink-3 mt-2 text-center">
                        {activeCategory === 'BOLLYWOOD' ? '1000+ movies ready' : '200+ personalities ready'}
                    </Text>
                </View>
            )}
        </View>
      </View>

      {/* Timer Display */}
      {timer !== null && (
          <View className="flex-row items-center mb-8 bg-paper-2 px-5 py-2 rounded-full">
              <Ionicons name="timer-outline" size={20} color={timer < 10 ? C.fam.fun : C.ink3} />
              <Text className={`text-xl font-display ml-2 ${timer < 10 ? 'text-fam-fun' : 'text-ink'}`}>
                00:{timer < 10 ? `0${timer}` : timer}
              </Text>
              <Pressable onPress={toggleTimer} className="ml-3 w-11 h-11 items-center justify-center active:opacity-70"
                accessibilityRole="button" accessibilityLabel={isTimerRunning ? 'Pause timer' : 'Resume timer'}>
                  <Ionicons name={isTimerRunning ? "pause-circle" : "play-circle"} size={28} color={C.ink} />
              </Pressable>
          </View>
      )}

      <Button variant="primary" block icon="shuffle" title={currentPrompt ? 'Next prompt' : 'Get a prompt'} onPress={generatePrompt} />
    </View>
  );
};

export default DesiCharades;
