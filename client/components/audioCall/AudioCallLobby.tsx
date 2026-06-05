import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Modal, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../context/auth.context';
import { Mic, PhoneCall, PhoneOff, Phone } from 'lucide-react-native';
import { webRTCManager } from '../../services/WebRTCService';
import ActiveAudioCall from './ActiveAudioCall';

export default function AudioCallLobby({ navigation }: any) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [channel, setChannel] = useState<any>(null);
  
  // Call States
  const [incomingCall, setIncomingCall] = useState<any>(null); // { callerId, callerName, sdp }
  const [activeCallUser, setActiveCallUser] = useState<any>(null); // Who we are calling / talking to
  const [isCallConnected, setIsCallConnected] = useState(false);
  const activeCallUserRef = useRef<any>(null); // Ref for accurate state inside event listeners
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    // 1. Join Presence Channel
    const room = supabase.channel('room:networking', {
      config: {
        presence: {
          key: user._id,
        },
      },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState();
        const users = [];
        for (const id in state) {
          // Exclude self and map the data
          if (id !== user._id) {
             const userState = state[id][0] as any;
             users.push({
               _id: id,
               name: userState.name,
               profilePic: userState.profilePic,
               college: userState.college,
               status: userState.status,
             });
          }
        }
        setOnlineUsers(users);
      })
      .on('broadcast', { event: 'CALL_OFFER' }, async ({ payload }) => {
        if (payload.targetUserId === user._id) {
          if (activeCallUserRef.current) {
            // Automatically reject if we are already in a call
            room.send({
              type: 'broadcast',
              event: 'CALL_END',
              payload: { targetUserId: payload.callerId, callerId: user._id, callerName: user.name, reason: 'busy' }
            });
            return;
          }
          setIncomingCall({
            callerId: payload.callerId,
            callerName: payload.callerName,
            sdp: payload.sdp,
          });
        }
      })
      .on('broadcast', { event: 'CALL_ANSWER' }, async ({ payload }) => {
        if (payload.targetUserId === user._id) {
          if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
          await webRTCManager.setRemoteDescription(payload.sdp);
        }
      })
      .on('broadcast', { event: 'ICE_CANDIDATE' }, async ({ payload }) => {
        if (payload.targetUserId === user._id) {
          await webRTCManager.addIceCandidate(payload.candidate);
        }
      })
      .on('broadcast', { event: 'CALL_END' }, ({ payload }) => {
        if (payload.targetUserId === user._id) {
           endCall(false);
           setIncomingCall((prev: any) => {
             if (prev && prev.callerId === payload.callerId) {
               return null;
             }
             return prev;
           });
           Alert.alert("Call Ended", `${payload.callerName} ended the call.`);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({
            name: user.name,
            profilePic: user.profilePic || '',
            college: user.college || '',
            status: 'online', // or 'busy'
          });
        }
      });

    setChannel(room);

    return () => {
      if (activeCallUserRef.current) {
        room.send({
          type: 'broadcast',
          event: 'CALL_END',
          payload: { targetUserId: activeCallUserRef.current._id, callerId: user._id, callerName: user.name }
        });
      }
      room.untrack();
      room.unsubscribe();
      webRTCManager.cleanup();
    };
  }, [user]);

  // Handle outgoing call
  const startCall = async (targetUser: any) => {
    if (targetUser.status === 'busy') {
      Alert.alert("Busy", `${targetUser.name} is currently in another call.`);
      return;
    }

    setActiveCallUser(targetUser);
    activeCallUserRef.current = targetUser;
    
    // Update our own status to busy
    await channel?.track({ name: user.name, profilePic: user.profilePic, college: user.college, status: 'busy' });

    await webRTCManager.setupLocalStream();
    await webRTCManager.initializePeerConnection();

    // Send ICE candidates to target user
    webRTCManager.onIceCandidate = (candidate) => {
      channel?.send({
        type: 'broadcast',
        event: 'ICE_CANDIDATE',
        payload: { targetUserId: targetUser._id, candidate, callerId: user._id },
      });
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
    
    channel?.send({
      type: 'broadcast',
      event: 'CALL_OFFER',
      payload: { targetUserId: targetUser._id, callerId: user._id, callerName: user.name, sdp: offer },
    });

    // Auto-cancel if no answer in 30 seconds
    callTimeoutRef.current = setTimeout(() => {
      endCall(true);
      Alert.alert("No Answer", `${targetUser.name} did not answer the call.`);
    }, 30000);
  };

  // Handle answering call
  const acceptCall = async () => {
    if (!incomingCall) return;

    const caller = { _id: incomingCall.callerId, name: incomingCall.callerName };
    setActiveCallUser(caller);
    activeCallUserRef.current = caller;
    await channel?.track({ name: user.name, profilePic: user.profilePic, college: user.college, status: 'busy' });

    await webRTCManager.setupLocalStream();
    await webRTCManager.initializePeerConnection();

    // Send ICE candidates
    webRTCManager.onIceCandidate = (candidate) => {
      channel?.send({
        type: 'broadcast',
        event: 'ICE_CANDIDATE',
        payload: { targetUserId: incomingCall.callerId, candidate, callerId: user._id },
      });
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

    channel?.send({
      type: 'broadcast',
      event: 'CALL_ANSWER',
      payload: { targetUserId: incomingCall.callerId, callerId: user._id, sdp: answer },
    });

    setIncomingCall(null);
  };

  const rejectCall = () => {
    if (incomingCall) {
      channel?.send({
        type: 'broadcast',
        event: 'CALL_END',
        payload: { targetUserId: incomingCall.callerId, callerId: user._id, callerName: user.name },
      });
      setIncomingCall(null);
    }
  };

  const endCall = async (notifyOther = true) => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    webRTCManager.cleanup();
    if (notifyOther && activeCallUser) {
      channel?.send({
        type: 'broadcast',
        event: 'CALL_END',
        payload: { targetUserId: activeCallUser._id, callerId: user._id, callerName: user.name },
      });
    }
    setActiveCallUser(null);
    activeCallUserRef.current = null;
    setIsCallConnected(false);
    await channel?.track({ name: user.name, profilePic: user.profilePic, college: user.college, status: 'online' });
  };

  if (activeCallUser) {
    return <ActiveAudioCall remoteUser={activeCallUser} isCallConnected={isCallConnected} onEndCall={() => endCall(true)} />;
  }

  return (
    <LinearGradient colors={['#ffffff', '#fff7ed', '#ffedd5']} className="flex-1 pt-10">
      <View className="px-5 py-4 border-b border-orange-100 flex-row items-center">
        <Text className="text-xl font-black text-gray-900 tracking-tight uppercase">Audio Networking</Text>
      </View>
      
      {onlineUsers.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">No one is online right now. Invite friends!</Text>
        </View>
      ) : (
        <FlatList
          data={onlineUsers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20 }}
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
                disabled={item.status === 'busy'}
                className={`p-3 rounded-full ${item.status === 'busy' ? 'bg-gray-200' : 'bg-orange-500'}`}
              >
                <PhoneCall size={20} color={item.status === 'busy' ? '#9CA3AF' : '#FFF'} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Incoming Call Modal */}
      <Modal visible={!!incomingCall} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 items-center">
            <View className="w-20 h-20 bg-orange-100 rounded-full items-center justify-center mb-4">
              <Phone size={40} color="#EA580C" />
            </View>
            <Text className="text-2xl font-bold mb-2">{incomingCall?.callerName}</Text>
            <Text className="text-gray-500 mb-8">Incoming Audio Call...</Text>
            
            <View className="flex-row w-full justify-around mb-8">
              <TouchableOpacity onPress={rejectCall} className="bg-red-500 w-16 h-16 rounded-full items-center justify-center">
                <PhoneOff size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={acceptCall} className="bg-green-500 w-16 h-16 rounded-full items-center justify-center">
                <Phone size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}
