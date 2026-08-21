import React, { useState, useEffect, useRef } from 'react';
import {View, Text, ScrollView, BackHandler, ActivityIndicator, Image, TouchableOpacity, Modal, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

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
      <View className="flex-1 bg-paper">
        <StatusBar barStyle="dark-content" />
        <SafeAreaView className="flex-1 justify-center items-center px-gutter">
          <View className="bg-card p-card-pad rounded-sheet border border-line items-center w-full shadow-hair">
            <View className="bg-paper-2 p-6 rounded-full mb-8 border border-line">
              <ActivityIndicator size="large" color="#F97316" />
            </View>
            <Text className="text-3xl font-display text-ink text-center uppercase mt-6 mb-2">Submitted!</Text>
            <Text className="text-ink-3 text-center text-lg font-display uppercase">
              Waiting for <Text className="font-display text-accent-text">{opponent?.name || "Target"}</Text> to finalize...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">
        {/* --- HEADER --- */}
        <View className="px-gutter pt-8 pb-6 border-b border-line bg-card shadow-hair">

          {mode === '1v1' && opponent && (
            <View className="flex-row items-center justify-between mb-8 bg-paper-2 p-4 rounded-card border border-line shadow-hair">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 bg-card rounded-card border border-line overflow-hidden items-center justify-center shadow-hair">
                  {opponent.avatar ? (
                    <Image source={{ uri: opponent.avatar }} className="w-full h-full" />
                  ) : (
                    <Text className="font-display text-ink-4 text-xl">{opponent.username?.[0]?.toUpperCase()}</Text>
                  )}
                </View>
                <View>
                  <Text className="text-label text-ink-3 font-display uppercase">Global Opponent</Text>
                  <Text className="font-display text-ink uppercase">{opponent.name || opponent.username}</Text>
                </View>
              </View>
              <View className="bg-brand-500 px-2.5 py-1 rounded-full">
                <Text className="text-ink font-display text-label uppercase">1V1 Match</Text>
              </View>
            </View>
          )}

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Text className="font-display text-xl text-ink uppercase">
                Q. <Text className="text-accent-text text-2xl">{currentIndex + 1}</Text> / {questions.length}
              </Text>
            </View>

            <View className={`px-5 py-2.5 rounded-card border flex-row items-center shadow-hair ${timeLeft < 60 ? 'bg-danger/10 border-danger/15 ' : 'bg-paper-2 border-line ' }`}>
              <Ionicons name="stopwatch" size={20} color={timeLeft < 60 ? '#DC2626' : '#F97316'} />
              <Text className={`font-display text-xl ml-3 uppercase ${timeLeft < 60 ? 'text-danger' : 'text-ink'}`}>
                {formatTime(timeLeft)}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="w-full h-2 bg-paper-2 rounded-full mt-6 overflow-hidden border border-line">
            <View
              className="h-full bg-brand-500 rounded-full"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </View>
        </View>

        {/* --- CURRENT QUESTION --- */}
        <ScrollView className="flex-1 px-gutter pt-10" showsVerticalScrollIndicator={false}>
          <View className="mb-10 bg-card p-card-pad rounded-sheet border border-line shadow-hair">
            <Text className="text-2xl font-display text-ink mb-10 leading-8 uppercase">
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
                  className={`p-6 mb-5 rounded-card border flex-row items-center transition-all ${isSelected ? 'bg-card border-brand-500 shadow-hair ' : 'bg-paper-2 border-line' }`}
                >
                  <View className={`w-6 h-6 rounded-full border-2 mr-4 items-center justify-center ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-line bg-card' }`}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#12100E" />}
                  </View>
                  <Text className={`flex-1 text-base font-display uppercase ${isSelected ? 'text-white' : 'text-ink-3'}`}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* --- NAVIGATION BUTTONS --- */}
        <View className="p-card-pad bg-card border-t border-line flex-row justify-between items-center pb-12 shadow-hair">

          {/* Previous Button */}
          <TouchableOpacity
            onPress={() => setCurrentIndex(prev => prev - 1)}
            disabled={isFirstQuestion || submitted}
            className={`py-5 px-gutter rounded-card border ${isFirstQuestion ? 'bg-paper-2 border-line opacity-30' : 'bg-paper-2 border-line' }`}
          >
            <Ionicons name="arrow-back" size={24} color={isFirstQuestion ? "#8B857E" : "#12100E"} />
          </TouchableOpacity>

          {/* Next / Submit Button */}
          {!isLastQuestion ? (
            <TouchableOpacity
              onPress={() => setCurrentIndex(prev => prev + 1)}
              activeOpacity={0.9}
              className="py-5 px-gutter rounded-card bg-brand-500 shadow-hair flex-row items-center"
            >
              <Text className="text-ink font-display uppercase text-sm mr-3">Next Step</Text>
              <Ionicons name="arrow-forward" size={18} color="#12100E" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowConfirmModal(true)}
              disabled={submitted}
              activeOpacity={0.9}
              className="py-5 px-gutter rounded-card bg-brand-500 shadow-hair flex-row items-center"
            >
              <Text className="text-ink font-display uppercase text-sm mr-3">Finalize</Text>
              <Ionicons name="rocket" size={22} color="#12100E" />
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
          <View className="flex-1 bg-ink/60 justify-center items-center px-gutter">
            <View className="bg-card p-card-pad rounded-sheet border border-line w-full items-center shadow-hair">
              <View className="bg-warning/10 p-6 rounded-full mb-8 border border-warning/15">
                <Ionicons name="alert-circle" size={48} color="#B45309" />
              </View>
              <Text className="text-3xl font-display text-ink text-center uppercase mt-6 mb-3">Complete Quiz?</Text>

              {answers.includes(-1) ? (
                <Text className="text-danger text-center font-display text-lg mb-10">
                  Warning: <Text className="font-display">{answers.filter(a => a === -1).length}</Text> questions remain unaddressed!
                </Text>
              ) : (
                <Text className="text-ink-3 text-center font-semibold text-base mb-10 uppercase">
                  Protocol finished. Verify your inputs before final submission.
                </Text>
              )}

              <View className="flex-row w-full gap-5">
                <TouchableOpacity
                  onPress={() => setShowConfirmModal(false)}
                  className="flex-1 py-5 bg-paper-2 border border-line items-center shadow-hair rounded-md"
                >
                  <Text className="font-semibold text-base text-ink">Review</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={submitQuiz}
                  className="flex-1 py-5 bg-brand-500 items-center border-2 border-ink rounded-md"
                >
                  <Text className="text-ink font-display uppercase text-sm">Confirm</Text>
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
