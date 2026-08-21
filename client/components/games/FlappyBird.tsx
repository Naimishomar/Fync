import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableWithoutFeedback, Dimensions, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../../context/axiosConfig';

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
  const [birdY, setBirdY] = useState(SCREEN_HEIGHT / 2);
  const [velocity, setVelocity] = useState(0);
  const [pipes, setPipes] = useState<any[]>([]);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  
  const gameLoopRef = useRef<any>(null);
  const scoreSubmitted = useRef(false);

  // --- GAME LOOP ---
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      gameLoopRef.current = setInterval(() => {
        // Physics
        setBirdY((y) => y + velocity);
        setVelocity((v) => v + GRAVITY);

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
  }, [isPlaying, isGameOver, velocity]);

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
        <View className="absolute top-12 left-5 z-10">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Score */}
        <View className="absolute top-20 w-full items-center z-10">
          <Text className="text-white text-5xl font-display shadow-hair">{score}</Text>
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
           <View className="w-2 h-2 bg-card rounded-full absolute right-2 top-2">
             <View className="w-1 h-1 bg-ink rounded-full absolute right-0 top-0" />
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
              <View className="bg-card p-6 rounded-card items-center shadow-hair">
                <Text className="text-3xl font-display text-danger mb-2">GAME OVER</Text>
                <Text className="text-lg text-ink-3 mb-6">Score: {score}</Text>
                <TouchableOpacity onPress={resetGame} className="bg-fam-social px-gutter py-3 rounded-full">
                  <Text className="text-white font-display text-lg">Play Again</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('GameLeaderboard', { gameName: 'FlappyBird' })} className="mt-4">
                  <Text className="text-fam-social font-semibold">View Leaderboard</Text>
                </TouchableOpacity>
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
