import React, { useState, useEffect, useRef } from 'react';
import {View, Text, Pressable, TextInput, Dimensions, PanResponder, KeyboardAvoidingView, Platform, FlatList} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, IconTile, Button } from '../ui/kit';

type Msg = { username: string; text: string; isCorrect: boolean };
const GuessLine = React.memo(function GuessLine({ m }: { m: Msg }) {
  return (
    <Text className="mb-2">
      <Text className="font-semibold text-ink">{m.username}: </Text>
      <Text className="text-ink-2">{m.text}</Text>
    </Text>
  );
});
const renderGuess = ({ item }: { item: Msg }) => <GuessLine m={item} />;
const guessKey = (_: Msg, i: number) => String(i);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DrawAndGuess = () => {
  const navigation = useNavigation<any>();
  const bottomInset = useBottomInset();
  const { user } = useAuth();

  const [isSearching, setIsSearching] = useState(false);
  const [matchData, setMatchData] = useState<any>(null); // { roomId, role, word, opponent }
  
  const [paths, setPaths] = useState<string[][]>([]); // Array of lines, each line is array of "x,y"
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [guess, setGuess] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  
  const batchedPoints = useRef<string[]>([]);
  const messagesRef = useRef<FlatList<any>>(null);
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
  // Keyed on the room, not the match object: any round/score update replaced
  // matchData, and the cleanup then sent draw_leave mid-game.
  const roomId = matchData?.roomId;
  const userId = user?._id;
  useEffect(() => {
    if (!roomId) return;
    return () => {
      socket.emit("draw_leave", { userId, roomId });
    };
  }, [roomId, userId]);

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
          // Carry the last point over so consecutive batches join up instead of
          // leaving a gap in the stroke every ten points.
          batchedPoints.current = [point];
        }
      },
      onPanResponderRelease: () => {
        if (batchedPoints.current.length > 1) {
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: C.paper }}>
      {/* Header */}
      <AppBar title="Draw & Guess" onBack={() => navigation.goBack()}
        right={<IconBtn name="trophy-outline" accessibilityLabel="Leaderboard" onPress={() => navigation.navigate('GameLeaderboard', { gameName: 'DrawAndGuess' })} />} />

      {!matchData ? (
        <View className="flex-1 items-center justify-center p-6">
          <IconTile icon="color-palette-outline" size={80} iconSize={36} />
          <Text className="text-2xl font-display text-ink mt-6 mb-2" accessibilityRole="header">Multiplayer Pictionary</Text>
          <Text className="text-center text-ink-3 mb-8 px-4">
            Compete against random students. Draw the word, or guess what your opponent is drawing!
          </Text>
          <Button variant="primary" block onPress={findMatch} loading={isSearching} title="Find a match"
            accessibilityLabel={isSearching ? 'Searching for players' : 'Find a match'} />
          {isSearching ? <Text className="text-ink-3 mt-3">Searching for players...</Text> : null}
        </View>
      ) : (
        <View className="flex-1">
          {/* Status Bar */}
          <View className="bg-paper-2 px-gutter py-3 border-b border-line flex-row justify-between items-center">
            <Text className="font-semibold text-ink-2">Vs: {matchData.opponent}</Text>
            {matchData.role === "drawer" ? (
              <View className="items-end">
                <Text className="text-xs text-ink-3">You are drawing:</Text>
                <Text className="font-display text-ink text-lg">{matchData.word}</Text>
              </View>
            ) : (
              <Text className="font-semibold text-accent-text">You are guessing!</Text>
            )}
          </View>

          {/* Canvas */}
          <View 
            className="w-full aspect-square bg-card border-b border-line overflow-hidden relative"
            {...(matchData.role === "drawer" ? panResponder.panHandlers : {})}
          >
            <Svg width="100%" height="100%">
              {paths.map((p, i) => (
                <Polyline key={i} points={p.join(" ")} fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentPath.length > 0 && (
                <Polyline points={currentPath.join(" ")} fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>

            {matchData.role === "drawer" && (
              <View className="absolute right-4 bottom-4">
                <IconBtn name="trash-outline" boxed color={C.danger} onPress={clearCanvas} accessibilityLabel="Clear canvas" />
              </View>
            )}
          </View>

          {/* Guesses / Chat */}
          <View className="flex-1 bg-paper p-4" style={{ paddingBottom: bottomInset }}>
            {/* Scrolls: as a plain stack, enough guesses pushed the input off-screen. */}
            <FlatList
              style={{ flex: 1, marginBottom: 16 }}
              data={messages}
              keyExtractor={guessKey}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: true })}
              ref={messagesRef}
              renderItem={renderGuess}
            />
            
            {matchData.role === "guesser" && (
              <View className="flex-row items-center">
                <TextInput placeholderTextColor={C.ink4}
                  value={guess}
                  onChangeText={setGuess}
                  placeholder="Type your guess..."
                  className="flex-1 bg-card border border-line rounded-full px-5 mr-2 text-ink" style={{ minHeight: 48 }}
                  onSubmitEditing={sendGuess}
                />
                <Pressable onPress={sendGuess} className="bg-brand-500 w-12 h-12 rounded-full items-center justify-center active:opacity-85"
                  accessibilityRole="button" accessibilityLabel="Send guess">
                  <Ionicons name="send" size={20} color={C.onBrand} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default DrawAndGuess;
