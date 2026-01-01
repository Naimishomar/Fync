import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket'; 
import { useAuth } from '../../context/auth.context';

type Props = NativeStackScreenProps<RootStackParamList, 'WaitingRoom'>;

const WaitingRoom: React.FC<Props> = ({ route, navigation }) => {
  const { roomId, startTime } = route.params;
  const { user } = useAuth();
  
  const [status, setStatus] = useState<string>("Connecting...");
  const [countDown, setCountDown] = useState<string>("--:--");

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
            setCountDown("Starting...");
            clearInterval(interval);
        } else {
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setCountDown(`Starts in: ${m}m ${s}s`);
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <View className="flex-1 justify-center items-center bg-white p-6">
      <Text className="text-3xl font-bold mb-4">{roomId}</Text>
      <View className="bg-blue-50 p-10 rounded-full w-64 h-64 justify-center items-center">
        <Text className="text-2xl font-bold text-blue-600 text-center">
          {countDown}
        </Text>
      </View>
      <Text className="mt-8 text-gray-500 text-center">
        Do not close this app.
      </Text>
    </View>
  );
};

export default WaitingRoom;