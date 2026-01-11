import React from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- TYPES ---
interface CyberCardProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  iconName: keyof typeof Ionicons.glyphMap;
  neonColor: string; // Hex color for the glow
}

// --- CYBER CARD COMPONENT ---
const CyberCard = ({ title, subtitle, onPress, iconName, neonColor }: CyberCardProps) => {
  return (
    <Pressable
      onPress={onPress}
      className="w-full mb-6"
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
        {/* Neon Glow Container - Simulates a backlit border */}
        <View 
            className="rounded-2xl p-[1px]" // 1px padding acts as the border
            style={{ 
                backgroundColor: neonColor,
                shadowColor: neonColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 10,
                elevation: 5 // Android glow
            }}
        >
            {/* Inner Dark Content */}
            <LinearGradient
                colors={['#1e293b', '#0f172a']} // Slate 800 -> Slate 900
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="rounded-2xl p-4 flex-row items-center justify-between"
            >
                {/* Left: Icon with Glow Background */}
                <View 
                    className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                    style={{ backgroundColor: `${neonColor}20` }} // 20% opacity of neon color
                >
                    <Ionicons name={iconName} size={24} color={neonColor} />
                </View>

                {/* Center: Text */}
                <View className="flex-1">
                    <Text className="text-white text-lg font-bold tracking-wider uppercase">
                        {title}
                    </Text>
                    <Text className="text-gray-400 text-xs font-medium tracking-widest mt-1">
                        {subtitle}
                    </Text>
                </View>

                {/* Right: Tech Decoration */}
                <View className="items-end">
                     <MaterialCommunityIcons name="chevron-right" size={28} color={neonColor} />
                     {/* Decorative dots for "tech" feel */}
                     <View className="flex-row gap-1 mt-1">
                        <View className="w-1 h-1 rounded-full bg-gray-600" />
                        <View className="w-1 h-1 rounded-full bg-gray-600" />
                        <View className="w-1 h-1 rounded-full" style={{ backgroundColor: neonColor }} />
                     </View>
                </View>
            </LinearGradient>
        </View>
    </Pressable>
  );
};

const QuizHome = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      
      {/* Background Mesh Gradient */}
      <LinearGradient
        colors={['#020617', '#111827', '#000000']}
        locations={[0, 0.4, 1]}
        className="flex-1"
      >
        <SafeAreaView className="flex-1 px-6 pt-8">
            
            {/* --- HEADER SECTION --- */}
            <View className="mb-10 mt-4">
                <View className="flex-row items-center mb-2">
                    <View className="w-2 h-8 bg-cyan-400 mr-3 rounded-full" />
                    <Text className="text-white text-4xl font-extrabold tracking-tighter">
                        QUIZ <Text className="text-cyan-400">ARENA</Text>
                    </Text>
                </View>
                <Text className="text-gray-400 text-sm font-mono tracking-widest uppercase ml-5 opacity-70">
                    Select your battle mode
                </Text>
            </View>

            {/* --- CARDS GRID --- */}
            <View className="flex-1">
                
                {/* 1. Create Room - Cyan */}
                <CyberCard
                    title="Create Room"
                    subtitle="HOST A MATCH"
                    neonColor="#22d3ee" // Cyan 400
                    iconName="add"
                    onPress={() => navigation.navigate("CreateRoom")}
                />

                {/* 2. Join Room - Purple */}
                <CyberCard
                    title="Join Room"
                    subtitle="ENTER CODE"
                    neonColor="#c084fc" // Purple 400
                    iconName="key-outline"
                    onPress={() => navigation.navigate("JoinRoomInput")}
                />

                {/* 3. Random 1v1 - Pink/Rose */}
                <CyberCard
                    title="1v1 Battle"
                    subtitle="FIND OPPONENT"
                    neonColor="#fb7185" // Rose 400
                    iconName="flash"
                    onPress={() => navigation.navigate("OneVsOneSetup")}
                />

                {/* 4. Interview - Amber */}
                <CyberCard
                    title="AI Interview"
                    subtitle="PRACTICE MODE"
                    neonColor="#fbbf24" // Amber 400
                    iconName="mic"
                    onPress={() => navigation.navigate("InterviewSetup")}
                />

                {/* --- VIDEO LOBBY --- */}
                <CyberCard
                    title="Video Lobby"
                    subtitle="HOST A CALL"
                    neonColor="#22d3ee"
                    iconName="videocam-outline"
                    onPress={() => navigation.navigate("VideoLobby")}
                />
            </View>


            {/* --- BOTTOM DECORATION --- */}
            <View className="items-center mb-6 opacity-30">
                <Text className="text-white font-mono text-[10px]">SYSTEM ONLINE • V.2.0.4</Text>
                <View className="w-24 h-1 bg-gray-700 mt-2 rounded-full" />
            </View>


        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

export default QuizHome;