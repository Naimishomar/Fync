import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, MicOff, PhoneOff, Camera, CameraOff, RefreshCw } from 'lucide-react-native';
import { webRTCManager } from '../../services/WebRTCService';

export default function ActiveVideoCall({ remoteUser, isCallConnected, onEndCall }: { remoteUser: any, isCallConnected: boolean, onEndCall: () => void }) {
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
          <LinearGradient colors={['#1e1b4b', '#312e81', '#4c1d95']} style={styles.remoteFallback}>
            {remoteUser.profilePic ? (
              <Image source={{ uri: remoteUser.profilePic }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{remoteUser.name?.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.remoteName}>{remoteUser.name}</Text>
            <Text style={styles.callingText}>
              {isCallConnected ? formatDuration(duration) : 'Ringing...'}
            </Text>
          </LinearGradient>
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
          {isMuted ? <MicOff size={24} color="#a78bfa" /> : <Mic size={24} color="#fff" />}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleToggleVideo} style={[styles.controlBtn, !isVideoOn && styles.controlBtnActive]}>
          {isVideoOn ? <Camera size={24} color="#fff" /> : <CameraOff size={24} color="#a78bfa" />}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSwitchCamera} style={styles.controlBtn}>
          <RefreshCw size={24} color="#fff" />
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
    backgroundColor: '#000',
  },
  remoteContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '900',
  },
  remoteName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
  },
  callingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
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
    fontWeight: '700',
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
    backgroundColor: '#000',
  },
  localVideo: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
    paddingVertical: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});