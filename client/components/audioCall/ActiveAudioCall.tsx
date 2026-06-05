import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, MicOff, PhoneOff } from 'lucide-react-native';
import { webRTCManager } from '../../services/WebRTCService';

export default function ActiveAudioCall({ remoteUser, isCallConnected, onEndCall }: { remoteUser: any, isCallConnected: boolean, onEndCall: () => void }) {
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCallConnected) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCallConnected]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    webRTCManager.toggleMute(!isMuted);
  };

  return (
    <LinearGradient 
      colors={['#ffffff', '#fff7ed', '#ffedd5']}
      className="flex-1 items-center pt-20 pb-10"
    >
      <View className="flex-row items-center mb-10 bg-white/60 px-4 py-2 rounded-full border border-orange-100">
        <Text className="text-orange-800 text-sm font-medium">🔒 End-to-End Encrypted</Text>
      </View>
      
      <View className="flex-1 items-center justify-center w-full">
        <View className="items-center">
          {remoteUser.profilePic ? (
            <Image 
              source={{ uri: remoteUser.profilePic }} 
              className="w-36 h-36 rounded-full mb-6 border-4 border-orange-100" 
            />
          ) : (
            <View className="w-36 h-36 rounded-full mb-6 bg-orange-100 items-center justify-center border-4 border-orange-50">
              <Text className="text-orange-600 font-bold text-5xl">{remoteUser.name?.charAt(0)}</Text>
            </View>
          )}
          
          <Text className="text-3xl font-bold text-gray-900 mb-2">{remoteUser.name}</Text>
          <Text className="text-gray-500 text-xl font-medium">{formatDuration(duration)}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-center w-full space-x-8 px-10 gap-8">
        <TouchableOpacity 
          onPress={handleToggleMute}
          className={`w-16 h-16 rounded-full items-center justify-center border ${isMuted ? 'bg-orange-50 border-orange-200' : 'bg-gray-100 border-gray-200'}`}
        >
          {isMuted ? <MicOff size={24} color="#ea580c" /> : <Mic size={24} color="#4b5563" />}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={onEndCall}
          className="bg-red-500 w-20 h-20 rounded-full items-center justify-center shadow-lg shadow-red-500/50"
        >
          <PhoneOff size={32} color="#FFF" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
