import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { Button, IconBtn } from '../ui/kit';

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
    // A failed question fetch is not a death; say so instead of "You Died".
    const [loadFailed, setLoadFailed] = useState(false);

    const healthRef = useRef(100);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const tokenRef = useRef<string | null>(null);
    // Exiting mid-fetch used to let the response start a 100ms interval on an
    // unmounted screen that then ran forever.
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        restartGame();
        return () => {
            mountedRef.current = false;
            stopTimer();
        };
    }, []);

    const fetchMoreQuestions = async () => {
        setLoading(true);
        setLoadFailed(false);
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
            if (!mountedRef.current) return;

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
                setLoadFailed(true);
                setStatus('gameover');
            }
        } catch (e) {
            if (!mountedRef.current) return;
            setLoading(false);
            setLoadFailed(true);
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
            <View className="grow bg-night justify-center items-center rounded-3xl">
                <ActivityIndicator size="large" color={C.danger} />
                <Text className="text-white mt-4 font-semibold">Loading trivia...</Text>
            </View>
        );
    }

    if (status === 'gameover') {
        return (
            <View className="grow bg-night justify-center items-center rounded-3xl p-6" style={{ gap: 12 }}>
                <Ionicons name={loadFailed ? "cloud-offline" : "skull"} size={80} color={C.danger} />
                <Text className="text-white text-3xl font-display mt-4 text-center" accessibilityRole="header">{loadFailed ? "No signal" : "You died"}</Text>
                {loadFailed ? (
                    <Text className="text-night-3 text-sm text-center">Couldn't load questions. Check your connection.</Text>
                ) : (
                    <View className="bg-white/10 px-6 py-3 rounded-full mt-2">
                        <Text className="text-white font-display text-xl">Survived {score} {score === 1 ? 'question' : 'questions'}</Text>
                    </View>
                )}

                <Button variant="primary" block icon="refresh" title={loadFailed ? "Try again" : "Respawn"} onPress={restartGame} style={{ marginTop: 24 }} />
                <Button variant="tertiary" block title="Exit" onPress={onClose} />
            </View>
        );
    }

    const q = questions[currentIdx];
    // Dynamic health bar color
    const healthColor = health > 50 ? C.success : health > 20 ? C.warning : C.danger;

    return (
        <View className="grow w-full rounded-3xl overflow-hidden bg-night">
            {/* Top Bar - Health & Score */}
            <View className="flex-row items-center justify-between p-6 bg-night">
                <IconBtn name="close" overlay color="#fff" onPress={onClose} accessibilityLabel="Exit trivia" />
                <View className="flex-1 mx-4 h-6 bg-white/10 rounded-full overflow-hidden border border-white/10 relative">
                    <View 
                        style={{ width: `${health}%`, backgroundColor: healthColor }} 
                        className="h-full rounded-full"
                    />
                    <Text className="absolute w-full text-center text-xs font-semibold text-white leading-6">
                        Time left: {(health / 10).toFixed(1)}s
                    </Text>
                </View>
                <View className="bg-white/10 px-4 py-2 rounded-full border border-white/10">
                    <Text className="font-display text-xs text-white">{score}</Text>
                </View>
            </View>

            {/* Question */}
            <View className="h-[200px] p-6 justify-center">
                <Text className="text-accent-text font-semibold text-xs mb-4 text-center">
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
                    <Pressable
                        key={i}
                        onPress={() => handleAnswer(opt)}
                        accessibilityRole="button"
                        className="bg-white/10 px-6 h-[64px] justify-center rounded-2xl border border-white/10 active:opacity-85"
                    >
                        <Text 
                            className="text-white text-sm font-semibold text-center"
                            numberOfLines={2}
                            adjustsFontSizeToFit
                        >
                            {decodeHTMLEntities(opt)}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
};

export default TriviaSurvival;
