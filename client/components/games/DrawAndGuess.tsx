import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, TextInput, Dimensions, PanResponder, KeyboardAvoidingView, Platform} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DrawAndGuess = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [isSearching, setIsSearching] = useState(false);
  const [matchData, setMatchData] = useState<any>(null); // { roomId, role, word, opponent }
  
  const [paths, setPaths] = useState<string[][]>([]); // Array of lines, each line is array of "x,y"
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [guess, setGuess] = useState("");
  const [messages, setMessages] = useState<{username: string, text: string, isCorrect: boolean}[]>([]);
  
  const batchedPoints = useRef<string[]>([]);
  const batchTimer = useRef<any>(null);

  const matchDataRef = useRef(matchData);
  useEffect(() => {
    matchDataRef.current = matchData;
  }, [matchData]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    socket.on("draw_searching", () => {
      setIsSearching(true);
    });

    socket.on("draw_match_found", (data) => {
      setIsSearching(false);
      setMatchData(data);
      setPaths([]);
      setCurrentPath([]);
      setMessages([]);
      Alert.alert("Match Found!", `You are playing against ${data.opponent}`);
    });

    socket.on("receive_draw_data", (strokes: string[]) => {
      setPaths(prev => [...prev, strokes]);
    });

    socket.on("clear_draw_canvas", () => {
      setPaths([]);
    });

    socket.on("draw_guess_received", ({ guess, username }) => {
      setMessages(prev => [...prev, { username, text: guess, isCorrect: false }]);
      // If drawer sees the correct guess, end game (simplified)
      if (matchData?.role === "drawer" && guess.toLowerCase() === matchData.word.toLowerCase()) {
        endGame(username);
      }
    });

    socket.on("draw_partner_left", () => {
      Alert.alert("Game Over", "Your partner left the match.");
      resetMatch();
    });

    return () => {
      socket.off("draw_searching");
      socket.off("draw_match_found");
      socket.off("receive_draw_data");
      socket.off("clear_draw_canvas");
      socket.off("draw_guess_received");
      socket.off("draw_partner_left");
    };
  }, [matchData]);

  // Handle exiting the screen
  useEffect(() => {
    return () => {
      if (matchData?.roomId) {
        socket.emit("draw_leave", { userId: user?._id, roomId: matchData.roomId });
      }
    };
  }, [matchData]);

  const findMatch = () => {
    socket.emit("find_draw_match", { userId: user?._id, username: user?.username });
  };

  const resetMatch = () => {
    setMatchData(null);
    setPaths([]);
    setCurrentPath([]);
    setMessages([]);
    setIsSearching(false);
  };

  const endGame = async (winnerUsername: string) => {
    Alert.alert("Round Over!", `${winnerUsername} guessed correctly!`);
    if (winnerUsername === user?.username) {
      // I won, submit score
      await submitScore(100);
    }
    resetMatch();
  };

  const submitScore = async (score: number) => {
    try {
      await axios.post("/games/score", { gameName: "DrawAndGuess", score });
    } catch (err) {
      console.error("Failed to submit score", err);
    }
  };

  const clearCanvas = () => {
    setPaths([]);
    socket.emit("clear_draw_canvas", { roomId: matchData.roomId });
  };

  const sendGuess = () => {
    if (!guess.trim()) return;
    socket.emit("draw_guess", { roomId: matchData.roomId, guess, username: user?.username });
    
    // Optimistic local update
    setMessages(prev => [...prev, { username: user?.username || "Me", text: guess, isCorrect: false }]);
    setGuess("");
  };

  // --- DRAWING LOGIC (Throttled) ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => matchDataRef.current?.role === "drawer",
      onMoveShouldSetPanResponder: () => matchDataRef.current?.role === "drawer",
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const point = `${locationX},${locationY}`;
        setCurrentPath([point]);
        batchedPoints.current = [point];
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const point = `${locationX},${locationY}`;
        setCurrentPath(prev => [...prev, point]);
        batchedPoints.current.push(point);

        // Throttle sending to server (batch every 10 points)
        if (batchedPoints.current.length > 10) {
          if (matchDataRef.current?.roomId) {
            socket.emit("send_draw_data", { roomId: matchDataRef.current.roomId, strokes: batchedPoints.current });
          }
          setPaths(prev => [...prev, batchedPoints.current]);
          batchedPoints.current = [];
        }
      },
      onPanResponderRelease: () => {
        if (batchedPoints.current.length > 0) {
          if (matchDataRef.current?.roomId) {
            socket.emit("send_draw_data", { roomId: matchDataRef.current.roomId, strokes: batchedPoints.current });
          }
          setPaths(prev => [...prev, batchedPoints.current]);
        }
        setCurrentPath([]);
        batchedPoints.current = [];
      },
    })
  ).current;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "#F5F2EC" }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-12 pb-4 bg-card shadow-hair z-10">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
          <Ionicons name="arrow-back" size={24} color="#12100E" />
        </TouchableOpacity>
        <Text className="text-xl font-display text-ink">Draw & Guess</Text>
        <TouchableOpacity onPress={() => navigation.navigate('GameLeaderboard', { gameName: 'DrawAndGuess' })}>
          <Ionicons name="trophy" size={24} color="#B45309" />
        </TouchableOpacity>
      </View>

      {!matchData ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="color-palette" size={80} color="#2563EB" />
          <Text className="text-2xl font-display text-ink mt-6 mb-2">Multiplayer Pictionary</Text>
          <Text className="text-center text-ink-3 mb-8 px-4">
            Compete against random students. Draw the word, or guess what your opponent is drawing!
          </Text>
          <TouchableOpacity 
            onPress={findMatch}
            disabled={isSearching}
            className={`w-full py-4 rounded-xl items-center shadow-hair ${isSearching ? 'bg-ink-4' : 'bg-fam-career '}`}
          >
            <Text className="text-white font-display text-lg">{isSearching ? "Searching for players..." : "Find a Match"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1">
          {/* Status Bar */}
          <View className="bg-fam-career/10 p-4 border-b border-fam-career/15 flex-row justify-between items-center">
            <Text className="font-semibold text-ink-2">Vs: {matchData.opponent}</Text>
            {matchData.role === "drawer" ? (
              <View className="items-end">
                <Text className="text-xs text-ink-3">You are drawing:</Text>
                <Text className="font-semibold text-fam-career text-lg">{matchData.word}</Text>
              </View>
            ) : (
              <Text className="font-semibold text-danger">You are guessing!</Text>
            )}
          </View>

          {/* Canvas */}
          <View 
            className="w-full aspect-square bg-card border-b border-line overflow-hidden relative"
            {...(matchData.role === "drawer" ? panResponder.panHandlers : {})}
          >
            <Svg width="100%" height="100%">
              {paths.map((p, i) => (
                <Polyline key={i} points={p.join(" ")} fill="none" stroke="#12100E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentPath.length > 0 && (
                <Polyline points={currentPath.join(" ")} fill="none" stroke="#12100E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>

            {matchData.role === "drawer" && (
              <TouchableOpacity onPress={clearCanvas} className="absolute bottom-4 right-4 bg-paper-2 p-3 rounded-full shadow-hair">
                <Ionicons name="trash" size={20} color="#DC2626" />
              </TouchableOpacity>
            )}
          </View>

          {/* Guesses / Chat */}
          <View className="flex-1 bg-paper p-4">
            <View className="flex-1 mb-4">
              {messages.map((m, i) => (
                <Text key={i} className="mb-2">
                  <Text className="font-semibold text-ink-2">{m.username}: </Text>
                  <Text className="text-ink-2">{m.text}</Text>
                </Text>
              ))}
            </View>
            
            {matchData.role === "guesser" && (
              <View className="flex-row items-center">
                <TextInput
                  value={guess}
                  onChangeText={setGuess}
                  placeholder="Type your guess..."
                  className="flex-1 bg-paper border border-line rounded-full px-5 py-3 shadow-hair mr-2"
                  onSubmitEditing={sendGuess}
                />
                <TouchableOpacity onPress={sendGuess} className="bg-fam-career w-12 h-12 rounded-full items-center justify-center shadow-hair">
                  <Ionicons name="send" size={20} color="white" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default DrawAndGuess;
