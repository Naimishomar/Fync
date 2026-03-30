import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Alert, BackHandler, ActivityIndicator, Image, TouchableOpacity, Modal, StatusBar } from 'react-native';
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

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const isFirstQuestion = currentIndex === 0;

  // --- RENDER WAITING MODAL ---
  if (waitingForOpponent) {
      return (
        <View className="flex-1 bg-[#F8FAFC]">
          <StatusBar barStyle="dark-content" />
          <SafeAreaView className="flex-1 justify-center items-center px-10">
              <View className="bg-white p-10 rounded-[40px] border border-slate-100 items-center w-full shadow-2xl shadow-black/5">
                  <View className="bg-pink-50 p-6 rounded-full mb-8 border border-pink-100">
                      <ActivityIndicator size="large" color="#ec4899" />
                  </View>
                  <Text className="text-3xl font-black italic tracking-tighter text-zinc-900 mb-2 text-center uppercase">Submitted!</Text>
                  <Text className="text-slate-400 text-center text-lg font-bold uppercase tracking-tight">
                      Waiting for <Text className="font-black text-pink-500 italic">{opponent?.name || "Target"}</Text> to finalize...
                  </Text>
              </View>
          </SafeAreaView>
        </View>
      );
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">
        {/* --- HEADER --- */}
        <View className="px-8 pt-8 pb-6 border-b border-slate-100 bg-white shadow-sm shadow-black/5">
          
          {mode === '1v1' && opponent && (
              <View className="flex-row items-center justify-between mb-8 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm shadow-black/5">
                  <View className="flex-row items-center gap-3">
                       <View className="w-12 h-12 bg-white rounded-2xl border border-slate-100 overflow-hidden items-center justify-center shadow-sm">
                          {opponent.avatar ? (
                              <Image source={{ uri: opponent.avatar }} className="w-full h-full" />
                          ) : (
                              <Text className="font-black text-slate-300 text-xl italic">{opponent.username?.[0]?.toUpperCase()}</Text>
                          )}
                       </View>
                       <View>
                           <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Global Opponent</Text>
                           <Text className="font-black italic text-zinc-900 uppercase tracking-tighter">{opponent.name || opponent.username}</Text>
                       </View>
                  </View>
                  <View className="bg-pink-500 px-4 py-1.5 rounded-full shadow-lg shadow-pink-500/20">
                      <Text className="text-white font-black italic text-[10px] tracking-widest uppercase">1V1 Match</Text>
                  </View>
              </View>
          )}

          <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                  <Text className="font-black italic text-xl text-zinc-900 tracking-tighter uppercase">
                     Q. <Text className="text-pink-500 text-2xl">{currentIndex + 1}</Text> / {questions.length}
                  </Text>
              </View>
              
              <View className={`px-5 py-2.5 rounded-2xl border flex-row items-center shadow-sm ${
                  timeLeft < 60 ? 'bg-red-50 border-red-100 shadow-red-500/5' : 'bg-slate-50 border-slate-100 shadow-black/5'
              }`}>
                  <Ionicons name="stopwatch" size={20} color={timeLeft < 60 ? '#f87171' : '#ec4899'} />
                  <Text className={`font-black italic text-xl ml-3 tracking-tighter uppercase ${timeLeft < 60 ? 'text-red-400' : 'text-zinc-900'}`}>
                      {formatTime(timeLeft)}
                  </Text>
              </View>
          </View>
          
          {/* Progress Bar */}
          <View className="w-full h-2 bg-slate-50 rounded-full mt-6 overflow-hidden border border-slate-100">
              <View 
                className="h-full bg-pink-500 rounded-full" 
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} 
              />
          </View>
        </View>

        {/* --- CURRENT QUESTION --- */}
        <ScrollView className="flex-1 px-8 pt-10" showsVerticalScrollIndicator={false}>
            <View className="mb-10 bg-white p-8 rounded-[40px] border border-slate-100 shadow-2xl shadow-black/5">
              <Text className="text-2xl font-black italic text-zinc-900 mb-10 leading-8 tracking-tighter uppercase">
                {currentQuestion.question}
              </Text>
              
              {currentQuestion.options.map((opt: string, optIndex: number) => {
                const isSelected = answers[currentIndex] === optIndex;
                return (
                  <TouchableOpacity
                    key={optIndex}
                    disabled={submitted}
                    activeOpacity={0.9}
                    onPress={() => {
                      const newAns = [...answers];
                      newAns[currentIndex] = optIndex;
                      setAnswers(newAns);
                    }}
                    className={`p-6 mb-5 rounded-3xl border flex-row items-center transition-all ${
                      isSelected ? 'bg-zinc-900 border-zinc-900 shadow-lg shadow-black/10' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <View className={`w-6 h-6 rounded-full border-2 mr-4 items-center justify-center ${
                      isSelected ? 'border-pink-500 bg-pink-500' : 'border-slate-300 bg-white'
                    }`}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                    </View>
                    <Text className={`flex-1 text-base font-black italic uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                        {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
        </ScrollView>

        {/* --- NAVIGATION BUTTONS --- */}
        <View className="p-8 bg-white border-t border-slate-100 flex-row justify-between items-center pb-12 shadow-2xl shadow-black/10">
          
          {/* Previous Button */}
          <TouchableOpacity 
            onPress={() => setCurrentIndex(prev => prev - 1)}
            disabled={isFirstQuestion || submitted}
            className={`py-5 px-8 rounded-3xl border ${
                isFirstQuestion ? 'bg-slate-50 border-slate-50 opacity-30' : 'bg-slate-50 border-slate-100'
            }`}
          >
             <Ionicons name="arrow-back" size={24} color={isFirstQuestion ? "#94a3b8" : "#18181b"} />
          </TouchableOpacity>

          {/* Next / Submit Button */}
          {!isLastQuestion ? (
              <TouchableOpacity 
                onPress={() => setCurrentIndex(prev => prev + 1)}
                activeOpacity={0.9}
                className="py-5 px-16 rounded-[30px] bg-zinc-900 shadow-xl shadow-black/20 flex-row items-center"
              >
                <Text className="text-white font-black italic uppercase tracking-[2px] text-sm mr-3">Next Step</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </TouchableOpacity>
          ) : (
              <TouchableOpacity 
                onPress={() => setShowConfirmModal(true)}
                disabled={submitted}
                activeOpacity={0.9}
                className="py-5 px-16 rounded-[30px] bg-pink-500 shadow-xl shadow-pink-500/20 flex-row items-center"
              >
                <Text className="text-white font-black italic uppercase tracking-[2px] text-sm mr-3">Finalize</Text>
                <Ionicons name="rocket" size={22} color="white" />
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
          <View className="flex-1 bg-zinc-900/60 justify-center items-center px-8">
            <View className="bg-white p-10 rounded-[40px] border border-slate-100 w-full items-center shadow-2xl">
                <View className="bg-amber-50 p-6 rounded-full mb-8 border border-amber-100">
                    <Ionicons name="alert-circle" size={48} color="#d97706" />
                </View>
                <Text className="text-3xl font-black italic tracking-tighter text-zinc-900 mb-3 text-center uppercase">Complete Quiz?</Text>
                
                {answers.includes(-1) ? (
                    <Text className="text-red-500 text-center font-bold text-lg mb-10 tracking-tight">
                        Warning: <Text className="font-black italic">{answers.filter(a => a === -1).length}</Text> questions remain unaddressed!
                    </Text>
                ) : (
                    <Text className="text-slate-400 text-center font-bold text-base mb-10 tracking-tight uppercase">
                        Protocol finished. Verify your inputs before final submission.
                    </Text>
                )}

                <View className="flex-row w-full gap-5">
                    <TouchableOpacity 
                        onPress={() => setShowConfirmModal(false)}
                        className="flex-1 py-5 bg-slate-50 rounded-3xl border border-slate-100 items-center shadow-sm"
                    >
                        <Text className="text-slate-500 font-black italic uppercase tracking-widest text-[12px]">Review</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={submitQuiz}
                        className="flex-1 py-5 bg-zinc-900 rounded-3xl shadow-xl shadow-black/20 items-center"
                    >
                        <Text className="text-white font-black italic uppercase tracking-widest text-[12px]">Confirm</Text>
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