import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { differenceInSeconds, addDays, startOfDay } from 'date-fns';
import * as ImagePicker from 'expo-image-picker'; // Image Library
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket'; 
import axios from '../../context/axiosConfig';

// High-Res Night Sky Background
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

// --- 🎭 IDENTITY GENERATOR ---
const ADJECTIVES = ["Neon", "Silent", "Hollow", "Cyber", "Mist", "Void", "Lunar", "Solar", "Glitch", "Shadow", "Retro", "Lost", "Vivid", "Dark", "Pale"];
const NOUNS = ["Walker", "Ghost", "Echo", "Mind", "Rider", "Surfer", "Drifter", "Phantom", "Signal", "Soul", "Viper", "Nomad", "Wolf", "Owl", "Rebel"];

const getNightIdentity = (userId: string | undefined) => {
    if (!userId) return { username: "Unknown Soul", avatar: "https://api.dicebear.com/9.x/glass/png?seed=unknown" };
    const today = new Date().toDateString(); 
    const seed = userId + today;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    const adjIndex = Math.abs(hash) % ADJECTIVES.length;
    const nounIndex = Math.abs(hash >> 3) % NOUNS.length; 
    const username = `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`;
    const avatar = `https://api.dicebear.com/9.x/dylan/png?seed=${hash}`;
    return { username, avatar };
};

export default function TwelveAMClub() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(""); 
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  
  const [isProcessing, setIsProcessing] = useState(false);

  const { user } = useAuth();
  const CURRENT_USER_ID = user?._id || user?.id; 
  const myIdentity = getNightIdentity(CURRENT_USER_ID);
  const flatListRef = useRef<FlatList>(null);

  // --- 1. TIME CHECKER LOGIC ---
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const open = hour >= 0 && hour < 6;
      setIsOpen(open);
      if (!open) {
        const nextMidnight = startOfDay(addDays(now, 1));
        const seconds = differenceInSeconds(nextMidnight, now);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };
    checkTime(); 
    const timer = setInterval(checkTime, 1000); 
    return () => clearInterval(timer);
  }, []);

  // --- 2. SOCKET EVENT LISTENERS ---
  useEffect(() => {
    if (!isOpen) return;
    socket.emit("join_night_club");

    const handleJoined = (data: any) => {
      setMessages([...data.history].reverse());
    };

    const handleNewMessage = (msg: any) => {
      setMessages((prev) => {
        if (msg._id && prev.some(m => m._id === msg._id)) return prev;
        const pendingIndex = prev.findIndex(m => m.pending && m.tempId === msg.tempId);
        if (pendingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[pendingIndex] = msg; 
            return newMessages;
        }
        return [msg, ...prev];
      });
    };

    const handleError = (err: any) => Alert.alert("Club Error", err.message);

    socket.on("night_club_joined", handleJoined);
    socket.on("new_night_message", handleNewMessage);
    socket.on("night_club_error", handleError);
    socket.on("connect", () => socket.emit("join_night_club"));

    return () => {
      socket.off("night_club_joined", handleJoined);
      socket.off("new_night_message", handleNewMessage);
      socket.off("night_club_error", handleError);
    };
  }, [isOpen]);

  const processAndSendMedia = async (uri: string) => {
      if (!CURRENT_USER_ID) return;
      setIsProcessing(true);
      const tempId = Date.now().toString();
      
      const optimisticMsg = {
          _id: tempId, tempId, message: "", messageType: 'image', fileUrl: uri,
          sender: { _id: CURRENT_USER_ID, username: user?.username || "Me", avatar: user?.avatar },
          createdAt: new Date().toISOString(), pending: true 
      };

      setMessages(prev => [optimisticMsg, ...prev]);

      try {
          const formData = new FormData();
          formData.append("file", { uri, name: "night_club.jpg", type: "image/jpeg" } as any);
          
          const res = await axios.post("/night-chat/upload", formData);

          if (res.data.success) {
              socket.emit("send_night_message", {
                  senderId: CURRENT_USER_ID, text: "", tempId, type: 'image', mediaUrl: res.data.fileUrl
              });
          }
      } catch (e) {
          console.error("Media Error:", e);
          setMessages(prev => prev.filter(m => m.tempId !== tempId));
          Alert.alert("Error", "Failed to send image.");
      } finally {
          setIsProcessing(false);
      }
  };

  const pickImage = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
          Alert.alert('Permission needed', 'Access to gallery required.');
          return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.3,
      });
      if (!result.canceled) {
          processAndSendMedia(result.assets[0].uri);
      }
  };


  // --- 4. TEXT MESSAGE ---
  const sendMessage = () => {
    if (!inputText.trim() || !CURRENT_USER_ID) return;
    const textToSend = inputText.trim();
    const tempId = Date.now().toString();

    const optimisticMsg = {
        _id: tempId, tempId, message: textToSend, type: 'text',
        sender: { _id: CURRENT_USER_ID, username: user?.username || "Me", avatar: user?.avatar },
        createdAt: new Date().toISOString(), pending: true 
    };

    setMessages(prev => [optimisticMsg, ...prev]);
    setInputText("");

    socket.emit("send_night_message", {
      senderId: CURRENT_USER_ID, text: textToSend, tempId, type: 'text'
    });
  };

  if (!isOpen) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-60" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} className="absolute w-full h-full" />
        <View className="items-center p-10 bg-black/40 rounded-[40px] border border-white/10 shadow-2xl w-[85%]">
            <Ionicons name="lock-closed" size={42} color="#6b7280" />
            <Text className="text-white text-3xl font-black mt-4">CLUB LOCKED</Text>
            <Text className="text-indigo-400 font-mono text-xl font-bold mt-2">{timeLeft}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-50" />
      <LinearGradient colors={['rgba(236, 72, 153, 0.15)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <BlurView intensity={80} tint="dark" className="px-4 py-3 flex-row items-center justify-between border-b border-white/10 z-10">
            <View className="flex-row items-center">
                <View className="bg-pink-500/10 p-2 rounded-xl border border-pink-500/20 mr-3">
                    <MaterialCommunityIcons name="moon-waning-crescent" size={22} color="#f472b6" />
                </View>
                <View>
                    <Text className="text-white text-lg font-black tracking-tight shadow-md">The 12 AM Club</Text>
                    <Text className="text-pink-400/80 text-[10px] font-bold tracking-[2px] uppercase">Ephemeral Chat</Text>
                </View>
            </View>
            <View className="bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 flex-row items-center">
                <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2 animate-pulse" />
                <Text className="text-red-400 text-[10px] font-bold">LIVE</Text>
            </View>
        </BlurView>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
            <FlatList
                ref={flatListRef}
                data={messages}
                inverted
                keyExtractor={(item) => item._id || item.tempId || Math.random().toString()}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20, paddingTop: 10 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                    const isMe = item.sender._id === CURRENT_USER_ID;
                    const identity = getNightIdentity(item.sender._id);

                    return (
                        <View className={`mb-2 flex-row items-center ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {!isMe && <Image source={{ uri: identity.avatar }} width={25} height={25} className="w-7 h-7 rounded-full border border-white/10 mr-2 mb-1 bg-white/10" />}
                            
                            <View className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && <Text className="text-gray-500 text-[10px] ml-2 font-medium">{identity.username}</Text>}

                                {/* BUBBLE CONTAINER */}
                                <View className={`px-2 py-2 ${isMe ? 'border border-gray-700 rounded-full rounded-br-md' : 'bg-[#262626] rounded-[22px] rounded-bl-md'}`}>
                            
                                    {item.messageType === 'image' || item.type === 'image' ? (
                                        <Image 
                                            source={{ uri: item.fileUrl || item.mediaUrl }} 
                                            style={{ width: 200, height: 150, borderRadius: 10 }} 
                                            resizeMode="cover" 
                                        />
                                    ) : (
                                        <Text className={`${isMe ? 'text-pink-300' : 'text-white'} text-[15px] leading-5 font-normal`}>
                                            {item.message}
                                        </Text>
                                    )}
                                    
                                </View>
                            </View>
                        </View>
                    );
                }}
            />

            {/* Input Area */}
            <View className="px-3 pt-2 pb-8 bg-black/80 border-t border-white/5 mb-5"> 
                <View className="flex-row items-center bg-[#1a1a1a] rounded-full px-1 py-1 border border-white/10 min-h-[44px]">
                    
                    {/* CAMERA BUTTON (Now Functional) */}
                    <TouchableOpacity onPress={pickImage} disabled={isProcessing} className="w-9 h-9 rounded-full bg-blue-500/20 items-center justify-center ml-1">
                         {isProcessing ? <ActivityIndicator size="small" color="#3b82f6" /> : <Ionicons name="camera" size={20} color="#3b82f6" />}
                    </TouchableOpacity>

                    <TextInput 
                        placeholder={isProcessing ? "Sending..." : `Posting as ${myIdentity.username}...`}
                        placeholderTextColor="#9ca3af"
                        multiline
                        maxLength={500}
                        editable={!isProcessing}
                        className="flex-1 text-white text-[15px] px-3 py-2 max-h-24 leading-5"
                        value={inputText}
                        onChangeText={setInputText}
                    />

                    {inputText.trim().length > 0 ? (
                        <TouchableOpacity onPress={sendMessage} className="mr-1 mb-0.5">
                            <Text className="text-pink-500 font-bold text-base px-3 py-2">Send</Text>
                        </TouchableOpacity>
                    ) : (
                        <View className="flex-row mr-2 space-x-3">
                             <TouchableOpacity onPress={pickImage} disabled={isProcessing}>
                                <Ionicons name="image-outline" size={24} color="white" />
                             </TouchableOpacity>
                        </View>
                    )}
                </View>
                
                <View className="items-center mt-3">
                    <Text className="text-gray-600 text-[10px] font-medium tracking-wide">
                        ✨ Be gentle. No harm. Zero history. ✨
                    </Text>
                </View>
            </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}