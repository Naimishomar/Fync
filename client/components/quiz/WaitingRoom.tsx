import React, { useEffect, useState, useRef } from 'react';
import {View, Text, Animated, TouchableOpacity, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

type Props = NativeStackScreenProps<RootStackParamList, 'WaitingRoom'>;

const WaitingRoom: React.FC<Props> = ({ route, navigation }) => {
  const { roomId, startTime } = route.params;
  const { user } = useAuth();

  const [status, setStatus] = useState<string>("Connecting...");
  const [timeString, setTimeString] = useState<string>("--:--");
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Breathing animation value
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse Animation Effect
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (!user) return;

    socket.emit("join_custom_room", { roomId, userId: user._id });

    // 1. START QUIZ
    socket.on("start_quiz", (data) => {
      navigation.replace("QuizScreen", {
        questions: data.questions,
        roomId,
        mode: 'custom',
        endTime: data.endTime
      });
    });

    // 2. QUIZ ALREADY ENDED (Late Joiner)
    socket.on("quiz_ended", () => {
      Alert.alert("Quiz Expired", "This quiz has ended.", [
        { text: "View Leaderboard", onPress: () => navigation.replace("LeaderboardScreen", { roomId }) }
      ]);
    });

    // 3. ALREADY ATTEMPTED
    socket.on("already_attempted", () => {
      navigation.replace("LeaderboardScreen", { roomId });
    });

    socket.on("error", (msg) => setStatus(msg));

    return () => {
      socket.off("start_quiz");
      socket.off("quiz_ended");
      socket.off("already_attempted");
      socket.off("error");
    };
  }, [navigation, roomId, user]);

  // Visual Countdown to Start Time
  useEffect(() => {
    const target = new Date(startTime).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeString("STARTING...");
        setIsStarting(true);
        clearInterval(interval);
      } else {
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        // Format as MM:SS
        setTimeString(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1 justify-between px-gutter pb-12">

        {/* HEADER */}
        <View className="flex-row items-center justify-between pt-8">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.9}
            className="w-11 h-11 items-center justify-center rounded-xl"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="close" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-ink text-3xl font-display uppercase">
            The <Text className="text-accent-text">Lobby</Text>
          </Text>
          <View style={{ width: 48 }} /> {/* Spacer for centering */}
        </View>

        {/* MAIN CONTENT */}
        <View className="items-center">

          {/* Room ID Badge */}
          <View className="bg-card px-gutter py-3 rounded-full border border-line mb-14 flex-row items-center shadow-hair">
            <View className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
            <Text className="text-ink-3 font-display ml-3 uppercase">Node: <Text className="text-ink">{roomId}</Text></Text>
          </View>

          {/* Pulsing Timer Circle */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View className={`w-72 h-72 rounded-sheet border border-line items-center justify-center shadow-hair overflow-hidden bg-card`}>
              <View className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16" />
              <View className="absolute bottom-0 left-0 w-32 h-32 bg-paper-2 rounded-full -ml-16 -mb-16" />

              {!isStarting && (
                <Text className="font-display text-label text-ink-3 uppercase mt-6 mb-4">Initializes In</Text>
              )}
              <Text className={`font-display uppercase text-center px-4 ${isStarting ? 'text-ink text-4xl' : 'text-ink text-6xl'}`}>
                {timeString}
              </Text>
            </View>
          </Animated.View>

          <Text className="font-sans text-sm text-ink-3 mt-16 text-center px-gutter">
            {isStarting ? "Establish connection... Preparing module." : "Awaiting Host protocol to initiate the sequence."}
          </Text>

        </View>

        {/* FOOTER WARNING */}
        <View className="bg-card p-card-pad rounded-sheet flex-row items-center shadow-hair border border-line">
          <View className="w-12 h-12 bg-paper-2 rounded-card items-center justify-center border border-line">
            <Ionicons name="shield-checkmark" size={24} color="#F97316" />
          </View>
          <Text className="text-ink-3 ml-5 flex-1 text-label font-semibold uppercase leading-5">
            <Text className="font-display text-ink">Protocol Active.</Text> Maintain active connection. Disconnection will result in session void.
          </Text>
        </View>

      </SafeAreaView>
    </View>
  );
};

export default WaitingRoom;
