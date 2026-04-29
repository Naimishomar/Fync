import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Alert, Animated, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';

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
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1 justify-between px-8 pb-12">

        {/* HEADER */}
        <View className="flex-row items-center justify-between pt-8">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.9}
            className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm shadow-black/5"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color="#18181b" />
          </TouchableOpacity>
          <Text className="text-zinc-900 text-3xl font-black  tracking-tighter uppercase">
            The <Text className="text-pink-500">Lobby</Text>
          </Text>
          <View style={{ width: 48 }} /> {/* Spacer for centering */}
        </View>

        {/* MAIN CONTENT */}
        <View className="items-center">

          {/* Room ID Badge */}
          <View className="bg-white px-8 py-3 rounded-full border border-slate-100 mb-14 flex-row items-center shadow-sm shadow-black/5">
            <View className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
            <Text className="text-slate-400 font-black  tracking-[2px] ml-3 uppercase">Node: <Text className="text-zinc-900">{roomId}</Text></Text>
          </View>

          {/* Pulsing Timer Circle */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View className={`w-72 h-72 rounded-[64px] border border-slate-100 items-center justify-center shadow-2xl overflow-hidden bg-white shadow-black/5`}>
              <View className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full -mr-16 -mt-16" />
              <View className="absolute bottom-0 left-0 w-32 h-32 bg-slate-50 rounded-full -ml-16 -mb-16" />

              {!isStarting && (
                <Text className="text-slate-400 font-black  text-[10px] tracking-[4px] uppercase mb-4">Initializes In</Text>
              )}
              <Text className={`font-black  tracking-tighter uppercase text-center px-4 ${isStarting ? 'text-zinc-900 text-4xl' : 'text-zinc-900 text-6xl'}`}>
                {timeString}
              </Text>
            </View>
          </Animated.View>

          <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-16 text-center px-8 leading-5">
            {isStarting ? "Establish connection... Preparing module." : "Awaiting Host protocol to initiate the sequence."}
          </Text>

        </View>

        {/* FOOTER WARNING */}
        <View className="bg-white p-8 rounded-[40px] flex-row items-center shadow-2xl shadow-black/5 border border-slate-100">
          <View className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
            <Ionicons name="shield-checkmark" size={24} color="#ec4899" />
          </View>
          <Text className="text-slate-400 ml-5 flex-1 text-[10px] font-bold uppercase tracking-wide leading-5">
            <Text className="font-black text-zinc-900 ">Protocol Active.</Text> Maintain active connection. Disconnection will result in session void.
          </Text>
        </View>

      </SafeAreaView>
    </View>
  );
};

export default WaitingRoom;