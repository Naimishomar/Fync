import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from '../Avatar';
import type { CallUser } from '../../services/CallSignalingService';
import { RTCView } from 'react-native-webrtc';
import { Mic, MicOff, PhoneOff, Camera, CameraOff, RefreshCw } from '../ui/icons';
import { webRTCManager } from '../../services/WebRTCService';

export default function ActiveVideoCall({ remoteUser, isCallConnected, onEndCall }: { remoteUser: CallUser, isCallConnected: boolean, onEndCall: () => void }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [, forceUpdate] = useState(0);

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
            {/* Same orange wash as every other screen, over the app's dark slate. */}
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
          <Text style={styles.durationBadge}>{formatDuration(duration)}</Text>
        )}
      </View>

      {/* LOCAL VIDEO (pip) */}
      {webRTCManager.localStream && isVideoOn && (
        <View style={styles.localContainer}>
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
      <View style={styles.controls}>
        <TouchableOpacity onPress={handleToggleMute} style={[styles.controlBtn, isMuted && styles.controlBtnActive]}>
          {isMuted ? <MicOff size={22} color="#12100E" /> : <Mic size={22} color="#fff" />}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleToggleVideo} style={[styles.controlBtn, !isVideoOn && styles.controlBtnActive]}>
          {isVideoOn ? <Camera size={22} color="#fff" /> : <CameraOff size={22} color="#12100E" />}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSwitchCamera} style={styles.controlBtn}>
          <RefreshCw size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={onEndCall} style={styles.endBtn}>
          <PhoneOff size={30} color="#fff" />
        </TouchableOpacity>
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
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    opacity: 0.3,
  },
  remoteName: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    marginTop: 28,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  remoteCollege: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  callingText: {
    color: '#F97316',
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
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
    fontFamily: 'Inter_700Bold',
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
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
    // Rounded-square, matching the 2xl radius the rest of the app uses for
    // icon buttons rather than the pill shape this screen had on its own.
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
});