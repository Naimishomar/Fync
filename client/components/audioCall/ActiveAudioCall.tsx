import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { webRTCManager } from '../../services/WebRTCService';
import Avatar from '../Avatar';
import { useBottomInset } from '../../constants/layout';
import type { CallUser } from '../../services/CallSignalingService';

export default function ActiveAudioCall({
  remoteUser,
  isCallConnected,
  onEndCall,
}: {
  remoteUser: CallUser;
  isCallConnected: boolean;
  onEndCall: () => void;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isSpeaker, setIsSpeaker] = useState(webRTCManager.isSpeakerOn);
  const bottomInset = useBottomInset();

  useEffect(() => {
    if (!isCallConnected) return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [isCallConnected]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    webRTCManager.toggleMute(next);
  };

  return (
    <View className="flex-1 bg-[#0f172a]">
      <StatusBar barStyle="light-content" />

      {/* Same orange wash as the rest of the app, inverted for a call screen. */}
      <View className="absolute top-0 w-full h-96 opacity-30">
        <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="items-center pt-6">
          <View className="flex-row items-center bg-white/10 px-4 py-1.5 rounded-full border border-white/15">
            <Ionicons name="lock-closed" size={11} color="#fb923c" />
            <Text className="text-white/70 text-2xs font-black uppercase tracking-wide ml-2">
              Encrypted
            </Text>
          </View>
        </View>

        <View className="flex-1 items-center justify-center px-10">
          <Avatar user={remoteUser as any} size={140} showBadge={false} />

          <Text
            className="text-white text-2xl font-black uppercase tracking-tight mt-8 text-center"
            numberOfLines={1}
          >
            {remoteUser.name}
          </Text>

          {!!remoteUser.college && (
            <Text
              className="text-white/50 text-2xs font-bold uppercase tracking-wide mt-1 text-center"
              numberOfLines={1}
            >
              {remoteUser.college}
            </Text>
          )}

          <Text className="text-orange-400 text-2xs font-black uppercase tracking-[3px] mt-6">
            {isCallConnected ? formatDuration(duration) : 'Connecting…'}
          </Text>
        </View>

        <View
          className="flex-row items-center justify-center gap-8 px-10"
          style={{ paddingBottom: bottomInset + 24 }}
        >
          <Pressable
            onPress={handleToggleMute}
            className={`w-14 h-14 rounded-2xl items-center justify-center border active:opacity-70 ${
              isMuted ? 'bg-white border-white' : 'bg-white/10 border-white/15'
            }`}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={22}
              color={isMuted ? '#0f172a' : '#ffffff'}
            />
          </Pressable>

          <Pressable
            onPress={onEndCall}
            className="w-20 h-20 rounded-full bg-red-500 items-center justify-center active:opacity-70"
            style={{
              shadowColor: '#ef4444',
              shadowOpacity: 0.5,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel="End call"
          >
            <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>

          <Pressable
            onPress={() => setIsSpeaker(webRTCManager.setSpeakerphone(!isSpeaker))}
            className={`w-14 h-14 rounded-2xl items-center justify-center border active:opacity-70 ${
              isSpeaker ? 'bg-white border-white' : 'bg-white/10 border-white/15'
            }`}
            accessibilityRole="button"
            accessibilityLabel={isSpeaker ? 'Switch to earpiece' : 'Switch to speaker'}
          >
            <Ionicons
              name={isSpeaker ? 'volume-high' : 'volume-low'}
              size={22}
              color={isSpeaker ? '#0f172a' : '#ffffff'}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
