import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Alert, Animated, TouchableOpacity } from 'react-native';
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
    <View className="flex-1 bg-black">
      {/* Background Gradient */}
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1 justify-between px-6 pb-10">
        
        {/* HEADER */}
        <View className="flex-row items-center justify-between pt-4">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="p-2 bg-white/10 rounded-full border border-white/10"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-black italic tracking-tighter">
            THE <Text className="text-pink-500">LOBBY</Text> ⏳
          </Text>
          <View style={{ width: 40 }} /> {/* Spacer for centering */}
        </View>

        {/* MAIN CONTENT */}
        <View className="items-center">
          
          {/* Room ID Badge */}
          <View className="bg-[#2a2a2a] px-6 py-2 rounded-full border border-white/10 mb-10 flex-row items-center shadow-lg">
             <Ionicons name="keypad" size={16} color="#9ca3af" className="mr-2" />
             <Text className="text-gray-400 font-bold tracking-widest ml-2">ROOM: <Text className="text-white">{roomId}</Text></Text>
          </View>

          {/* Pulsing Timer Circle */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View className={`w-64 h-64 rounded-full border-4 items-center justify-center shadow-2xl ${
                isStarting ? 'border-green-400 bg-green-500/20 shadow-green-500/50' : 'border-pink-500 bg-pink-500/10 shadow-pink-500/50'
            }`}>
              {!isStarting && (
                  <Text className="text-pink-300 font-bold text-sm tracking-widest uppercase mb-2">Starts In</Text>
              )}
              <Text className={`font-black tracking-widest ${isStarting ? 'text-green-400 text-3xl' : 'text-white text-6xl'}`}>
                {timeString}
              </Text>
            </View>
          </Animated.View>

          <Text className="text-gray-400 text-lg font-medium mt-12 text-center px-4">
            {isStarting ? "Prepare for battle!" : "Waiting for the host to start the match..."}
          </Text>

        </View>

        {/* FOOTER WARNING */}
        <View className="bg-[#1e1e1e]/80 border border-red-500/30 p-4 rounded-2xl flex-row items-center">
          <Ionicons name="warning-outline" size={24} color="#ef4444" />
          <Text className="text-gray-300 ml-3 flex-1 text-xs leading-5">
            <Text className="font-bold text-red-400">Do not close the app.</Text> Leaving this screen will disconnect you from the lobby.
          </Text>
        </View>

      </SafeAreaView>
    </View>
  );
};

export default WaitingRoom;