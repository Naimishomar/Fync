import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
    return num.toLocaleString();
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
            <View className="flex-1 bg-zinc-900 justify-center items-center h-[500px] rounded-[36px]">
                <ActivityIndicator size="large" color="#f97316" />
                <Text className="text-white mt-4 font-black tracking-widest uppercase">Fetching Live Trends...</Text>
            </View>
        );
    }

    if (status === 'gameover') {
        return (
            <View className="flex-1 bg-zinc-900 justify-center items-center h-[500px] rounded-[36px] p-6 border-2 border-red-500/30">
                <Ionicons name="close-circle" size={80} color="#ef4444" />
                <Text className="text-white text-3xl font-black uppercase mt-4 text-center">Game Over</Text>
                <Text className="text-zinc-400 text-sm font-bold uppercase tracking-[2px] mt-2 text-center">
                    {itemB.name} has {formatNumber(itemB.views)} views.
                </Text>
                <View className="bg-orange-500/20 px-6 py-3 rounded-full mt-6 border border-orange-500">
                    <Text className="text-orange-500 font-black text-xl tracking-widest">SCORE: {score}</Text>
                </View>

                <TouchableOpacity 
                    onPress={initGame}
                    className="mt-10 bg-white px-8 py-4 rounded-full w-full items-center shadow-lg shadow-orange-500/30"
                >
                    <Text className="text-zinc-900 font-black uppercase tracking-widest">Play Again</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={onClose}
                    className="mt-4 bg-zinc-800 px-8 py-4 rounded-full w-full items-center border border-zinc-700"
                >
                    <Text className="text-white font-black uppercase tracking-widest">Exit</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1 h-[600px] rounded-[36px] overflow-hidden bg-zinc-900 border border-zinc-800">
            {/* Top Half - Item A */}
            <View className="flex-1 justify-center items-center p-6 border-b border-zinc-800 bg-zinc-900 relative">
                <TouchableOpacity onPress={onClose} className="absolute top-4 left-4 z-10 bg-white/10 p-2 rounded-full">
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text className="text-orange-500 font-black text-xs tracking-[4px] uppercase mb-2">Wikipedia Pageviews</Text>
                <Text className="text-white text-3xl font-black text-center uppercase tracking-tighter leading-[36px]">"{itemA?.name}"</Text>
                <Text className="text-zinc-400 font-bold text-sm tracking-[2px] uppercase mt-2">has</Text>
                <Text className="text-white text-[40px] font-black text-center text-orange-400 mt-2">{formatNumber(itemA?.views)}</Text>
                <Text className="text-zinc-400 font-bold text-xs tracking-[2px] uppercase mt-2">views per month</Text>
            </View>

            {/* Score Pill in Center */}
            <View className="absolute top-1/2 left-1/2 -translate-x-[40px] -translate-y-6 z-10 w-[80px] h-12 bg-white rounded-full items-center justify-center shadow-2xl shadow-black border-2 border-zinc-900">
                <Text className="text-zinc-900 font-black text-lg">★ {score}</Text>
            </View>

            {/* Bottom Half - Item B */}
            <View className="flex-1 justify-center items-center p-6 bg-zinc-800 relative">
                {loading && status === 'playing' ? (
                    <ActivityIndicator size="large" color="#f97316" />
                ) : (
                    <>
                        <Text className="text-white text-3xl font-black text-center uppercase tracking-tighter leading-[36px]">"{itemB?.name}"</Text>
                        <Text className="text-zinc-400 font-bold text-sm tracking-[2px] uppercase mt-2 mb-6">has</Text>
                        
                        {status === 'revealing' ? (
                            <Text className={`text-[40px] font-black text-center mt-2 ${(itemB?.views >= itemA?.views) ? 'text-green-500' : 'text-red-500'}`}>
                                {formatNumber(itemB?.views)}
                            </Text>
                        ) : (
                            <View className="w-full flex-row justify-center gap-x-4">
                                <TouchableOpacity 
                                    onPress={() => handleGuess('higher')}
                                    className="bg-white/10 px-6 py-4 rounded-2xl items-center border border-white/20 flex-1"
                                >
                                    <Ionicons name="caret-up" size={32} color="#22c55e" />
                                    <Text className="text-white font-black tracking-widest mt-1 uppercase text-xs">Higher</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={() => handleGuess('lower')}
                                    className="bg-white/10 px-6 py-4 rounded-2xl items-center border border-white/20 flex-1"
                                >
                                    <Ionicons name="caret-down" size={32} color="#ef4444" />
                                    <Text className="text-white font-black tracking-widest mt-1 uppercase text-xs">Lower</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <Text className="text-zinc-400 font-bold text-xs tracking-[2px] uppercase mt-6">views than {itemA?.name}</Text>
                    </>
                )}
            </View>
        </View>
    );
};

export default TrendClash;
