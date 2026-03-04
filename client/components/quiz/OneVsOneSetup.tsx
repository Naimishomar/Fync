import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
// 🔥 FIX: Import the global ref from your root App file
import { navigationRef } from '../../App'; 
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';

const OneVsOneSetup = () => {
  const { user } = useAuth();
  const [domain, setDomain] = useState<string>("DSA");
  const [searching, setSearching] = useState<boolean>(false);

  const DOMAINS = [
    'DSA', 'Frontend', 'Backend', 'System Design', 'DevOps', 
    'Flutter', 'Java', 'Python', 'C++', 'Blockchain', 
    'Cyber Security', 'Machine Learning', 'Data Structures', 
    'Algorithms', 'Databases', 'Networking', 'Operating Systems'
  ];

  useEffect(() => {
    // 1. Listen for match found
    const onMatchFound = (data: any) => {
      const { matchRoomId, questions, opponent, endTime } = data;
      setSearching(false);
      
      // 🔥 FIX: Use the global ref to navigate
      if (navigationRef.isReady()) {
        navigationRef.navigate("QuizScreen", { 
          questions, 
          roomId: matchRoomId, 
          mode: '1v1',
          endTime,
          opponent
        });
      }
    };

    socket.on("match_found", onMatchFound);
    return () => {
      socket.off("match_found", onMatchFound);
    };
  }, []);

  const findMatch = () => {
    if (!user?._id) return Alert.alert("Error", "Please login first");
    setSearching(true);
    socket.emit("find_1v1_match", { 
      user: { _id: user._id, username: user.username, avatar: user.avatar, name: user.name }, 
      domain 
    });
  };

  const handleBack = () => {
    // 🔥 FIX: Use the global ref to go back
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  };

  const getDomainIcon = (d: string) => {
    const lowerD = d.toLowerCase();
    if (lowerD.includes('dsa') || lowerD.includes('algo')) return 'code-slash';
    if (lowerD.includes('frontend')) return 'color-palette';
    if (lowerD.includes('backend')) return 'server';
    if (lowerD.includes('system')) return 'git-network';
    if (lowerD.includes('mobile')) return 'phone-portrait';
    return 'terminal';
  };

  if (searching) {
    return (
      <View className="flex-1 bg-black">
        <LinearGradient colors={['rgba(236, 72, 153, 0.4)', '#000000']} className="absolute inset-0" />
        <SafeAreaView className="flex-1 justify-center items-center px-6">
          <View className="bg-zinc-900 p-8 rounded-[40px] border border-white/10 items-center w-full">
            <ActivityIndicator size="large" color="#ec4899" className="mb-6" />
            <Text className="text-xl font-black text-white uppercase italic">Searching for Rival...</Text>
            <TouchableOpacity onPress={() => setSearching(false)} className="mt-8 px-8 py-3 bg-zinc-800 rounded-full">
              <Text className="text-white font-bold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <LinearGradient colors={['rgba(236, 72, 153, 0.3)', '#000']} className="absolute inset-0" />
      <SafeAreaView className="flex-1">
        <View className="flex-row items-center px-6 pt-4 mb-8">
          <TouchableOpacity onPress={handleBack} className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-3xl font-black italic ml-4">1v1 <Text className="text-pink-500">ARENA</Text></Text>
        </View>

        <ScrollView className="flex-1 px-6">
          <View className="flex-row flex-wrap justify-between">
            {DOMAINS.map(d => (
              <TouchableOpacity key={d} onPress={() => setDomain(d)} style={{ width: '48%', marginBottom: 16 }}
                className={`p-6 rounded-[30px] border items-center ${domain === d ? 'bg-pink-600/20 border-pink-500' : 'bg-zinc-900/50 border-white/5'}`}>
                <Ionicons name={getDomainIcon(d) as any} size={28} color={domain === d ? '#ec4899' : '#3f3f46'} />
                <Text className={`font-bold mt-3 ${domain === d ? 'text-white' : 'text-zinc-500'}`}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View className="p-6">
          <TouchableOpacity onPress={findMatch} className="w-full py-5 bg-white rounded-3xl flex-row justify-center items-center">
            <Text className="text-black font-black text-lg mr-2 uppercase">Find Rival</Text>
            <Ionicons name="flash" size={20} color="black" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default OneVsOneSetup;