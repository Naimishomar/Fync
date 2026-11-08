import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableWithoutFeedback, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../../context/axiosConfig';
import { Button, IconBtn } from '../ui/kit';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRAVITY = 0.8;
const JUMP = -12;
const PIPE_WIDTH = 60;
const PIPE_SPEED = 4;
const BIRD_SIZE = 40;
const GAP_SIZE = 180;
const BIRD_X = 50;

const FlappyBird = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [birdY, setBirdY] = useState(SCREEN_HEIGHT / 2);
  const [velocity, setVelocity] = useState(0);
  const [pipes, setPipes] = useState<any[]>([]);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  
  const gameLoopRef = useRef<any>(null);
  const scoreSubmitted = useRef(false);
  // Read by the loop. As a dependency it tore down and rebuilt the interval on
  // every 24ms tick, which is what made the bird stutter.
  const velocityRef = useRef(0);

  // --- GAME LOOP ---
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      gameLoopRef.current = setInterval(() => {
        // Physics
        const v = velocityRef.current;
        velocityRef.current = v + GRAVITY;
        setBirdY((y) => y + v);
        setVelocity(velocityRef.current);

        // Pipes Movement
        setPipes((currentPipes) => {
          let newPipes = currentPipes.map((p) => ({ ...p, x: p.x - PIPE_SPEED }));
          
          // Remove off-screen pipes
          if (newPipes.length > 0 && newPipes[0].x < -PIPE_WIDTH) {
            newPipes.shift();
            setScore((s) => s + 1);
          }

          // Generate new pipes
          if (newPipes.length === 0 || newPipes[newPipes.length - 1].x < SCREEN_WIDTH - 200) {
            const gapY = Math.random() * (SCREEN_HEIGHT - 300) + 100;
            newPipes.push({ x: SCREEN_WIDTH, gapY });
          }

          return newPipes;
        });
      }, 24);
    }

    return () => clearInterval(gameLoopRef.current);
  }, [isPlaying, isGameOver]);

  // --- COLLISION DETECTION ---
  useEffect(() => {
    if (!isPlaying) return;

    const birdTop = birdY;
    const birdBottom = birdY + BIRD_SIZE;
    const birdLeft = BIRD_X;
    const birdRight = BIRD_X + BIRD_SIZE;

    // Floor/Ceiling
    if (birdBottom >= SCREEN_HEIGHT || birdTop <= 0) {
      gameOver();
    }

    // Pipes
    pipes.forEach((pipe) => {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;
      const gapTop = pipe.gapY;
      const gapBottom = pipe.gapY + GAP_SIZE;

      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        if (birdTop < gapTop || birdBottom > gapBottom) {
          gameOver();
        }
      }
    });
  }, [birdY, pipes]);

  const jump = () => {
    if (!isPlaying && !isGameOver) {
      setIsPlaying(true);
    }
    if (isGameOver) {
      resetGame();
      return;
    }
    velocityRef.current = JUMP;
    setVelocity(JUMP);
  };

  const gameOver = () => {
    setIsGameOver(true);
    setIsPlaying(false);
    clearInterval(gameLoopRef.current);
    if (!scoreSubmitted.current && score > 0) {
      submitScore();
      scoreSubmitted.current = true;
    }
  };

  const submitScore = async () => {
    try {
      await axios.post("/games/score", { gameName: "FlappyBird", score });
    } catch (err) {
      console.error("Failed to submit score", err);
    }
  };

  const resetGame = () => {
    setBirdY(SCREEN_HEIGHT / 2);
    velocityRef.current = 0;
    setVelocity(0);
    setPipes([]);
    setScore(0);
    setIsGameOver(false);
    scoreSubmitted.current = false;
  };

  return (
    <TouchableWithoutFeedback onPress={jump}>
      <View className="flex-1 bg-fam-social overflow-hidden relative">
        {/* Header */}
        <View className="absolute left-5 z-10" style={{ top: Math.max(insets.top, 24) + 8 }}>
<IconBtn name="arrow-back" overlay color="#fff" onPress={() => navigation.goBack()} accessibilityLabel="Go back" style={{ marginLeft: -4 }} />
        </View>

        {/* Score */}
        <View className="absolute w-full items-center z-10" style={{ top: Math.max(insets.top, 24) + 40 }}>
          <Text className="text-white text-5xl font-display">{score}</Text>
        </View>

        {/* Bird */}
        <View
          style={{
            position: 'absolute',
            left: BIRD_X,
            top: birdY,
            width: BIRD_SIZE,
            height: BIRD_SIZE,
            backgroundColor: '#B45309', // Yellow bird
            borderRadius: BIRD_SIZE / 2,
            borderWidth: 2,
            borderColor: '#b45309',
            justifyContent: 'center',
            alignItems: 'center',
            transform: [{ rotate: `${Math.min(Math.max(velocity * 3, -30), 90)}deg` }]
          }}
        >
           <View className="w-2 h-2 bg-white rounded-full absolute right-2 top-2">
             <View className="w-1 h-1 bg-black rounded-full absolute right-0 top-0" />
           </View>
        </View>

        {/* Pipes */}
        {pipes.map((pipe, i) => (
          <React.Fragment key={i}>
            {/* Top Pipe */}
            <View
              style={{
                position: 'absolute',
                left: pipe.x,
                top: 0,
                width: PIPE_WIDTH,
                height: pipe.gapY,
                backgroundColor: '#047857',
                borderWidth: 2,
                borderColor: '#047857',
                borderBottomWidth: 5,
              }}
            />
            {/* Bottom Pipe */}
            <View
              style={{
                position: 'absolute',
                left: pipe.x,
                top: pipe.gapY + GAP_SIZE,
                width: PIPE_WIDTH,
                height: SCREEN_HEIGHT - (pipe.gapY + GAP_SIZE),
                backgroundColor: '#047857',
                borderWidth: 2,
                borderColor: '#047857',
                borderTopWidth: 5,
              }}
            />
          </React.Fragment>
        ))}

        {/* Start / Game Over Overlay */}
        {!isPlaying && (
          <View className="absolute inset-0 bg-black/40 justify-center items-center">
            {isGameOver ? (
              <View className="bg-card p-6 rounded-2xl items-center border border-line" style={{ width: 280, gap: 12 }}>
                <Text className="text-2xl font-display text-ink" accessibilityRole="header">Game over</Text>
                <Text className="text-base text-ink-3 mb-2">Score: {score}</Text>
                <Button variant="primary" title="Play again" icon="refresh" onPress={resetGame} block />
                <Button variant="tertiary" title="View leaderboard" onPress={() => navigation.navigate('GameLeaderboard', { gameName: 'FlappyBird' })} block />
              </View>
            ) : (
              <View className="items-center">
                <Ionicons name="hand-right" size={48} color="white" />
                <Text className="text-white text-2xl font-display mt-4">Tap to flap</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

export default FlappyBird;
