import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import socket from "../../utils/socket";
import { useAuth } from "../../context/auth.context";

//@ts-ignore
import FYNC_LOGO from '../../assets/logo.png';

export default function GroupJamPlayer({ route, navigation }: any) {
  const { roomId, station } = route.params;
  const { user: authUser } = useAuth();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [squad, setSquad] = useState<any[]>([]); // 🔥 Tracks joined people
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (roomId && authUser?._id) {
      console.log("✅ Joining Room:", roomId);
      
      // 1. Join the room
      socket.emit("join-room", { 
        roomId, 
        user: {
          _id: authUser._id,
          username: authUser.username,
          avatar: authUser.avatar
        } 
      });

      // 2. Listen for squad updates
      socket.on("room-users", (users: any[]) => {
        setSquad(users);
      });

      // 3. Listen for music sync
      socket.on("track-update", async (data) => {
        if (soundRef.current) {
          data.isPlaying ? await soundRef.current.playAsync() : await soundRef.current.pauseAsync();
          setIsPlaying(data.isPlaying);
        }
      });

      setupAudio();
    }

    return () => {
      soundRef.current?.unloadAsync();
      socket.off("room-users");
      socket.off("track-update");
    };
  }, [roomId, authUser]);

  const setupAudio = async () => {
    if (!station?.streamUrl) return;
    try {
      setLoading(true);
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldRouteThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { 
          uri: station.streamUrl,
          headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/116.0.0.0 Mobile' }
        },
        { shouldPlay: true },
        (status) => { if (status.isLoaded) setIsPlaying(status.isPlaying); }
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
        // Fallback logic...
        navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    const nextState = !isPlaying;
    socket.emit("sync-music", { roomId, station, isPlaying: nextState });
    setIsPlaying(nextState);
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <LinearGradient colors={['#ec489933', '#000', '#000']} className="absolute inset-0" />
      
      {/* HEADER */}
      <View className="flex-row justify-between items-center px-6 pt-14">
        <TouchableOpacity onPress={() => navigation.goBack()} className="bg-white/10 p-2 rounded-full">
          <Ionicons name="chevron-down" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white/50 font-bold uppercase text-[10px] tracking-[2px]">Fync Squad Jam</Text>
        <TouchableOpacity className="bg-white/10 p-2 rounded-full">
          <Ionicons name="share-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        {/* ARTWORK WITH MUSIC-LIKE CARD */}
        <View className="w-full aspect-square rounded-[40px] overflow-hidden shadow-2xl shadow-pink-500/20 border border-white/10">
          <Image 
            source={station.artwork ? { uri: station.artwork } : FYNC_LOGO} 
            className="w-full h-full"
            resizeMode="cover"
          />
        </View>

        {/* TRACK INFO */}
        <View className="w-full mt-10 items-start">
          <Text className="text-white text-3xl font-black tracking-tighter italic" numberOfLines={1}>
            {station.name}
          </Text>
          <Text className="text-pink-500 font-medium text-lg mt-1">Live Radio Stream</Text>
        </View>

        {/* FAKE PROGRESS BAR (Visual Vibe) */}
        <View className="w-full h-1 bg-white/10 rounded-full mt-8 overflow-hidden">
          <View className="w-1/3 h-full bg-pink-500" />
        </View>
        <View className="flex-row justify-between w-full mt-2">
          <Text className="text-white/30 text-[10px]">LIVE</Text>
          <Text className="text-white/30 text-[10px]">STREAMING</Text>
        </View>

        {/* CONTROLS */}
        <View className="flex-row items-center justify-between w-full mt-10 px-4">
          <Ionicons name="shuffle-outline" size={28} color="white" />
          <Ionicons name="play-skip-back" size={36} color="white" />
          
          <TouchableOpacity 
            onPress={togglePlay} 
            disabled={loading}
            className="w-20 h-20 bg-white rounded-full items-center justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#ec4899" />
            ) : (
              <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="black" />
            )}
          </TouchableOpacity>

          <Ionicons name="play-skip-forward" size={36} color="white" />
          <Ionicons name="repeat-outline" size={28} color="white" />
        </View>

        {/* SQUAD AVATARS SECTION */}
        <View className="w-full mt-12 bg-white/5 p-4 rounded-3xl border border-white/5">
          <Text className="text-white/40 font-bold uppercase text-[9px] tracking-widest mb-3 text-center">
            Currently Jamming • {squad.length}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {squad.map((member, index) => (
              <View key={index} className="mr-3 items-center">
                <View className="border-2 border-pink-500 rounded-full p-0.5">
                    <Image 
                      source={{ uri: member.avatar || `https://ui-avatars.com/api/?name=${member.username}` }} 
                      className="w-10 h-10 rounded-full bg-zinc-800"
                    />
                </View>
                <Text className="text-white/60 text-[8px] mt-1 font-bold">@{member.username}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}