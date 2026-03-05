import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  View, Text, TouchableOpacity, Image, ActivityIndicator, 
  ScrollView, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import socket from "../../utils/socket";
import { useAuth } from "../../context/auth.context";
import axios from "../../context/axiosConfig";

//@ts-ignore
import FYNC_LOGO from '../../assets/logo.png';

export default function GroupJamPlayer({ route, navigation }: any) {
  const { roomId, station } = route.params;
  const { user: authUser } = useAuth();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false); 
  const [volume, setVolume] = useState(1.0); 
  const [squad, setSquad] = useState<any[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<Record<string, boolean>>({});
  
  const soundRef = useRef<Audio.Sound | null>(null);

  // --- 🛑 STOP AND LEAVE LOGIC ---
  const stopAndLeave = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) {
        console.log("Error unloading sound:", e);
      }
    }
    if (authUser?._id) {
      socket.emit("leave-room", { 
        roomId, 
        user: { _id: authUser._id, username: authUser.username, avatar: authUser.avatar } 
      });
    }
  }, [roomId, authUser]);

  // --- 🎧 AUDIO SETUP ---
  const setupAudio = useCallback(async () => {
    if (!station?.streamUrl) return;
    try {
      setLoading(true);
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { 
            uri: station.streamUrl, 
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/116.0.0.0 Mobile' } 
        },
        { shouldPlay: true, volume: 1.0 },
        (status: any) => { 
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            setIsBuffering(status.isBuffering); 
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
      console.error("Audio Load Error:", e);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [station?.streamUrl, navigation]);

  // --- 🔄 SYNC & SOCKET EFFECTS ---
  useEffect(() => {
    if (roomId && authUser?._id) {
      const userPayload = {
        _id: authUser._id,
        username: authUser.username,
        avatar: authUser.avatar
      };

      socket.emit("join-room", { roomId, user: userPayload });

      socket.on("room-users", (users: any[]) => {
        setSquad(users);
      });

      // 🔥 HARDWARE SYNC: Listen for play/pause from other devices
      socket.on("track-update", async (data) => {
        if (soundRef.current) {
          try {
            if (data.isPlaying) {
              await soundRef.current.playAsync();
            } else {
              await soundRef.current.pauseAsync();
            }
            setIsPlaying(data.isPlaying);
          } catch (error) {
            console.log("Cross-device hardware sync error:", error);
          }
        }
      });

      setupAudio();
    }

    const unsubscribe = navigation.addListener('beforeRemove', () => {
      stopAndLeave();
    });

    return () => {
      socket.off("room-users");
      socket.off("track-update");
      unsubscribe();
      stopAndLeave();
    };
  }, [roomId, authUser, setupAudio, stopAndLeave, navigation]);

  // --- ⏯️ PLAY/PAUSE LOGIC (LOCAL + REMOTE SYNC) ---
  const togglePlay = async () => {
    if (!soundRef.current) return;
    const nextState = !isPlaying;

    try {
      if (nextState) {
        await soundRef.current.playAsync();
      } else {
        await soundRef.current.pauseAsync();
      }
      
      // Notify other devices in the room
      socket.emit("sync-music", { 
        roomId, 
        station, 
        isPlaying: nextState,
        sentAt: Date.now() 
      });
      
      setIsPlaying(nextState);
    } catch (error) {
      console.error("Toggle Play Error:", error);
    }
  };

  // --- 🔊 VOLUME LOGIC ---
  const handleVolumeChange = async (newVol: number) => {
    setVolume(newVol);
    if (soundRef.current) {
      await soundRef.current.setVolumeAsync(newVol);
    }
  };

  // --- 📩 INVITE LOGIC ---
  const searchUsers = async (q: string) => {
    setUserQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await axios.post("/user/search", { name: q.trim() });
      if (res.data.success) setSearchResults(res.data.users);
    } finally {
      setSearching(false);
    }
  };

  const sendInvite = (targetUser: any) => {
    if (targetUser._id === authUser?._id) return;
    if (invitedUsers[targetUser._id]) return;

    // 🔥 DATA PAYLOAD MUST MATCH BACKEND EXPECTATIONS
    const jamData = {
      roomId,
      station,
      host: { 
        _id: authUser?._id, 
        username: authUser?.username, 
        avatar: authUser?.avatar 
      }
    };
    
    console.log("Sending invite to:", targetUser.username);
    socket.emit("invite-squad", jamData);
    
    // Set 30s UI Cooldown
    setInvitedUsers(prev => ({ ...prev, [targetUser._id]: true }));
    setTimeout(() => {
      setInvitedUsers(prev => {
        const newState = { ...prev };
        delete newState[targetUser._id];
        return newState;
      });
    }, 30000);
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <LinearGradient colors={['#ec489933', '#000', '#000']} className="absolute inset-0" />
      
      <SafeAreaView className="flex-1">
        {/* HEADER */}
        <View className="flex-row justify-between items-center px-6 pt-4">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="bg-red-500/20 p-2 rounded-full border border-red-500/30 z-10"
          >
            <Ionicons name="exit-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
          <Text className="text-white/50 font-bold uppercase text-[10px] tracking-[2px]">Fync Squad Jam</Text>
          <TouchableOpacity 
            onPress={() => setIsInviteModalOpen(true)}
            className="bg-pink-500/20 p-2 rounded-full border border-pink-500/30 z-10"
          >
            <Ionicons name="person-add" size={20} color="#ec4899" />
          </TouchableOpacity>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          {/* ARTWORK CARD */}
          <View className="w-full aspect-square rounded-[40px] overflow-hidden shadow-2xl shadow-pink-500/20 border border-white/10">
            <Image source={station.artwork ? { uri: station.artwork } : FYNC_LOGO} className="w-full h-full" resizeMode="cover" />

          </View>

          {/* SONG INFO */}
          <View className="w-full mt-10 items-start">
            <Text className="text-white text-3xl font-black tracking-tighter italic" numberOfLines={1}>{station.name}</Text>
            <View className="flex-row items-center mt-1">
               <View className="w-2 h-2 rounded-full bg-pink-500 mr-2 animate-pulse" />
               <Text className="text-pink-500 font-medium text-lg">Live Radio</Text>
            </View>
          </View>

          {/* PROGRESS BAR VIBE */}
          <View className="w-full h-1 bg-white/10 rounded-full mt-8 overflow-hidden">
            <View className={`h-full bg-pink-500 ${isPlaying ? 'w-full' : 'w-0'}`} />
          </View>

          {/* CONTROLS */}
          <View className="flex-row items-center justify-between w-full mt-10 px-4">
            <Ionicons name="shuffle-outline" size={28} color="white" style={{ opacity: 0.3 }} />
            <Ionicons name="play-skip-back" size={36} color="white" style={{ opacity: 0.3 }} />
            
            <TouchableOpacity 
              onPress={togglePlay} 
              disabled={loading}
              activeOpacity={0.7}
              className="w-24 h-24 bg-white rounded-full items-center justify-center shadow-2xl shadow-white/50"
            >
              {loading ? (
                <ActivityIndicator color="#ec4899" size="large" />
              ) : (
                <Ionicons name={isPlaying ? "pause" : "play"} size={48} color="black" />
              )}
            </TouchableOpacity>

            <Ionicons name="play-skip-forward" size={36} color="white" style={{ opacity: 0.3 }} />
            <Ionicons name="repeat-outline" size={28} color="white" style={{ opacity: 0.3 }} />
          </View>

          {/* VOLUME SLIDER */}
          <View className="w-full mt-12 flex-row items-center bg-white/5 p-4 rounded-3xl border border-white/5">
            <Ionicons name={volume === 0 ? "volume-mute" : "volume-low"} size={20} color="white" style={{ opacity: 0.5 }} />
            <View className="flex-1 mx-4 h-1.5 bg-zinc-800 rounded-full overflow-hidden justify-center">
              <TouchableOpacity 
                activeOpacity={1}
                onPress={(e) => {
                  const relativeX = e.nativeEvent.locationX;
                  handleVolumeChange(Math.max(0, Math.min(1, relativeX / 200)));
                }}
                style={{ width: `${volume * 100}%` }}
                className="h-full bg-pink-500"
              />
            </View>
            <Ionicons name="volume-high" size={20} color="white" style={{ opacity: 0.5 }} />
          </View>

          {/* SQUAD SECTION */}
          <View className="w-full mt-8 bg-white/5 p-4 rounded-3xl border border-white/5 mb-6">
            <Text className="text-white/40 font-bold uppercase text-[9px] tracking-widest mb-3 text-center">Currently Jamming • {squad.length}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {squad.map((member, index) => (
                <View key={index} className="mr-4 items-center">
                  <View className="border-2 border-pink-500 rounded-full p-0.5 shadow-lg shadow-pink-500/50">
                    <Image source={{ uri: member.avatar || `https://ui-avatars.com/api/?name=${member.username}` }} className="w-10 h-10 rounded-full bg-zinc-800" />
                  </View>
                  <Text className="text-white/60 text-[8px] mt-1 font-bold">@{member.username}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>

      {/* INVITE MODAL */}
      <Modal visible={isInviteModalOpen} animationType="slide" transparent={true} onRequestClose={() => setIsInviteModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/80">
          <View className="bg-zinc-900 rounded-t-[40px] h-[70%] p-6 border-t border-white/10">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-black uppercase italic">Invite Squad</Text>
              <TouchableOpacity onPress={() => setIsInviteModalOpen(false)}>
                <Ionicons name="close-circle" size={30} color="white" />
              </TouchableOpacity>
            </View>

            <View className="bg-white/5 rounded-2xl flex-row items-center px-4 py-3 border border-white/10 mb-6">
              <Ionicons name="search" size={20} color="#ec4899" />
              <TextInput 
                className="flex-1 ml-3 text-white font-medium" 
                placeholder="Search friends..." 
                placeholderTextColor="#555" 
                value={userQuery} 
                onChangeText={searchUsers} 
              />
            </View>

            {searching ? <ActivityIndicator color="#ec4899" /> : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                  const isInvited = invitedUsers[item._id];
                  const isSelf = item._id === authUser?._id;
                  return (
                    <View className="flex-row items-center justify-between p-4 mb-3 bg-white/5 rounded-2xl border border-white/5">
                      <View className="flex-row items-center">
                        <Image source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}` }} className="w-10 h-10 rounded-full mr-3" />
                        <Text className="text-white font-bold">{item.username} {isSelf && "(You)"}</Text>
                      </View>
                      {!isSelf && (
                        <TouchableOpacity 
                          onPress={() => sendInvite(item)} 
                          disabled={isInvited} 
                          className={`${isInvited ? 'bg-zinc-700' : 'bg-pink-500'} px-5 py-2.5 rounded-full`}
                        >
                          <Text className="text-white text-[10px] font-black uppercase">{isInvited ? 'Invited' : 'Invite'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}