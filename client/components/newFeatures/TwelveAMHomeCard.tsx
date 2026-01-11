import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StatusBar, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function TwelveAMLockScreen() {
  const navigation = useNavigation<any>();
  const [isOpen, setIsOpen] = useState(false);
  const [timerString, setTimerString] = useState("00:00:00");
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const hour = now.getHours();
      
      // Club Logic: Open 00:00 - 06:00
      const open = hour >= 0 && hour < 6;
      setIsOpen(open);

      if (open) {
        // Count down to CLOSE (06:00)
        const closingTime = new Date(now);
        closingTime.setHours(6, 0, 0, 0);
        
        let diff = Math.floor((closingTime.getTime() - now.getTime()) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;

        setStatusText("CLUB IS LIVE");
        setTimerString(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      } else {
        // Count down to OPEN (24:00 / Midnight)
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);

        let diff = Math.floor((midnight.getTime() - now.getTime()) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;

        setStatusText("OPENS IN");
        setTimerString(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEnter = () => {
      if (isOpen) {
          console.log("Entering Club...");
          navigation.navigate("TwelveAMClub");
      }
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      
      {/* 1. Background Image (Full Screen) */}
      <Image 
        source={{ uri: "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop" }} 
        className="absolute w-full h-full opacity-80"
        resizeMode="cover"
      />

      {/* 2. Gradient Overlay (Added Pink on Top) */}
      <LinearGradient 
        colors={isOpen 
            // OPEN: Neon Pink -> Indigo -> Black
            ? ['rgba(236, 72, 153, 0.5)', 'rgba(79, 70, 229, 0.5)', 'rgba(0,0,0,0.95)', 'black'] 
            // LOCKED: Subtle Pink -> Dark Grey -> Black
            : ['rgba(236, 72, 153, 0.5)', 'rgba(0,0,0,0.8)', 'black']
        }
        className="absolute w-full h-full"
      />

      <SafeAreaView className="flex-1 justify-between mx-6 my-4">
        
        {/* --- HEADER --- */}
        <View className="flex-row justify-between items-center mt-2">
            <TouchableOpacity 
                onPress={() => navigation.goBack()}
                className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10"
            >
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <View className={`px-4 py-2 rounded-full border flex-row items-center ${
                isOpen ? 'bg-green-500/20 border-green-500' : 'bg-white/10 border-white/10'
            }`}>
              <View key={isOpen ? "live" : "offline"} className={`w-2 h-2 rounded-full mr-2 ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                <Text className={`text-xs font-bold tracking-widest ${isOpen ? 'text-green-400' : 'text-gray-300'}`}>
                    {isOpen ? 'LIVE' : 'OFFLINE'}
                </Text>
            </View>
        </View>

        {/* --- CENTER CONTENT (Timer) --- */}
        <View className="items-center">
            {/* Logo/Icon */}
            <View className={`mb-6 p-6 rounded-full border shadow-lg ${
                isOpen ? 'bg-pink-500/20 border-pink-500/30 shadow-pink-500/50' : 'bg-white/10 border-white/10'
            }`}>
                <MaterialCommunityIcons name="moon-waning-crescent" size={64} color={isOpen ? "#f472b6" : "#6b7280"} />
            </View>

            <Text className="text-pink-300 font-bold tracking-[6px] text-sm uppercase mb-2">
                The 12 AM Club
            </Text>
            
            <Text className="text-white font-black text-5xl text-center leading-tight shadow-black shadow-lg">
                {isOpen ? "NO RULES.\nNO HISTORY." : "SLEEP TIGHT.\nSEE YOU SOON."}
            </Text>

            {/* THE BIG CLOCK */}
            <View className="mt-10 items-center">
                <Text className="text-gray-400 text-xs font-bold tracking-widest mb-2">
                    {statusText}
                </Text>
                <Text className={`text-6xl font-mono font-bold tracking-tighter ${
                    isOpen ? 'text-white text-shadow-glow' : 'text-gray-500'
                }`}>
                    {timerString}
                </Text>
            </View>
        </View>

        {/* --- FOOTER (Action Button) --- */}
        <View className="mb-6">
            <Text className="text-gray-400 text-center text-xs mb-6 px-8 leading-5">
                {isOpen 
                    ? "Messages are encrypted and ephemeral. Everything is deleted at 6:00 AM." 
                    : "The club is currently closed. Come back at midnight to join the anonymous chat."
                }
            </Text>

            <TouchableOpacity
                disabled={!isOpen}
                onPress={handleEnter}
                activeOpacity={0.8}
            >
                <LinearGradient
                    // Button Gradient: Pink -> Indigo (Matches the screen vibe)
                    colors={isOpen ? ['#ec4899', '#6366f1'] : ['#1f2937', '#111827']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className={`w-full py-4 rounded-2xl items-center flex-row justify-center border ${
                        isOpen ? 'border-pink-400' : 'border-gray-700'
                    }`}
                >
                    {isOpen ? (
                        <Pressable className="flex-row items-center rounded-2xl" onPress={handleEnter}>
                            <Text className="text-white font-bold text-lg mr-2">ENTER CLUB</Text>
                            <Ionicons name="arrow-forward" size={20} color="white" />
                        </Pressable>
                    ) : (
                        <>
                            <Ionicons name="lock-closed" size={20} color="#6b7280" style={{ marginRight: 8 }} />
                            <Text className="text-gray-500 font-bold text-lg">LOCKED</Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}