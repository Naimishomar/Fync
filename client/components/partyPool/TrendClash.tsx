import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { Button, IconBtn } from '../ui/kit';

const TERMS = [
  { id: 'Python_(programming_language)', name: 'Python' },
  { id: 'JavaScript', name: 'JavaScript' },
  { id: 'Elon_Musk', name: 'Elon Musk' },
  { id: 'Mark_Zuckerberg', name: 'Mark Zuckerberg' },
  { id: 'Artificial_intelligence', name: 'Artificial Intelligence' },
  { id: 'Bitcoin', name: 'Bitcoin' },
  { id: 'ChatGPT', name: 'ChatGPT' },
  { id: 'Google', name: 'Google' },
  { id: 'Apple_Inc.', name: 'Apple' },
  { id: 'Microsoft', name: 'Microsoft' },
  { id: 'Steve_Jobs', name: 'Steve Jobs' },
  { id: 'Tesla,_Inc.', name: 'Tesla' },
  { id: 'SpaceX', name: 'SpaceX' },
  { id: 'Cristiano_Ronaldo', name: 'Cristiano Ronaldo' },
  { id: 'Taylor_Swift', name: 'Taylor Swift' },
  { id: 'YouTube', name: 'YouTube' },
  { id: 'Instagram', name: 'Instagram' },
  { id: 'TikTok', name: 'TikTok' },
  { id: 'Netflix', name: 'Netflix' },
  { id: 'Linux', name: 'Linux' },
  { id: 'Cybersecurity', name: 'Cybersecurity' },
  { id: 'Virtual_reality', name: 'Virtual Reality' },
  { id: 'Minecraft', name: 'Minecraft' },
  { id: 'Grand_Theft_Auto_V', name: 'GTA V' },
];

const fetchViews = async (articleId: string) => {
    try {
        const res = await fetch(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${articleId}/monthly/2023100100/2023103100`);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
            return data.items[0].views;
        }
        return Math.floor(Math.random() * 500000) + 100000; // Fallback
    } catch (e) {
        return Math.floor(Math.random() * 500000) + 100000;
    }
};

const getRandomTerm = (excludeId?: string) => {
    let available = TERMS;
    if (excludeId) available = TERMS.filter(t => t.id !== excludeId);
    return available[Math.floor(Math.random() * available.length)];
};

const formatNumber = (num: number) => {
    return (num ?? 0).toLocaleString();
};

const TrendClash = ({ onClose }: { onClose: () => void }) => {
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(true);
    const [itemA, setItemA] = useState<any>(null);
    const [itemB, setItemB] = useState<any>(null);
    const [status, setStatus] = useState<'playing' | 'revealing' | 'gameover'>('playing');

    useEffect(() => {
        initGame();
    }, []);

    const initGame = async () => {
        setLoading(true);
        setStatus('playing');
        setScore(0);
        const termA = getRandomTerm();
        const termB = getRandomTerm(termA.id);
        
        const [viewsA, viewsB] = await Promise.all([
            fetchViews(termA.id),
            fetchViews(termB.id)
        ]);

        setItemA({ ...termA, views: viewsA });
        setItemB({ ...termB, views: viewsB });
        setLoading(false);
    };

    const handleGuess = async (guess: 'higher' | 'lower') => {
        if (status !== 'playing') return;
        
        setStatus('revealing');
        const isHigher = itemB.views >= itemA.views;
        const correct = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

        setTimeout(async () => {
            if (correct) {
                setScore(s => s + 1);
                setLoading(true);
                // B becomes A
                const newTerm = getRandomTerm(itemB.id);
                const newViews = await fetchViews(newTerm.id);
                
                setItemA(itemB);
                setItemB({ ...newTerm, views: newViews });
                setStatus('playing');
                setLoading(false);
            } else {
                setStatus('gameover');
            }
        }, 1500); // Give time to read the revealed number
    };

    if (loading && !itemA) {
        return (
            <View className="grow bg-night justify-center items-center rounded-3xl">
                <ActivityIndicator size="large" color={C.brand[500]} />
                <Text className="text-white mt-4 font-semibold">Fetching live trends...</Text>
            </View>
        );
    }

    if (status === 'gameover') {
        return (
            <View className="grow bg-night justify-center items-center rounded-3xl p-6" style={{ gap: 12 }}>
                <Ionicons name="close-circle" size={80} color={C.danger} />
                <Text className="text-white text-3xl font-display mt-4 text-center" accessibilityRole="header">Game over</Text>
                <Text className="text-night-3 text-sm text-center">
                    {itemB.name} has {formatNumber(itemB.views)} views.
                </Text>
                <View className="bg-white/10 px-6 py-3 rounded-full mt-2">
                    <Text className="text-white font-display text-xl">Score: {score}</Text>
                </View>

                <Button variant="primary" block icon="refresh" title="Play again" onPress={initGame} style={{ marginTop: 24 }} />
                <Button variant="tertiary" block title="Exit" onPress={onClose} />
            </View>
        );
    }

    // Halves are flex-1, so the card needs a floor; the hub ScrollView handles the rest.
    return (
        <View className="grow rounded-3xl overflow-hidden bg-night" style={{ minHeight: 520 }}>
            {/* Top Half - Item A */}
            <View className="flex-1 justify-center items-center p-6 border-b border-white/10 bg-night relative">
                <View className="absolute top-3 left-3 z-10">
                    <IconBtn name="close" overlay color="#fff" onPress={onClose} accessibilityLabel="Exit Trend Clash" />
                </View>
                <Text className="text-accent-text font-semibold text-xs mt-6 mb-2">Wikipedia pageviews</Text>
                <Text className="text-white text-3xl font-display text-center leading-[36px]">"{itemA?.name}"</Text>
                <Text className="text-night-3 font-semibold text-sm mt-2">has</Text>
                <Text className="text-4xl font-display text-center text-accent-text mt-2">{formatNumber(itemA?.views)}</Text>
                <Text className="text-night-3 font-semibold text-xs mt-2">views per month</Text>
            </View>

            {/* Score Pill in Center */}
            <View className="absolute top-1/2 left-1/2 -translate-x-[40px] -translate-y-6 z-10 w-[80px] h-12 bg-card rounded-full items-center justify-center border border-line" accessibilityLabel={`Score ${score}`}>
                <Text className="text-ink font-semibold text-lg"> {score}</Text>
            </View>

            {/* Bottom Half - Item B */}
            <View className="flex-1 justify-center items-center p-6 bg-night relative">
                {loading && status === 'playing' ? (
                    <ActivityIndicator size="large" color={C.brand[500]} />
                ) : (
                    <>
                        <Text className="text-white text-3xl font-display text-center leading-[36px]">"{itemB?.name}"</Text>
                        <Text className="text-night-3 font-semibold text-sm mt-2 mb-6">has</Text>
                        
                        {status === 'revealing' ? (
                            <Text className={`text-4xl font-display text-center mt-2 ${(itemB?.views >= itemA?.views) ? 'text-success' : 'text-danger'}`}>
                                {formatNumber(itemB?.views)}
                            </Text>
                        ) : (
                            <View className="w-full flex-row justify-center gap-x-4">
                                <Pressable
                                    onPress={() => handleGuess('higher')}
                                    accessibilityRole="button"
                                    className="bg-white/10 px-6 py-4 rounded-2xl items-center border border-white/20 flex-1 active:opacity-85"
                                >
                                    <Ionicons name="caret-up" size={32} color={C.success} />
                                    <Text className="text-white font-semibold mt-1 text-sm">Higher</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => handleGuess('lower')}
                                    accessibilityRole="button"
                                    className="bg-white/10 px-6 py-4 rounded-2xl items-center border border-white/20 flex-1 active:opacity-85"
                                >
                                    <Ionicons name="caret-down" size={32} color={C.danger} />
                                    <Text className="text-white font-semibold mt-1 text-sm">Lower</Text>
                                </Pressable>
                            </View>
                        )}
                        <Text className="text-night-3 font-semibold text-xs mt-6">views than {itemA?.name}</Text>
                    </>
                )}
            </View>
        </View>
    );
};

export default TrendClash;
