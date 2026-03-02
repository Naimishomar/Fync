import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Alert, BackHandler, ActivityIndicator, Image, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizScreen'>;

const QuizScreen: React.FC<Props> = ({ route, navigation }) => {
  const { questions, roomId, mode, endTime, opponent } = route.params as any; 
  const { user } = useAuth();
  
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  
  // Pagination State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // --- TIMER LOGIC ---
  const calculateRemaining = () => {
    if (!endTime) return 300; 
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = Math.floor((end - now) / 1000);
    return diff > 0 ? diff : 0;
  };

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
    setShowConfirmModal(false);
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
    setShowConfirmModal(false);
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

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- RENDER WAITING MODAL ---
  if (waitingForOpponent) {
      return (
        <View className="flex-1 bg-black">
          <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
          <SafeAreaView className="flex-1 justify-center items-center px-6">
              <View className="bg-[#1e1e1e]/90 p-8 rounded-3xl border border-white/10 items-center w-full max-w-sm shadow-2xl">
                  <View className="bg-pink-500/20 p-4 rounded-full mb-6 border border-pink-500/30">
                      <ActivityIndicator size="large" color="#ec4899" />
                  </View>
                  <Text className="text-2xl font-black text-white mb-2 text-center">Submitted!</Text>
                  <Text className="text-gray-400 text-center text-lg">
                      Waiting for <Text className="font-bold text-pink-500">{opponent?.name || "opponent"}</Text> to finish...
                  </Text>
              </View>
          </SafeAreaView>
        </View>
      );
  }

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const isFirstQuestion = currentIndex === 0;

  return (
    <View className="flex-1 bg-black">
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1">
        {/* --- HEADER --- */}
        <View className="px-6 pt-4 pb-4 border-b border-white/10 z-10 bg-black/40">
          
          {mode === '1v1' && opponent && (
              <View className="flex-row items-center justify-between mb-5 bg-[#1e1e1e]/80 p-3 rounded-2xl border border-white/10 shadow-lg">
                  <View className="flex-row items-center gap-3">
                       <View className="w-10 h-10 bg-gray-800 rounded-full border border-white/10 overflow-hidden items-center justify-center">
                          {opponent.avatar ? (
                              <Image source={{ uri: opponent.avatar }} className="w-full h-full" />
                          ) : (
                              <Text className="font-bold text-gray-400">{opponent.username?.[0]?.toUpperCase()}</Text>
                          )}
                       </View>
                       <View>
                           <Text className="text-[10px] text-gray-400 uppercase tracking-widest">Playing Against</Text>
                           <Text className="font-bold text-white">{opponent.name || opponent.username}</Text>
                       </View>
                  </View>
                  <View className="bg-pink-500/20 px-3 py-1 rounded-full border border-pink-500/30">
                      <Text className="text-pink-400 font-bold text-[10px] tracking-widest">1V1 BATTLE</Text>
                  </View>
              </View>
          )}

          <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                  <Text className="font-bold text-lg text-gray-300 tracking-widest">
                     <Text className="text-pink-500 text-xl">{currentIndex + 1}</Text> / {questions.length}
                  </Text>
              </View>
              
              <View className={`px-4 py-2 rounded-xl border flex-row items-center shadow-lg ${
                  timeLeft < 60 ? 'bg-red-500/20 border-red-500/50 shadow-red-500/20' : 'bg-[#2a2a2a] border-white/10'
              }`}>
                  <Ionicons name="time-outline" size={18} color={timeLeft < 60 ? '#f87171' : '#ec4899'} className="mr-2" />
                  <Text className={`font-mono font-black text-lg ml-2 ${timeLeft < 60 ? 'text-red-400' : 'text-pink-500'}`}>
                      {formatTime(timeLeft)}
                  </Text>
              </View>
          </View>
          
          {/* Progress Bar */}
          <View className="w-full h-1.5 bg-gray-800 rounded-full mt-4 overflow-hidden">
              <View 
                className="h-full bg-pink-500 rounded-full" 
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} 
              />
          </View>
        </View>

        {/* --- CURRENT QUESTION --- */}
        <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
            <View className="mb-6 bg-[#1e1e1e]/80 p-6 rounded-3xl border border-white/10 shadow-2xl">
              <Text className="text-xl font-bold text-white mb-8 leading-8">
                {currentQuestion.question}
              </Text>
              
              {currentQuestion.options.map((opt: string, optIndex: number) => {
                const isSelected = answers[currentIndex] === optIndex;
                return (
                  <TouchableOpacity
                    key={optIndex}
                    disabled={submitted}
                    activeOpacity={0.8}
                    onPress={() => {
                      const newAns = [...answers];
                      newAns[currentIndex] = optIndex;
                      setAnswers(newAns);
                    }}
                    className={`p-5 mb-4 rounded-2xl border flex-row items-center transition-all ${
                      isSelected ? 'bg-pink-600/20 border-pink-500' : 'bg-[#2a2a2a] border-white/5'
                    }`}
                  >
                    <View className={`w-6 h-6 rounded-full border-2 mr-4 items-center justify-center ${
                      isSelected ? 'border-pink-500 bg-pink-500/20' : 'border-gray-500 bg-transparent'
                    }`}>
                        {isSelected && <View className="w-3 h-3 bg-pink-500 rounded-full" />}
                    </View>
                    <Text className={`flex-1 text-base ${isSelected ? 'text-white font-bold' : 'text-gray-300'}`}>
                        {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
        </ScrollView>

        {/* --- NAVIGATION BUTTONS --- */}
        <View className="p-6 bg-black/60 border-t border-white/10 flex-row justify-between items-center pb-10">
          
          {/* Previous Button */}
          <TouchableOpacity 
            onPress={() => setCurrentIndex(prev => prev - 1)}
            disabled={isFirstQuestion || submitted}
            className={`py-4 px-6 rounded-2xl border ${
                isFirstQuestion ? 'bg-[#2a2a2a]/50 border-white/5 opacity-50' : 'bg-[#2a2a2a] border-white/10'
            }`}
          >
             <Ionicons name="chevron-back" size={24} color={isFirstQuestion ? "#6b7280" : "white"} />
          </TouchableOpacity>

          {/* Next / Submit Button */}
          {!isLastQuestion ? (
              <TouchableOpacity 
                onPress={() => setCurrentIndex(prev => prev + 1)}
                className="py-4 px-10 rounded-2xl bg-pink-600 border border-pink-500/50 flex-row items-center shadow-lg"
              >
                <Text className="text-white font-black text-lg tracking-widest mr-2">NEXT</Text>
                <Ionicons name="chevron-forward" size={20} color="white" />
              </TouchableOpacity>
          ) : (
              <TouchableOpacity 
                onPress={() => setShowConfirmModal(true)}
                disabled={submitted}
                className="py-4 px-8 rounded-2xl bg-green-500 border border-green-400/50 flex-row items-center shadow-lg"
              >
                <Text className="text-white font-black text-lg tracking-widest mr-2">SUBMIT</Text>
                <Ionicons name="checkmark-done" size={24} color="white" />
              </TouchableOpacity>
          )}

        </View>

        {/* --- CONFIRMATION MODAL --- */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View className="flex-1 bg-black/80 justify-center items-center px-6">
            <View className="bg-[#1e1e1e] border border-white/10 p-8 rounded-3xl w-full max-w-sm items-center shadow-2xl">
                <View className="bg-yellow-500/20 p-4 rounded-full mb-6 border border-yellow-500/30">
                    <Ionicons name="warning" size={40} color="#eab308" />
                </View>
                <Text className="text-2xl font-black text-white mb-2 text-center">Ready to Submit?</Text>
                
                {answers.includes(-1) ? (
                    <Text className="text-red-400 text-center mb-8">
                        You have <Text className="font-bold">{answers.filter(a => a === -1).length}</Text> unanswered questions!
                    </Text>
                ) : (
                    <Text className="text-gray-400 text-center mb-8">
                        You have answered all questions. You cannot change your answers after submitting.
                    </Text>
                )}

                <View className="flex-row w-full gap-4">
                    <TouchableOpacity 
                        onPress={() => setShowConfirmModal(false)}
                        className="flex-1 py-4 bg-[#2a2a2a] rounded-xl border border-white/10 items-center"
                    >
                        <Text className="text-white font-bold text-lg">Review</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={submitQuiz}
                        className="flex-1 py-4 bg-green-500 rounded-xl border border-green-400/50 items-center shadow-lg"
                    >
                        <Text className="text-white font-bold text-lg tracking-widest">Confirm</Text>
                    </TouchableOpacity>
                </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
};

export default QuizScreen;