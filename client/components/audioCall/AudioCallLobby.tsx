import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Modal, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/auth.context';
import { Mic, PhoneCall, PhoneOff, Phone } from 'lucide-react-native';
import { webRTCManager } from '../../services/WebRTCService';
import { callSignaling } from '../../services/CallSignalingService';
import axios from '../../context/axiosConfig';
import ActiveAudioCall from './ActiveAudioCall';

interface OnlineUser {
  _id: string;
  name: string;
  profilePic?: string;
  college?: string;
  status: 'online' | 'busy';
}

export default function AudioCallLobby({ navigation }: any) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Call States
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCallUser, setActiveCallUser] = useState<OnlineUser | null>(null);
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [userBusy, setUserBusy] = useState(false);
  const activeCallUserRef = useRef<OnlineUser | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const signalingReady = useRef(false);

  // Initialize signaling
  useEffect(() => {
    if (!user) return;

    // Setup signaling callbacks
    callSignaling.onIncomingCall = handleIncomingCall;
    callSignaling.onCallAnswered = handleCallAnswered;
    callSignaling.onIceCandidate = handleIceCandidate;
    callSignaling.onCallEnded = handleCallEnded;
    callSignaling.onCallRejected = handleCallRejected;
    callSignaling.onCallBusy = handleCallBusy;
    callSignaling.onCallFailed = handleCallFailed;
    callSignaling.onOnlineUsers = handleOnlineUsers;
    callSignaling.onUserStatus = handleUserStatus;

    // Connect to signaling server
    callSignaling.connect(user._id);
    signalingReady.current = true;

    // Fetch initial online users
    fetchOnlineUsers();

    return () => {
      // Cleanup
      if (activeCallUserRef.current) {
        callSignaling.endCall(activeCallUserRef.current._id);
      }
      callSignaling.disconnect();
      webRTCManager.cleanup();
      
      // Clear callbacks
      callSignaling.onIncomingCall = null;
      callSignaling.onCallAnswered = null;
      callSignaling.onIceCandidate = null;
      callSignaling.onCallEnded = null;
      callSignaling.onCallRejected = null;
      callSignaling.onCallBusy = null;
      callSignaling.onCallFailed = null;
      callSignaling.onOnlineUsers = null;
      callSignaling.onUserStatus = null;
    };
  }, [user]);

  const fetchOnlineUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get('/user/online');
      if (res.data?.success && Array.isArray(res.data.users)) {
        setOnlineUsers(res.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch online users:', error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const handleOnlineUsers = useCallback((users: OnlineUser[]) => {
    setOnlineUsers(users);
  }, []);

  const handleUserStatus = useCallback((data: { userId: string; status: string }) => {
    setOnlineUsers(prev => prev.map(u => 
      u._id === data.userId ? { ...u, status: data.status as 'online' | 'busy' } : u
    ));
  }, []);

  const handleIncomingCall = useCallback((data: { callerId: string; sdp: any; callerInfo: any }) => {
    if (activeCallUserRef.current) {
      // Auto-reject if already in a call
      callSignaling.sendBusy(data.callerId);
      return;
    }

    setIncomingCall({
      callerId: data.callerId,
      callerName: data.callerInfo?.name || 'Unknown',
      sdp: data.sdp,
    });
  }, []);

  const handleCallAnswered = useCallback(async (data: { sdp: any }) => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    await webRTCManager.setRemoteDescription(data.sdp);
  }, []);

  const handleIceCandidate = useCallback(async (data: { candidate: any }) => {
    await webRTCManager.addIceCandidate(data.candidate);
  }, []);

  const handleCallEnded = useCallback((data: { reason: string }) => {
    endCall(false);
    setIncomingCall((prev: any) => {
      if (prev && prev.callerId === data.reason) return null; // reason might be callerId in some cases
      return prev;
    });
    if (data.reason && data.reason !== 'ended') {
      Alert.alert("Call Ended", data.reason);
    }
  }, []);

  const handleCallRejected = useCallback(() => {
    endCall(false);
    Alert.alert("Call Rejected", "The user declined your call.");
  }, []);

  const handleCallBusy = useCallback(() => {
    endCall(false);
    Alert.alert("User Busy", "The user is currently in another call.");
  }, []);

  const handleCallFailed = useCallback((data: { reason: string }) => {
    endCall(false);
    Alert.alert("Call Failed", data.reason || "Unable to connect. Please try again.");
  }, []);

  // Handle outgoing call
  const startCall = useCallback(async (targetUser: OnlineUser) => {
    if (targetUser.status === 'busy') {
      Alert.alert("Busy", `${targetUser.name} is currently in another call.`);
      return;
    }

    setActiveCallUser(targetUser);
    activeCallUserRef.current = targetUser;
    setUserBusy(true);

    try {
      await webRTCManager.setupLocalStream();
      await webRTCManager.initializePeerConnection();

      // Send ICE candidates to target user
      webRTCManager.onIceCandidate = (candidate) => {
        callSignaling.sendIceCandidate(targetUser._id, candidate);
      };

      webRTCManager.onConnectionStateChange = (state) => {
        if (state === 'connected') {
          setIsCallConnected(true);
        }
        if (state === 'disconnected' || state === 'failed') {
          Alert.alert("Connection Lost", "The audio call disconnected due to poor network.");
          endCall(false);
        }
      };

      const offer = await webRTCManager.createOffer();
      
      callSignaling.sendOffer(targetUser._id, offer, {
        name: user.name,
        _id: user._id,
        profilePic: user.profilePic,
      });

      // Auto-cancel if no answer in 30 seconds
      callTimeoutRef.current = setTimeout(() => {
        endCall(true);
        Alert.alert("No Answer", `${targetUser.name} did not answer the call.`);
      }, 30000);
    } catch (error) {
      console.error('Start call error:', error);
      Alert.alert("Error", "Failed to start call. Please try again.");
      endCall(false);
    }
  }, [user]);

  // Handle answering call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    const caller: OnlineUser = { 
      _id: incomingCall.callerId, 
      name: incomingCall.callerName,
      status: 'busy',
    };
    setActiveCallUser(caller);
    activeCallUserRef.current = caller;
    setUserBusy(true);

    try {
      await webRTCManager.setupLocalStream();
      await webRTCManager.initializePeerConnection();

      // Send ICE candidates
      webRTCManager.onIceCandidate = (candidate) => {
        callSignaling.sendIceCandidate(incomingCall.callerId, candidate);
      };

      webRTCManager.onConnectionStateChange = (state) => {
        if (state === 'connected') {
          setIsCallConnected(true);
        }
        if (state === 'disconnected' || state === 'failed') {
          Alert.alert("Connection Lost", "The audio call disconnected due to poor network.");
          endCall(false);
        }
      };

      await webRTCManager.setRemoteDescription(incomingCall.sdp);
      const answer = await webRTCManager.createAnswer();

      callSignaling.sendAnswer(incomingCall.callerId, answer);

      setIncomingCall(null);
    } catch (error) {
      console.error('Accept call error:', error);
      Alert.alert("Error", "Failed to answer call.");
      endCall(false);
    }
  }, [incomingCall, user]);

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      callSignaling.rejectCall(incomingCall.callerId);
      setIncomingCall(null);
    }
  }, [incomingCall]);

  const endCall = useCallback(async (notifyOther = true) => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    
    webRTCManager.cleanup();
    
    if (notifyOther && activeCallUserRef.current) {
      callSignaling.endCall(activeCallUserRef.current._id);
    }
    
    setActiveCallUser(null);
    activeCallUserRef.current = null;
    setIsCallConnected(false);
    setUserBusy(false);
  }, []);

  // Show active call screen
  if (activeCallUser) {
    return (
      <ActiveAudioCall 
        remoteUser={activeCallUser} 
        isCallConnected={isCallConnected} 
        onEndCall={() => endCall(true)} 
      />
    );
  }

  return (
    <LinearGradient colors={['#ffffff', '#fff7ed', '#ffedd5']} className="flex-1">
      <View className="px-5 py-4 border-b border-orange-100 flex-row items-center justify-between">
        <Text className="text-xl font-black text-gray-900 tracking-tight uppercase">Audio Networking</Text>
        <View className="flex-row items-center gap-2">
          <View 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: callSignaling.isConnected() ? '#10b981' : '#ef4444' }}
          />
          <Text className="text-[10px] font-bold text-gray-500 uppercase">
            {callSignaling.isConnected() ? 'Connected' : 'Connecting...'}
          </Text>
        </View>
      </View>
      
      {loadingUsers ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#EA580C" />
          <Text className="text-gray-500 mt-4">Loading users...</Text>
        </View>
      ) : onlineUsers.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-24 h-24 rounded-full bg-orange-100 items-center justify-center mb-6">
            <Phone size={40} color="#EA580C" />
          </View>
          <Text className="text-xl font-bold text-gray-700 text-center mb-2">No one online yet</Text>
          <Text className="text-gray-500 text-center text-sm">Invite friends to start calling!</Text>
        </View>
      ) : (
        <FlatList
          data={onlineUsers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between mb-4 p-4 bg-white/80 rounded-[24px] border border-orange-50 shadow-sm">
              <View className="flex-row items-center flex-1">
                {item.profilePic ? (
                  <Image source={{ uri: item.profilePic }} className="w-12 h-12 rounded-full mr-4 bg-gray-200" />
                ) : (
                  <View className="w-12 h-12 rounded-full mr-4 bg-orange-100 items-center justify-center border-2 border-white">
                    <Text className="text-orange-600 font-bold">{item.name?.charAt(0)}</Text>
                  </View>
                )}
                <View className="flex-1 pr-4">
                  <Text className="font-bold text-gray-900 text-base">{item.name}</Text>
                  {item.college && <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1" numberOfLines={1}>{item.college}</Text>}
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${item.status === 'online' ? 'text-green-500' : 'text-orange-500'}`}>
                    {item.status === 'online' ? '● Online' : '● In a call'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                onPress={() => startCall(item)}
                disabled={item.status === 'busy' || userBusy}
                className={`p-3 rounded-full ${item.status === 'busy' || userBusy ? 'bg-gray-200' : 'bg-orange-500'}`}
              >
                <PhoneCall size={20} color={item.status === 'busy' || userBusy ? '#9CA3AF' : '#FFF'} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Incoming Call Modal */}
      <Modal 
        visible={!!incomingCall} 
        transparent 
        animationType="slide"
        onRequestClose={rejectCall}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 items-center">
            <View className="w-20 h-20 bg-orange-100 rounded-full items-center justify-center mb-4">
              <Phone size={40} color="#EA580C" />
            </View>
            <Text className="text-2xl font-bold mb-2">{incomingCall?.callerName}</Text>
            <Text className="text-gray-500 mb-8">Incoming Audio Call...</Text>
            
            <View className="flex-row w-full justify-around mb-8">
              <TouchableOpacity 
                onPress={rejectCall} 
                className="bg-red-500 w-16 h-16 rounded-full items-center justify-center"
                activeOpacity={0.8}
              >
                <PhoneOff size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={acceptCall} 
                className="bg-green-500 w-16 h-16 rounded-full items-center justify-center"
                activeOpacity={0.8}
              >
                <Phone size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}