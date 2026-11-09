import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, BackHandler, ActivityIndicator, Image, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { BottomBar, Button, Card, H1, H2, IconBtn, Label, Num, Sheet } from '../ui/kit';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizScreen'>;

const QuizScreen: React.FC<Props> = ({ route, navigation }) => {
  const { roomId, mode, endTime, opponent } = route.params as any;
  const questions: any[] = (route.params as any)?.questions ?? [];
  const { user } = useAuth();

  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  // The timer's auto-submit runs from an interval created before any answer
  // was picked; reading state there would submit the initial all -1 array.
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [submitted, setSubmitted] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Pagination State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // --- TIMER LOGIC ---
  // Without a server end time, count down five minutes from opening — a
  // constant 300 here meant the clock never moved and never auto-submitted.
  const fallbackEnd = useRef(Date.now() + 300_000).current;
  const calculateRemaining = () => {
    const parsed = endTime ? new Date(endTime).getTime() : NaN;
    const end = Number.isNaN(parsed) ? fallbackEnd : parsed;
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

    const finalAnswers = answersRef.current;
    if (mode === 'custom') {
      socket.emit("submit_custom_quiz", { roomId, answers: finalAnswers, userId: user?._id });
    } else {
      socket.emit("submit_1v1", { matchRoomId: roomId, answers: finalAnswers, userId: user?._id });
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

  const currentQuestion = questions[currentIndex] ?? { question: '', options: [] };
  const isLastQuestion = currentIndex === questions.length - 1;
  const isFirstQuestion = currentIndex === 0;

  // --- WAITING FOR OPPONENT ---
  if (waitingForOpponent) {
    return (
      <View className="flex-1 bg-paper">
        <StatusBar barStyle={C.barStyle} />
        <SafeAreaView className="flex-1 justify-center items-center px-gutter">
          <Card padded style={{ alignItems: 'center', alignSelf: 'stretch' }}>
            <View className="bg-paper-2 w-20 h-20 rounded-full mb-4 items-center justify-center">
              <ActivityIndicator size="large" color={C.brand[500]} />
            </View>
            <H1 style={{ textAlign: 'center', marginBottom: 8 }}>Submitted</H1>
            <Text className="text-ink-2 text-center text-base">
              Waiting for <Text className="font-semibold text-ink">{opponent?.name || "your opponent"}</Text> to finish…
            </Text>
          </Card>
        </SafeAreaView>
      </View>
    );
  }

  const unanswered = answers.filter(a => a === -1).length;
  const low = timeLeft < 60;

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-gutter pt-4 pb-4 border-b border-line bg-card">

          {mode === '1v1' && opponent && (
            <View className="flex-row items-center justify-between mb-4 bg-paper-2 p-3 rounded-2xl">
              <View className="flex-row items-center gap-3 flex-1 mr-3">
                <View className="w-11 h-11 bg-card rounded-full overflow-hidden items-center justify-center">
                  {opponent.avatar ? (
                    <Image source={{ uri: opponent.avatar }} className="w-full h-full" />
                  ) : (
                    <Text className="font-display text-ink-3 text-lg">{opponent.username?.[0]?.toUpperCase()}</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Label>{opponent.ghost ? 'Recorded attempt' : 'Opponent'}</Label>
                  <Text className="font-semibold text-ink" numberOfLines={1}>{opponent.name || opponent.username}</Text>
                </View>
              </View>
              <View className="bg-brand-500 px-2.5 py-1 rounded-full">
                <Text className="text-on-brand font-semibold text-xs">{opponent.ghost ? 'Replay' : '1v1 match'}</Text>
              </View>
            </View>
          )}

          <View className="flex-row justify-between items-center">
            <Text className="font-semibold text-base text-ink-2">
              Question <Num style={{ fontSize: 19 }}>{currentIndex + 1}</Num> of {questions.length}
            </Text>

            <View
              className={`px-3 py-2 rounded-full flex-row items-center ${low ? 'bg-danger/10' : 'bg-paper-2'}`}
              accessibilityLabel={`${formatTime(timeLeft)} left${low ? ', under a minute' : ''}`}
            >
              <Ionicons name={low ? 'alarm-outline' : 'stopwatch-outline'} size={18} color={low ? C.danger : C.ink2} />
              <Num style={{ fontSize: 19, lineHeight: 24, marginLeft: 8, color: low ? C.danger : C.ink }}>
                {formatTime(timeLeft)}
              </Num>
            </View>
          </View>

          {/* Progress */}
          <View className="w-full h-1.5 bg-paper-2 rounded-full mt-4 overflow-hidden">
            <View
              className="h-full bg-brand-500 rounded-full"
              style={{ width: `${((currentIndex + 1) / Math.max(questions.length, 1)) * 100}%` }}
            />
          </View>
        </View>

        {/* Current question */}
        <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-gutter" contentContainerStyle={{ paddingTop: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <H2 style={{ marginBottom: 20 }}>{currentQuestion.question}</H2>

          {(currentQuestion.options ?? []).map((opt: string, optIndex: number) => {
            const isSelected = answers[currentIndex] === optIndex;
            return (
              <Pressable
                key={optIndex}
                disabled={submitted}
                onPress={() => {
                  const newAns = [...answers];
                  newAns[currentIndex] = optIndex;
                  setAnswers(newAns);
                }}
                className={`p-4 mb-3 rounded-2xl flex-row items-center bg-card active:opacity-85 ${isSelected ? 'border-2 border-brand-500' : 'border border-line'}`}
                style={{ minHeight: 56 }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, disabled: submitted }}
              >
                <View className={`w-6 h-6 rounded-full border mr-3 items-center justify-center ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-line bg-card'}`}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={C.onBrand} />}
                </View>
                <Text className={`flex-1 text-base ${isSelected ? 'font-semibold text-ink' : 'font-sans text-ink-2'}`}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Navigation */}
        <BottomBar>
          <IconBtn
            name="arrow-back"
            boxed
            onPress={() => setCurrentIndex(prev => prev - 1)}
            disabled={isFirstQuestion || submitted}
            accessibilityLabel="Previous question"
            style={isFirstQuestion ? { opacity: 0.4 } : undefined}
          />
          <View style={{ flex: 1 }} />
          {!isLastQuestion ? (
            <Button title="Next" icon="arrow-forward" variant="primary" onPress={() => setCurrentIndex(prev => prev + 1)} />
          ) : (
            <Button title="Submit" icon="checkmark" variant="primary" disabled={submitted} onPress={() => setShowConfirmModal(true)} />
          )}
        </BottomBar>

        {/* Confirm submit */}
        <Sheet
          visible={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Submit quiz?"
          footer={
            <View className="flex-row" style={{ gap: 12 }}>
              <Button title="Review" onPress={() => setShowConfirmModal(false)} style={{ flex: 1 }} />
              <Button title="Submit" variant="primary" onPress={submitQuiz} style={{ flex: 1 }} />
            </View>
          }
        >
          {unanswered > 0 ? (
            <View className="flex-row items-center bg-danger/10 p-4 rounded-2xl" style={{ gap: 12 }}>
              <Ionicons name="alert-circle-outline" size={22} color={C.danger} />
              <Text className="text-danger font-semibold text-sm flex-1">
                {unanswered} {unanswered === 1 ? 'question is' : 'questions are'} still unanswered.
              </Text>
            </View>
          ) : (
            <Text className="text-ink-2 text-base">
              All questions answered. Check your answers before submitting — you can't change them after.
            </Text>
          )}
        </Sheet>

      </SafeAreaView>
    </View>
  );
};

export default QuizScreen;
