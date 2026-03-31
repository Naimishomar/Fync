import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform, StatusBar, Alert, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { differenceInSeconds, addDays, startOfDay } from 'date-fns';
import * as ImagePicker from 'expo-image-picker'; 
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket'; 
import axios from '../../context/axiosConfig';

const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

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
  const [replyingTo, setReplyingTo] = useState<any>(null);

  const { user } = useAuth();
  const CURRENT_USER_ID = user?._id || user?.id; 
  const myIdentity = getNightIdentity(CURRENT_USER_ID);
  const flatListRef = useRef<FlatList>(null);

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
          createdAt: new Date().toISOString(), pending: true,
          replyTo: replyingTo ? {
              messageId: replyingTo._id,
              text: replyingTo.messageType === 'image' ? 'Image' : replyingTo.message,
              senderName: getNightIdentity(replyingTo.sender._id).username
          } : null
      };

      setMessages(prev => [optimisticMsg, ...prev]);

      try {
          const formData = new FormData();
          const cleanUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
          formData.append("file", { 
              uri: cleanUri, 
              name: "night_club.jpg", 
              type: "image/jpeg" 
          } as any);
          
          const res = await axios.post("/night-chat/upload", formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (res.data.success) {
              socket.emit("send_night_message", {
                  senderId: CURRENT_USER_ID, text: "", tempId, type: 'image', mediaUrl: res.data.fileUrl,
                  replyTo: optimisticMsg.replyTo
              });
          }
      } catch (e) {
          console.error("Media Error:", e);
          setMessages(prev => prev.filter(m => m.tempId !== tempId));
          Alert.alert("Error", "Failed to send image.");
      } finally {
          setIsProcessing(false);
          setReplyingTo(null);
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

  const sendMessage = () => {
    if (!inputText.trim() || !CURRENT_USER_ID) return;
    const textToSend = inputText.trim();
    const tempId = Date.now().toString();

    const optimisticMsg = {
        _id: tempId, tempId, message: textToSend, type: 'text',
        sender: { _id: CURRENT_USER_ID, username: user?.username || "Me", avatar: user?.avatar },
        createdAt: new Date().toISOString(), pending: true,
        replyTo: replyingTo ? {
            messageId: replyingTo._id,
            text: replyingTo.messageType === 'image' ? 'Image' : replyingTo.message,
            senderName: getNightIdentity(replyingTo.sender._id).username
        } : null
    };

    setMessages(prev => [optimisticMsg, ...prev]);
    setInputText("");

    socket.emit("send_night_message", {
      senderId: CURRENT_USER_ID, text: textToSend, tempId, type: 'text',
      replyTo: optimisticMsg.replyTo
    });

    setReplyingTo(null);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender._id === CURRENT_USER_ID;
    const identity = getNightIdentity(item.sender._id);

    return (
        <View className={`mb-4 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
            {!isMe && (
                <Image 
                    source={{ uri: identity.avatar }} 
                    className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 mr-2 self-end mb-1" 
                />
            )}
            <View className={`max-w-[80%] rounded-xl px-4 py-3 ${isMe ? 'bg-gray-800' : 'bg-zinc-900/90 border border-white/5'}`}>
                <Pressable
                  onLongPress={() => setReplyingTo(item)}
                  delayLongPress={300}
                >
                    {!isMe && (
                        <Text className="text-white/60 font-black text-[10px] mb-1 uppercase tracking-widest">{identity.username}</Text>
                    )}

                    {item.replyTo && (
                        <View className="bg-zinc-950/50 border-l-2 border-indigo-500 rounded-md mb-2 p-2">
                             <Text className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">{item.replyTo.senderName}</Text>
                             <Text className="text-white/50 text-[12px]" numberOfLines={1}>{item.replyTo.text}</Text>
                        </View>
                    )}
                    
                    {item.messageType === 'image' || item.type === 'image' ? (
                        <View className="mb-1">
                            <Image 
                                source={{ uri: item.fileUrl || item.mediaUrl }} 
                                style={{ width: 220, height: 160, borderRadius: 12 }} 
                                resizeMode="cover" 
                            />
                            {item.pending && (
                                <View className="absolute inset-0 items-center justify-center bg-black/30 rounded-xl">
                                    <ActivityIndicator size="small" color="white" />
                                </View>
                            )}
                        </View>
                    ) : (
                        <Text className="text-white text-[15px] leading-5 font-medium">
                            {item.message}
                        </Text>
                    )}

                    <View className="flex-row justify-end mt-1.5">
                         <Text className={`text-[8px] font-bold ${isMe ? 'text-indigo-200/50' : 'text-zinc-500'}`}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </Pressable>
            </View>
        </View>
    );
};

  if (!isOpen) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-60" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} className="absolute w-full h-full" />
        <View className="items-center p-10 bg-black/40 rounded-[40px] border border-white/10 shadow-2xl w-[85%]">
            <Ionicons name="lock-closed" size={42} color="#818cf8" />
            <Text className="text-white text-3xl font-black mt-4 uppercase tracking-tighter">Club Locked</Text>
            <Text className="text-indigo-400 font-mono text-xl font-bold mt-2">{timeLeft}</Text>
            <Text className="text-gray-500 text-[10px] uppercase font-black tracking-[4px] mt-8 text-center">Doors Open At Midnight</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
        <StatusBar barStyle="light-content" />
        <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-30" />
        <LinearGradient colors={['rgba(79, 70, 229, 0.1)', 'rgba(0,0,0,0.9)', '#000000']} className="absolute w-full h-full" />

        <SafeAreaView className="flex-1" edges={['top']}>
            <BlurView intensity={40} tint="dark" className="px-5 py-4 flex-row items-center justify-between border-b border-white/5">
                <View className="flex-row items-center">
                    <View className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/30 mr-3">
                        <MaterialCommunityIcons name="moon-waning-crescent" size={22} color="#818cf8" />
                    </View>
                    <View>
                        <Text className="text-white font-black uppercase text-xs tracking-widest">12 AM Night Club</Text>
                        <Text className="text-indigo-400 font-bold text-[8px] uppercase tracking-widest">Ephemeral Connection</Text>
                    </View>
                </View>
                <View className="flex-row items-center bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                    <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" />
                    <Text className="text-red-400 text-[10px] font-black uppercase tracking-widest">Live</Text>
                </View>
            </BlurView>

            <View className="flex-1">
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    inverted
                    keyExtractor={(item) => item._id || item.tempId || Math.random().toString()}
                    contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderMessage}
                />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
                
                {replyingTo && (
                  <BlurView intensity={80} tint="dark" className="px-5 py-3 border-t border-white/5 flex-row items-center justify-between">
                    <View className="border-l-2 border-indigo-500 pl-3 flex-1">
                      <Text className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                        Replying to {getNightIdentity(replyingTo.sender._id).username}
                      </Text>
                      <Text className="text-white/60 text-xs" numberOfLines={1}>
                        {replyingTo.messageType === 'image' ? 'Shared an image' : replyingTo.message}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                      <Ionicons name="close-circle" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  </BlurView>
                )}

                <View className="bg-zinc-950/80 px-5 pt-4 pb-8 border-t border-white/5">
                    <View className="flex-row items-end gap-3">
                        <TouchableOpacity 
                            onPress={pickImage}
                            disabled={isProcessing}
                            className="w-11 h-11 bg-zinc-900 rounded-2xl items-center justify-center mb-1 border border-white/5"
                        >
                            {isProcessing ? (
                                <ActivityIndicator size="small" color="#818cf8" />
                            ) : (
                                <Feather name="image" size={20} color="#818cf8" />
                            )}
                        </TouchableOpacity>
                        
                        <View className="flex-1 min-h-[44px] max-h-32 bg-zinc-900/50 rounded-2xl px-4 border border-white/5 justify-center">
                            <TextInput 
                                placeholder={isProcessing ? "Sending binary data..." : `Posting as ${myIdentity.username}...`}
                                placeholderTextColor="#4b5563"
                                className="text-white text-sm font-semibold"
                                multiline
                                value={inputText}
                                onChangeText={setInputText}
                                editable={!isProcessing}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={sendMessage}
                            disabled={isProcessing || !inputText.trim()}
                            className={`w-11 h-11 rounded-2xl items-center justify-center mb-1 ${inputText.trim() ? 'bg-indigo-600' : 'bg-zinc-800'}`}
                        >
                            <Feather name="arrow-up" size={24} color={inputText.trim() ? "white" : "#4b5563"} />
                        </TouchableOpacity>
                    </View>
                    
                    <Text className="text-zinc-600 text-[10px] font-black uppercase tracking-[2px] text-center mt-4">
                        Doors close at 6 AM
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    </View>
  );
}