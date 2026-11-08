import React, { useEffect, useState, useRef } from 'react';
import {View, Text, Animated, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Card, IconTile, Label } from '../ui/kit';

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
    const loop = Animated.loop(
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
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (!user) return;

    socket.emit("join_custom_room", { roomId, userId: user._id });

    // 1. START QUIZ
    const onStart = (data: any) => {
      navigation.replace("QuizScreen", {
        questions: data.questions,
        roomId,
        mode: 'custom',
        endTime: data.endTime
      });
    };

    // 2. QUIZ ALREADY ENDED (Late Joiner)
    const onEnded = () => {
      Alert.alert("Quiz Expired", "This quiz has ended.", [
        { text: "View Leaderboard", onPress: () => navigation.replace("LeaderboardScreen", { roomId }) }
      ]);
    };

    // 3. ALREADY ATTEMPTED
    const onAttempted = () => {
      navigation.replace("LeaderboardScreen", { roomId });
    };

    const onError = (msg: any) => setStatus(msg);

    socket.on("start_quiz", onStart);
    socket.on("quiz_ended", onEnded);
    socket.on("already_attempted", onAttempted);
    socket.on("error", onError);

    // Remove only our own handlers: the socket is shared app-wide, and a bare
    // off("error") strips every other screen's error listener too.
    return () => {
      socket.off("start_quiz", onStart);
      socket.off("quiz_ended", onEnded);
      socket.off("already_attempted", onAttempted);
      socket.off("error", onError);
    };
  }, [navigation, roomId, user]);

  // Visual Countdown to Start Time
  useEffect(() => {
    const target = new Date(startTime).getTime();
    if (Number.isNaN(target)) return;
    const tick = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeString("Starting…");
        setIsStarting(true);
        clearInterval(interval);
      } else {
        const m = Math.floor(diff / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        // Format as MM:SS
        setTimeString(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    };
    const interval = setInterval(tick, 1000);
    tick();
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <AppBar title="The Lobby" onBack={() => navigation.goBack()} />

      <SafeAreaView className="flex-1 justify-between px-gutter pt-6 pb-6" edges={['bottom']}>

        {/* MAIN CONTENT */}
        <View className="items-center">

          {/* Room code */}
          <View className="bg-card px-4 py-2 rounded-full border border-line mb-12 flex-row items-center">
            <View className="w-2 h-2 bg-brand-500 rounded-full" />
            <Text className="text-ink-3 font-semibold ml-3">Room <Text className="text-ink">{roomId}</Text></Text>
          </View>

          {/* Pulsing timer */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View className="w-72 h-72 rounded-full border border-line items-center justify-center bg-card">
              {!isStarting && (
                <Label style={{ marginBottom: 8 }}>Starts in</Label>
              )}
              <Text
                className={`font-display text-center px-4 text-ink ${isStarting ? 'text-3xl' : 'text-5xl'}`}
                accessibilityLiveRegion="polite"
              >
                {timeString}
              </Text>
            </View>
          </Animated.View>

          <Text className="font-sans text-sm text-ink-3 mt-12 text-center px-gutter">
            {isStarting ? "Starting — preparing questions." : "Waiting for the host to start the quiz."}
          </Text>

        </View>

        {/* Footer note */}
        <Card padded style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="wifi-outline" size={44} />
          <Text className="text-ink-2 flex-1 text-sm">
            <Text className="font-semibold text-ink">Stay connected. </Text>
            Leaving or losing connection ends your attempt.
          </Text>
        </Card>

      </SafeAreaView>
    </View>
  );
};

export default WaitingRoom;
