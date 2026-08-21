import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StatusBar, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { checkClubStatus, formatCountdown } from '../../utils/nightClub';

const { width } = Dimensions.get('window');

export default function TwelveAMLockScreen() {
  const navigation = useNavigation<any>();
  const [isOpen, setIsOpen] = useState(false);
  const [timerString, setTimerString] = useState("00:00:00");
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      // IST, not the device clock — the server gates on IST, so reading the
      // phone's hour here made the button lie on any non-IST device.
      const { isOpen: open, secondsUntilOpen, secondsUntilClose } = checkClubStatus();
      setIsOpen(open);
      setStatusText(open ? "CLUB IS LIVE" : "OPENS IN");
      setTimerString(formatCountdown(open ? secondsUntilClose : secondsUntilOpen));
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
    <View className="flex-1 bg-ink">
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

      <SafeAreaView className="flex-1 justify-between mx-gutter my-4">
        
        {/* --- HEADER --- */}
        <View className="flex-row justify-between items-center mt-2">
            <TouchableOpacity 
                onPress={() => navigation.goBack()}
                className="w-11 h-11 items-center justify-center rounded-xl"
            
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <View className={`px-4 py-2 rounded-full border flex-row items-center ${ isOpen ? 'bg-success/20 border-success' : 'bg-card/10 border-white/10' }`}>
              <View key={isOpen ? "live" : "offline"} className={`w-2 h-2 rounded-full mr-2 ${isOpen ? 'bg-success animate-pulse' : 'bg-ink-4'}`} />
                <Text className={`text-xs font-semibold ${isOpen ? 'text-violet' : 'text-night-3'}`}>
                    {isOpen ? 'LIVE' : 'OFFLINE'}
                </Text>
            </View>
        </View>

        {/* --- CENTER CONTENT (Timer) --- */}
        <View className="items-center">
            {/* Logo/Icon */}
            <View className={`mb-6 p-6 rounded-full border shadow-hair ${ isOpen ? 'bg-brand-500/20 border-brand-500/30 ' : 'bg-card/10 border-white/10' }`}>
                <MaterialCommunityIcons name="moon-waning-crescent" size={64} color={isOpen ? "#DB2777" : "#8B857E"} />
            </View>

            <Text className="text-brand-300 font-semibold text-sm uppercase mb-2">
                The 12 AM Club
            </Text>
            
            <Text className="text-white font-display text-5xl text-center leading-tight shadow-hair">
                {isOpen ? "NO RULES.\nNO HISTORY." : "SLEEP TIGHT.\nSEE YOU SOON."}
            </Text>

            {/* THE BIG CLOCK */}
            <View className="mt-10 items-center">
                <Text className="text-night-3 text-xs font-semibold mb-2">
                    {statusText}
                </Text>
                <Text className={`text-6xl font-display ${ isOpen ? 'text-white' : 'text-night-3' }`}>
                    {timerString}
                </Text>
            </View>
        </View>

        {/* --- FOOTER (Action Button) --- */}
        <View className="mb-6">
            <Text className="text-night-3 text-center text-xs mb-6 px-gutter leading-5">
                {isOpen 
                    ? "Messages are encrypted and ephemeral. Everything is deleted at 6:00 AM." 
                    : "The club is currently closed. Come back at midnight to join the anonymous chat."
                }
            </Text>

            <TouchableOpacity disabled={!isOpen} onPress={handleEnter} activeOpacity={0.8}>
                {isOpen ? (
                    <Pressable className="flex-row items-center justify-center rounded-full bg-brand-500 py-3" onPress={handleEnter}>
                        <Text className="text-ink font-display text-lg mr-2">ENTER CLUB</Text>
                        <Ionicons name="arrow-forward" size={20} color="#12100E" />
                    </Pressable>
                ) : (
                    <View className="flex-row items-center justify-center bg-brand-500/20 py-3 rounded-full">
                        <Ionicons name="lock-closed" size={20} color="#8B857E" style={{ marginRight: 8 }} />
                        <Text className="text-night-3 font-display text-lg">LOCKED</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}
