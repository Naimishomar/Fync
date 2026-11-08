import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import Avatar from '../Avatar';
import type { CallUser } from '../../services/CallSignalingService';
import { RTCView } from 'react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, MicOff, PhoneOff, Camera, CameraOff, RefreshCw } from '../ui/icons';
import { webRTCManager } from '../../services/WebRTCService';
import { C } from '../../constants/colors';

export default function ActiveVideoCall({ remoteUser, isCallConnected, onEndCall }: { remoteUser: CallUser, isCallConnected: boolean, onEndCall: () => void }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [, forceUpdate] = useState(0);
  // Full-bleed screen: the badge, pip and controls clear the notch and gesture bar themselves.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const onRemote = () => forceUpdate((x) => x + 1);
    webRTCManager.onRemoteStream = onRemote;
    return () => {
      webRTCManager.onRemoteStream = null;
    };
  }, []);

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

  const handleToggleVideo = () => {
    const next = !isVideoOn;
    setIsVideoOn(next);
    webRTCManager.setVideoEnabled(next);
  };

  const handleSwitchCamera = () => {
    webRTCManager.toggleCamera();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* REMOTE VIDEO (full screen) */}
      <View style={styles.remoteContainer}>
        {webRTCManager.remoteStream ? (
          <RTCView
            streamURL={webRTCManager.remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
            zOrder={0}
          />
        ) : (
          <View style={styles.remoteFallback}>
            <Avatar user={remoteUser as any} size={140} showBadge={false} />
            <Text style={styles.remoteName} numberOfLines={1}>{remoteUser.name}</Text>
            {!!remoteUser.college && (
              <Text style={styles.remoteCollege} numberOfLines={1}>{remoteUser.college}</Text>
            )}
            <Text style={styles.callingText}>
              {isCallConnected ? formatDuration(duration) : 'Connecting…'}
            </Text>
          </View>
        )}
        {isCallConnected && (
          <Text style={[styles.durationBadge, { top: insets.top + 12 }]}>{formatDuration(duration)}</Text>
        )}
      </View>

      {/* LOCAL VIDEO (pip) */}
      {webRTCManager.localStream && isVideoOn && (
        <View style={[styles.localContainer, { top: insets.top + 20 }]}>
          <RTCView
            streamURL={webRTCManager.localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            zOrder={1}
            mirror={true}
          />
        </View>
      )}

      {/* CONTROLS */}
      <View style={[styles.controls, { paddingBottom: Math.max(40, insets.bottom + 16) }]}>
        <Pressable
          onPress={handleToggleMute}
          className="active:opacity-70"
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
          accessibilityState={{ selected: isMuted }}
        >
          {isMuted ? <MicOff size={22} color="#12100E" /> : <Mic size={22} color="#fff" />}
        </Pressable>

        <Pressable
          onPress={handleToggleVideo}
          className="active:opacity-70"
          style={[styles.controlBtn, !isVideoOn && styles.controlBtnActive]}
          accessibilityRole="button"
          accessibilityLabel={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
          accessibilityState={{ selected: !isVideoOn }}
        >
          {isVideoOn ? <Camera size={22} color="#fff" /> : <CameraOff size={22} color="#12100E" />}
        </Pressable>

        <Pressable onPress={handleSwitchCamera} className="active:opacity-70" style={styles.controlBtn} accessibilityRole="button" accessibilityLabel="Switch camera">
          <RefreshCw size={22} color="#fff" />
        </Pressable>

        <Pressable onPress={onEndCall} className="active:opacity-70" style={styles.endBtn} accessibilityRole="button" accessibilityLabel="End call">
          <PhoneOff size={30} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12100E',
  },
  remoteContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#12100E',
  },
  remoteFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12100E',
  },
  remoteName: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.5,
    marginTop: 28,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  remoteCollege: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  callingText: {
    color: '#FB923C',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['tabular-nums'],
    marginTop: 20,
  },
  durationBadge: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['tabular-nums'],
    overflow: 'hidden',
  },
  localContainer: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#12100E',
  },
  localVideo: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#ffffff',
  },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
});