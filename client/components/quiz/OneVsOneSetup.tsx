import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';

const OneVsOneSetup = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const [domain, setDomain] = useState<string>("DSA");
  const [searching, setSearching] = useState<boolean>(false);

  // List of all domains
  const DOMAINS = [
    'DSA', 'Frontend', 'Backend', 'System Design', 'DevOps', 
    'Flutter', 'Java', 'Python', 'C++', 'Blockchain', 
    'Cyber Security', 'Cryptography', 'Machine Learning', 
    'Data Structures', 'Algorithms', 'Databases', 
    'Networking', 'Operating Systems', 'Web Development', 'Mobile Development'
  ];

  useEffect(() => {
    const onMatchFound = ({ matchRoomId, questions, opponent, endTime }: any) => {
      setSearching(false);
      navigation.replace("QuizScreen", { 
        questions, 
        roomId: matchRoomId, 
        mode: '1v1',
        endTime,
        opponent
      });
    };

    socket.on("match_found", onMatchFound);
    socket.on("match_preparing", () => console.log("Preparing..."));

    return () => {
      socket.off("match_found", onMatchFound);
      socket.off("match_preparing");
    };
  }, [navigation]);

  const findMatch = () => {
    if (!user) return Alert.alert("Error", "You must be logged in");
    
    setSearching(true);
    socket.emit("find_1v1_match", { user, domain });
  };

  const cancelSearch = () => {
      setSearching(false);
  };

  // Helper function to map domains to distinct icons
  const getDomainIcon = (d: string) => {
      const lowerD = d.toLowerCase();
      if (lowerD.includes('dsa') || lowerD.includes('algorithms') || lowerD.includes('data structures')) return 'code-slash';
      if (lowerD.includes('frontend') || lowerD.includes('web')) return 'color-palette';
      if (lowerD.includes('backend')) return 'server';
      if (lowerD.includes('database')) return 'cube';
      if (lowerD.includes('system design') || lowerD.includes('devops')) return 'git-network';
      if (lowerD.includes('mobile') || lowerD.includes('flutter')) return 'phone-portrait';
      if (lowerD.includes('security') || lowerD.includes('crypto')) return 'shield-checkmark';
      if (lowerD.includes('machine learning') || lowerD.includes('ai')) return 'hardware-chip';
      if (lowerD.includes('network')) return 'wifi';
      if (lowerD.includes('operating')) return 'laptop';
      return 'terminal'; // default for languages like Java, Python, C++
  };

  /* ---------- SEARCHING UI ---------- */
  if (searching) {
    return (
      <View className="flex-1 bg-black">
        <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
        <SafeAreaView className="flex-1 justify-center items-center px-6">
            <View className="bg-[#1e1e1e]/90 p-8 rounded-3xl border border-white/10 items-center w-full max-w-sm shadow-2xl">
                <View className="bg-pink-500/20 p-4 rounded-full mb-6 border border-pink-500/30">
                    <ActivityIndicator size="large" color="#ec4899" />
                </View>
                
                <Text className="text-2xl font-black text-white mb-2 text-center">Searching Opponent...</Text>
                <Text className="text-gray-400 text-center mb-8">
                    Looking for a worthy challenger in <Text className="font-bold text-pink-500">{domain}</Text>
                </Text>
                
                <TouchableOpacity onPress={cancelSearch} className="w-full py-4 bg-[#2a2a2a] rounded-xl border border-white/5">
                    <Text className="text-white text-center font-bold text-lg">Cancel</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ---------- SETUP UI ---------- */
  return (
    <View className="flex-1 bg-black">
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1 flex-col">
        {/* Header with Back Button */}
        <View className="flex-row items-center px-6 pt-4 mb-4">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="p-2 bg-white/10 rounded-full mr-4 border border-white/10"
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-3xl font-black italic tracking-tighter">
            1v1<Text className="text-pink-500">BATTLE</Text> ⚔️
          </Text>
        </View>

        <Text className="text-gray-400 font-bold mb-4 text-sm uppercase tracking-widest text-center">
          Select Your Battlefield
        </Text>

        {/* Scrollable Domain Selection Grid */}
        <ScrollView 
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row flex-wrap justify-between gap-y-4 pb-6">
            {DOMAINS.map(d => (
              <TouchableOpacity 
                key={d} 
                onPress={() => setDomain(d)}
                style={{ width: '48%' }}
                className={`p-6 rounded-3xl border items-center justify-center transition-all ${
                  domain === d 
                    ? 'bg-pink-600/20 border-pink-500' 
                    : 'bg-[#1e1e1e]/80 border-white/5'
                }`}
              >
                <Ionicons 
                    name={getDomainIcon(d) as any} 
                    size={32} 
                    color={domain === d ? '#ec4899' : '#6b7280'} 
                    style={{ marginBottom: 12 }}
                />
                <Text className={`font-bold text-center ${domain === d ? 'text-white' : 'text-gray-400'}`}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Static Bottom Action Button */}
        <View className="px-6 py-4 border-t border-white/10 bg-black/40">
          <TouchableOpacity 
              onPress={findMatch} 
              className="w-full py-5 bg-pink-600 rounded-2xl shadow-lg border border-pink-500/50 flex-row justify-center items-center"
          >
            <Text className="text-white text-center font-black text-xl mr-2 tracking-widest">FIND MATCH</Text>
            <Ionicons name="search" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default OneVsOneSetup;