import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity, ScrollView, StatusBar, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { navigationRef } from '../../App'; 
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import axios from '../../context/axiosConfig';
import Avatar from '../Avatar';

const OneVsOneSetup = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [domain, setDomain] = useState<string>("DSA");
  const [searching, setSearching] = useState<boolean>(false);
  const [stats, setStats] = useState<{ points: number, rank: number }>({ points: 0, rank: 0 });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
       try {
           const res = await axios.get('/quiz/arena-stats');
           setStats(res.data);
       } catch (err) {
           console.error("Fetch Stats error:", err);
       }
    };

    const fetchLeaderboard = async () => {
       try {
           const res = await axios.get('/quiz/top-gladiators');
           setLeaderboard(res.data);
       } catch (err) {
           console.error("Fetch Leaderboard error:", err);
       }
    };

    fetchStats();
    fetchLeaderboard();
  }, []);

  const DOMAINS: { name: string, icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { name: 'DSA', icon: 'code-braces' },
    { name: 'Frontend', icon: 'monitor-edit' },
    { name: 'Backend', icon: 'server-network' },
    { name: 'System Design', icon: 'hexagon-multiple-outline' },
    { name: 'DevOps', icon: 'infinity' },
    { name: 'Flutter', icon: 'cellphone' },
    { name: 'Java', icon: 'coffee' },
    { name: 'Python', icon: 'language-python' },
    { name: 'C++', icon: 'language-cpp' },
    { name: 'Blockchain', icon: 'link-variant' },
    { name: 'Cyber Security', icon: 'shield-lock' },
    { name: 'Machine Learning', icon: 'brain' },
    { name: 'Databases', icon: 'database' },
    { name: 'Networking', icon: 'lan' },
    { name: 'OS', icon: 'microsoft-windows-classic' }
  ];

  useEffect(() => {
    const onMatchFound = (data: any) => {
      const { matchRoomId, questions, opponent, endTime } = data;
      setSearching(false);
      
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
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  };

  if (searching) {
    return (
      <View className="flex-1 bg-[#F8FAFC]">
        <StatusBar barStyle="dark-content" />
        <SafeAreaView className="flex-1 justify-center items-center px-8">
            <View className="w-full bg-white p-10 rounded-[50px] border border-slate-100 items-center shadow-2xl shadow-black/5 overflow-hidden">
                <LinearGradient
                    colors={['rgba(236, 72, 153, 0.05)', 'transparent']}
                    className="absolute top-0 w-full h-full"
                />
                
                {/* Radar Animation Simulation */}
                <View className="relative w-40 h-40 items-center justify-center mb-10">
                    <View className="absolute w-full h-full border-2 border-pink-500/10 rounded-full" />
                    <View className="absolute w-3/4 h-3/4 border-2 border-pink-500/20 rounded-full" />
                    <View className="absolute w-1/2 h-1/2 border-2 border-pink-500/40 rounded-full" />
                    <ActivityIndicator size="large" color="#ec4899" />
                </View>

                <Text className="text-3xl font-black text-zinc-900 uppercase italic tracking-tighter text-center">
                    Locating <Text className="text-pink-500">Rival</Text>
                </Text>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mt-4 text-center px-4">
                    Scanning active nodes for {domain} Experts...
                </Text>

                <View className="flex-row items-center mt-12 gap-4">
                    <Avatar user={user as any} size={50} />
                    <View className="bg-slate-100 h-[2px] w-12" />
                    <View className="w-12 h-12 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 items-center justify-center">
                        <Ionicons name="help" size={24} color="#CBD5E1" />
                    </View>
                </View>
                
                <TouchableOpacity 
                    onPress={() => setSearching(false)} 
                    activeOpacity={0.9}
                    className="mt-14 w-full py-5 bg-zinc-900 rounded-3xl"
                >
                    <Text className="text-white text-center font-black italic uppercase text-xs tracking-[4px]">Abort Protocol</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      
      {/* Dynamic Background Element */}
      <View className="absolute top-0 right-0 w-64 h-64 bg-pink-500/5 rounded-full -mr-32 -mt-32" />
      <View className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full -ml-40 -mb-40" />

      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center gap-3 px-8 pt-6 mb-8">
            <TouchableOpacity 
                onPress={handleBack} 
                className="w-12 h-12 bg-white rounded-full items-center justify-center border border-slate-100 shadow-sm"
            >
                <Ionicons name="arrow-back" size={24} color="#18181b" />
            </TouchableOpacity>
            
            <View className="items-center">
                <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter uppercase">
                    1V1 <Text className="text-pink-500">Arena</Text>
                </Text>
                <Text className="text-slate-400 text-[9px] font-black uppercase tracking-[3px] mt-0.5">Initialize Combat</Text>
            </View>
        </View>

        {/* User Status Card */}
        <View className="px-8 mb-8">
            <View className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm shadow-black/5 flex-row items-center">
                <TouchableOpacity onPress={() => navigation.navigate("Profile", { userId: user?._id })}>
                    <Avatar user={user as any} size={60} />
                </TouchableOpacity>
                <View className="ml-4 flex-1">
                    <Text className="text-zinc-900 font-black italic text-lg uppercase tracking-tight line-clamp-1">
                        {user?.name || "Player One"}
                    </Text>
                    <View className="flex-row items-center mt-1">
                        <View className="bg-pink-100 px-2 py-0.5 rounded-md mr-2">
                             <Text className="text-pink-600 font-bold text-[9px] uppercase tracking-tighter">{stats.points} Points</Text>
                        </View>
                        <Text className="text-slate-400 font-black text-[9px] uppercase tracking-widest">RANK #{stats.rank}</Text>
                    </View>
                </View>
                <View className="bg-slate-50 w-12 h-12 rounded-2xl items-center justify-center border border-slate-100">
                    <Ionicons name="trophy" size={20} color="#d97706" />
                </View>
            </View>
        </View>

        <ScrollView className="flex-1 px-8" showsVerticalScrollIndicator={false}>
            <Text className="text-zinc-900 font-black italic uppercase text-xs tracking-[2px] mb-6 ml-1">Select Domain</Text>
            
            <View className="flex-row flex-wrap justify-between pb-10">
                {DOMAINS.map((item) => (
                    <TouchableOpacity 
                        key={item.name} 
                        onPress={() => setDomain(item.name)} 
                        activeOpacity={0.9}
                        style={{ width: '47%', marginBottom: 20 }}
                        className={`p-6 rounded-[35px] border items-center ${domain === item.name ? 'bg-zinc-900 border-zinc-900 shadow-xl shadow-black/20 translate-y-[-2px]' : 'bg-white border-slate-100 shadow-sm shadow-black/5'}`}
                    >
                        <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-4 ${domain === item.name ? 'bg-pink-500 shadow-lg shadow-pink-500/20' : 'bg-slate-50 border border-slate-100'}`}>
                            <MaterialCommunityIcons 
                                name={item.icon as any} 
                                size={28} 
                                color={domain === item.name ? 'white' : '#CBD5E1'} 
                            />
                        </View>
                        <Text className={`font-black italic uppercase text-[10px] text-center tracking-tight ${domain === item.name ? 'text-white' : 'text-slate-500'}`}>
                            {item.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Global Standings (Leaderboard) */}
            <View className="mb-20">
                <Text className="text-zinc-900 font-black italic uppercase text-xs tracking-[2px] mb-6 ml-1">Global Standings</Text>
                {leaderboard.map((player, index) => (
                    <TouchableOpacity 
                        key={player._id}
                        onPress={() => navigation.navigate("PublicProfile", { userId: player._id })}
                        className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm shadow-black/5 flex-row items-center mb-4"
                    >
                        <View className="w-8 items-center">
                            <Text className={`font-black italic text-xs ${index === 0 ? 'text-amber-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                                #{index + 1}
                            </Text>
                        </View>
                        <View className="w-10 h-10 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mx-3">
                            {player.avatar ? (
                                <Image source={{ uri: player.avatar }} className="w-full h-full" />
                            ) : (
                                <View className="w-full h-full items-center justify-center">
                                    <Text className="text-slate-300 font-black italic">{player.username?.[0]?.toUpperCase()}</Text>
                                </View>
                            )}
                        </View>
                        <View className="flex-1">
                            <Text className="text-zinc-900 font-black italic text-sm uppercase tracking-tight">{player.name || player.username}</Text>
                            <Text className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">@{player.username}</Text>
                        </View>
                        <View className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex-row items-center">
                            <Text className="text-zinc-900 font-black italic text-[10px] mr-1">{player.oneVsOnePoints}</Text>
                            <Ionicons name="flash" size={10} color="#ec4899" />
                        </View>
                    </TouchableOpacity>
                ))}
                {leaderboard.length === 0 && (
                   <View className="bg-slate-50 p-8 rounded-3xl border border-dashed border-slate-200 items-center">
                       <Ionicons name="trophy-outline" size={32} color="#CBD5E1" />
                       <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2">Arena is currently vacant</Text>
                   </View>
                )}
            </View>
        </ScrollView>

        <View className="px-8 pb-12 pt-4">
            <TouchableOpacity 
                onPress={findMatch} 
                activeOpacity={0.9}
                className="w-full"
            >
                <LinearGradient
                    colors={['#ec4899', '#db2777']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}
                    className="py-6 rounded-[32px] flex-row justify-center items-center shadow-2xl shadow-pink-500/30"
                >
                    <Text className="text-white font-black italic text-lg mr-3 uppercase tracking-[4px]">Locate Rival</Text>
                    <Ionicons name="flash" size={22} color="white" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default OneVsOneSetup;