import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <View className="flex-1 bg-ink">
      <StatusBar barStyle="light-content" />

      {/* Same orange wash as the rest of the app, inverted for a call screen. */}

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="items-center pt-6">
          <View className="flex-row items-center bg-card/10 px-4 py-1.5 rounded-full border border-white/15">
            <Ionicons name="lock-closed" size={11} color="#F97316" />
            <Text className="text-white/70 text-label font-display uppercase ml-2">
              Encrypted
            </Text>
          </View>
        </View>

        <View className="flex-1 items-center justify-center px-gutter">
          <Avatar user={remoteUser as any} size={140} showBadge={false} />

          <Text
            className="text-white text-2xl font-display uppercase mt-8 text-center"
            numberOfLines={1}
          >
            {remoteUser.name}
          </Text>

          {!!remoteUser.college && (
            <Text
              className="text-white/50 text-label font-semibold uppercase mt-1 text-center"
              numberOfLines={1}
            >
              {remoteUser.college}
            </Text>
          )}

          <Text className="text-accent-text text-label font-display uppercase mt-6">
            {isCallConnected ? formatDuration(duration) : 'Connecting…'}
          </Text>
        </View>

        <View
          className="flex-row items-center justify-center gap-8 px-gutter"
          style={{ paddingBottom: bottomInset + 24 }}
        >
          <Pressable
            onPress={handleToggleMute}
            className={`w-14 h-14 rounded-card items-center justify-center border active:opacity-70 ${ isMuted ? 'bg-card border-white' : 'bg-card/10 border-white/15' }`}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={22}
              color={isMuted ? '#12100E' : '#ffffff'}
            />
          </Pressable>

          <Pressable
            onPress={onEndCall}
            className="w-20 h-20 rounded-full bg-danger items-center justify-center active:opacity-70"
            style={{
              shadowColor: '#DC2626',
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
            className={`w-14 h-14 rounded-card items-center justify-center border active:opacity-70 ${ isSpeaker ? 'bg-card border-white' : 'bg-card/10 border-white/15' }`}
            accessibilityRole="button"
            accessibilityLabel={isSpeaker ? 'Switch to earpiece' : 'Switch to speaker'}
          >
            <Ionicons
              name={isSpeaker ? 'volume-high' : 'volume-low'}
              size={22}
              color={isSpeaker ? '#12100E' : '#ffffff'}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
