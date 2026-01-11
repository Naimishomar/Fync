import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Alert, BackHandler, ActivityIndicator, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizScreen'>;

const QuizScreen: React.FC<Props> = ({ route, navigation }) => {
  // Extract opponent and endTime
  const { questions, roomId, mode, endTime, opponent } = route.params as any; 
  const { user } = useAuth();
  
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  
  // --- TIMER LOGIC (FIXED) ---
  const calculateRemaining = () => {
    if (!endTime) return 300; // Fallback to 5 mins if something breaks
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = Math.floor((end - now) / 1000);
    return diff > 0 ? diff : 0;
  };

  // Initialize with calculated time immediately
  const [timeLeft, setTimeLeft] = useState(calculateRemaining());
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (submitted || waitingForOpponent) return;

    const timer = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted, waitingForOpponent, endTime]);

  // --- SUBMIT ---
  const submitQuiz = () => {
    if (isSubmittingRef.current || submitted) return;
    isSubmittingRef.current = true;
    setSubmitted(true);
    
    if (mode === 'custom') {
      socket.emit("submit_custom_quiz", { roomId, answers, userId: user?._id });
    } else {
      socket.emit("submit_1v1", { matchRoomId: roomId, answers, userId: user?._id });
    }
  };

  const handleAutoSubmit = () => {
    if (isSubmittingRef.current) return;
    Alert.alert("Time's Up!", "Submitting your answers automatically.");
    submitQuiz();
  };

  // --- LISTENERS ---
  useEffect(() => {
    const onQuizCompleted = ({ score }: any) => {
      navigation.replace("LeaderboardScreen", { roomId, myScore: score });
    };

    const onWaiting = () => setWaitingForOpponent(true);

    const on1v1Result = ({ result, myScore, opScore, message }: any) => {
        setWaitingForOpponent(false);
        Alert.alert(
            message,
            `Your Score: ${myScore}\nOpponent Score: ${opScore}`,
            [{ text: "Exit", onPress: () => navigation.navigate("Tabs") }]
        );
    };

    socket.on("quiz_completed", onQuizCompleted);
    socket.on("waiting_for_opponent", onWaiting);
    socket.on("1v1_result", on1v1Result);

    return () => {
      socket.off("quiz_completed", onQuizCompleted);
      socket.off("waiting_for_opponent", onWaiting);
      socket.off("1v1_result", on1v1Result);
    };
  }, [navigation, roomId]);

  // Back Handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- RENDER WAITING ---
  if (waitingForOpponent) {
      return (
          <View className="flex-1 justify-center items-center bg-white p-6">
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text className="text-xl font-bold mt-6">Finished!</Text>
              <Text className="text-gray-500 mt-2">Waiting for {opponent?.name || "opponent"}...</Text>
          </View>
      );
  }

  return (
    <View className="flex-1 bg-white">
      {/* --- HEADER --- */}
      <View className="bg-white p-4 pt-10 border-b border-gray-100 shadow-sm z-10">
        
        {/* 1v1 Opponent Banner */}
        {mode === '1v1' && opponent && (
            <View className="flex-row items-center justify-between mb-4 bg-purple-50 p-3 rounded-xl border border-purple-100">
                <View className="flex-row items-center gap-3">
                     <View className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden">
                        {opponent.avatar ? (
                            <Image source={{ uri: opponent.avatar }} className="w-full h-full" />
                        ) : (
                            <View className="w-full h-full bg-purple-200 justify-center items-center">
                                <Text className="font-bold text-purple-700">{opponent.username?.[0]}</Text>
                            </View>
                        )}
                     </View>
                     <View>
                         <Text className="text-xs text-gray-500">Playing Against</Text>
                         <Text className="font-bold text-gray-800">{opponent.name || opponent.username}</Text>
                     </View>
                </View>
                <Text className="text-purple-600 font-bold text-xs">1v1 BATTLE</Text>
            </View>
        )}

        <View className="flex-row justify-between items-center">
            <Text className="font-bold text-lg text-gray-700">Q: {questions.length}</Text>
            <View className={`px-4 py-2 rounded-lg ${timeLeft < 60 ? 'bg-red-500' : 'bg-black'}`}>
                <Text className="text-white font-mono font-bold">{formatTime(timeLeft)}</Text>
            </View>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {questions.map((q: any, index: number) => (
          <View key={index} className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <Text className="text-lg font-semibold mb-4">{index + 1}. {q.question}</Text>
            {q.options.map((opt: string, optIndex: number) => (
              <Pressable
                key={optIndex}
                disabled={submitted}
                onPress={() => {
                  const newAns = [...answers];
                  newAns[index] = optIndex;
                  setAnswers(newAns);
                }}
                className={`p-4 mb-2 rounded-lg border flex-row items-center ${
                  answers[index] === optIndex ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'
                }`}
              >
                 <View className={`w-4 h-4 rounded-full border mr-3 ${
                    answers[index] === optIndex ? 'border-4 border-blue-500' : 'border-gray-400'
                 }`} />
                <Text className="text-gray-800 flex-1">{opt}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <View className="p-4 border-t border-gray-100">
        <Pressable 
          onPress={submitQuiz}
          disabled={submitted}
          className={`p-4 rounded-xl shadow-md ${submitted ? 'bg-gray-400' : 'bg-green-600'}`}
        >
          <Text className="text-white text-center font-bold text-lg">
            {submitted ? "Submitting..." : "Submit Answers"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default QuizScreen;