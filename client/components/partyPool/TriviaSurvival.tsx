import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Decode HTML entities from OpenTDB
const decodeHTMLEntities = (text: string) => {
    return text.replace(/&quot;/g, '"')
               .replace(/&#039;/g, "'")
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&eacute;/g, 'é')
               .replace(/&rsquo;/g, "'");
};

const TriviaSurvival = ({ onClose }: { onClose: () => void }) => {
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [health, setHealth] = useState(100);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'playing' | 'gameover'>('playing');

    const healthRef = useRef(100);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const tokenRef = useRef<string | null>(null);

    useEffect(() => {
        restartGame();
        return () => stopTimer();
    }, []);

    const fetchMoreQuestions = async () => {
        setLoading(true);
        try {
            // 1. Get Session Token if not exists
            if (!tokenRef.current) {
                const tr = await fetch('https://opentdb.com/api_token.php?command=request');
                const td = await tr.json();
                if (td.token) tokenRef.current = td.token;
            }

            let url = 'https://opentdb.com/api.php?amount=50&category=18&type=multiple';
            if (tokenRef.current) url += `&token=${tokenRef.current}`;

            let res = await fetch(url);
            let data = await res.json();

            // 2. Token Exhausted (Code 4) -> Reset and retry
            if (data.response_code === 4) {
                await fetch(`https://opentdb.com/api_token.php?command=reset&token=${tokenRef.current}`);
                res = await fetch(url);
                data = await res.json();
            }

            if (data.results && data.results.length > 0) {
                const formatted = data.results.map((q: any) => {
                    const options = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
                    return { ...q, options };
                });
                setQuestions(formatted);
                setCurrentIdx(0);
                setLoading(false);
                
                // Always start timer upon successfully loading new questions
                startTimer();
            } else {
                // E.g., rate limit or empty
                setLoading(false);
                setStatus('gameover');
            }
        } catch (e) {
            setLoading(false);
            setStatus('gameover');
        }
    };

    const restartGame = () => {
        setStatus('playing');
        setScore(0);
        setHealth(100);
        healthRef.current = 100;
        fetchMoreQuestions();
    };

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            healthRef.current -= 1; // 1 per 100ms = 10 seconds total
            if (healthRef.current <= 0) {
                healthRef.current = 0;
                setHealth(0);
                setStatus('gameover');
                stopTimer();
            } else {
                setHealth(healthRef.current);
            }
        }, 100);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const handleAnswer = (selected: string) => {
        if (status !== 'playing') return;
        
        const q = questions[currentIdx];
        if (selected === q.correct_answer) {
            setScore(s => s + 1);
            // Reset timer to 10s for the next question
            healthRef.current = 100; 
            setHealth(100);
        } else {
            // Wrong answer ends the survival game
            setStatus('gameover');
            stopTimer();
            return;
        }
        
        if (currentIdx < questions.length - 1) {
            setCurrentIdx(i => i + 1);
        } else {
            // Re-fetch more questions without resetting score/health
            stopTimer();
            fetchMoreQuestions();
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-ink justify-center items-center h-[500px] rounded-sheet">
                <ActivityIndicator size="large" color="#DC2626" />
                <Text className="text-white mt-4 font-display uppercase">Loading Trivia...</Text>
            </View>
        );
    }

    if (status === 'gameover') {
        return (
            <View className="flex-1 bg-ink justify-center items-center h-[500px] rounded-sheet p-6 border-2 border-danger/30">
                <Ionicons name="skull" size={80} color="#DC2626" />
                <Text className="text-white text-3xl font-display uppercase mt-4 text-center">You Died</Text>
                
                <View className="bg-danger/20 px-6 py-3 rounded-full mt-6 border border-danger">
                    <Text className="text-danger font-display text-xl">SURVIVED: {score} Qs</Text>
                </View>

                <TouchableOpacity 
                    onPress={restartGame}
                    className="mt-10 bg-card px-gutter py-4 rounded-full w-full items-center shadow-hair"
                >
                    <Text className="text-ink font-display uppercase">Respawn</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={onClose}
                    className="mt-4 bg-ink px-gutter py-4 rounded-full w-full items-center border border-ink"
                >
                    <Text className="text-white font-display uppercase">Exit</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const q = questions[currentIdx];
    // Dynamic health bar color
    const healthColor = health > 50 ? '#047857' : health > 20 ? '#B45309' : '#DC2626';

    return (
        <View className="flex-1 w-full h-[600px] rounded-sheet overflow-hidden bg-ink border border-ink">
            {/* Top Bar - Health & Score */}
            <View className="flex-row items-center justify-between p-6 bg-ink">
                <TouchableOpacity onPress={onClose} className="bg-card/10 p-2 rounded-full">
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <View className="flex-1 mx-4 h-6 bg-ink rounded-full overflow-hidden border border-ink relative">
                    <View 
                        style={{ width: `${health}%`, backgroundColor: healthColor }} 
                        className="h-full rounded-full"
                    />
                    <Text className="absolute w-full text-center text-label font-display text-white uppercase leading-6">
                        Time Left: {(health / 10).toFixed(1)}s
                    </Text>
                </View>
                <View className="bg-card/10 px-4 py-2 rounded-full border border-white/10">
                    <Text className="font-display text-xs text-white">{score}</Text>
                </View>
            </View>

            {/* Question */}
            <View className="h-[200px] p-6 justify-center">
                <Text className="text-accent-text font-display text-label uppercase mb-4 text-center">
                    {q?.category} • {q?.difficulty}
                </Text>
                <Text 
                    className="text-white text-2xl font-display text-center leading-8"
                    numberOfLines={4}
                    adjustsFontSizeToFit
                >
                    {decodeHTMLEntities(q?.question || '')}
                </Text>
            </View>

            {/* Options */}
            <View className="p-6 gap-y-3 pb-8">
                {q?.options?.map((opt: string, i: number) => (
                    <TouchableOpacity 
                        key={i}
                        onPress={() => handleAnswer(opt)}
                        className="bg-ink px-6 h-[64px] justify-center rounded-card border border-ink"
                    >
                        <Text 
                            className="text-white text-sm font-display text-center"
                            numberOfLines={2}
                            adjustsFontSizeToFit
                        >
                            {decodeHTMLEntities(opt)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

export default TriviaSurvival;
