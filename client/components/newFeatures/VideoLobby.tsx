import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, Alert 
} from 'react-native';
import JitsiMeet, { JitsiMeetEvents } from 'react-native-jitsi-meet'; 
import socket from '../../utils/socket';

export default function NativeVideoLobby({ myUserId }: { myUserId: string }) {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [incomingCall, setIncomingCall] = useState<any>(null); // { callerId, roomId }

  useEffect(() => {
    // 1. Connect & Join Redis Lobby
    if (!socket.connected) socket.connect();
    socket.emit("join-lobby", myUserId);

    // 2. Receive Real-Time Updates
    socket.on("update-user-list", (users: any) => {
      // Show everyone except myself
      setOnlineUsers(users.filter((u: any) => u.userId !== myUserId));
    });

    // 3. Handle Incoming Call (Ringing)
    socket.on("incoming-call", ({ callerId, roomId }: any) => {
      setIncomingCall({ callerId, roomId });
    });

    // 4. Handle Accepted Call (Start Video)
    socket.on("call-accepted", ({ roomId }: any) => {
      launchNativeJitsi(roomId);
    });

    // 5. Handle Busy
    socket.on("call-busy", () => Alert.alert("Busy", "That user is currently in another call."));

    // Jitsi Event Listeners
    const endCallListener = JitsiMeetEvents.addListener('conferenceTerminated', () => {
        socket.emit("end-call", { userId: myUserId });
    });

    return () => {
      socket.off("update-user-list");
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("call-busy");
      endCallListener.remove(); 
    };
  }, []);

  // --- ACTIONS ---

  const startCall = (targetUserId: string) => {
    socket.emit("call-user", { callerId: myUserId, targetUserId });
  };

  const answerCall = () => {
    if (!incomingCall) return;
    
    // Notify server to mark us as busy
    socket.emit("accept-call", { 
        callerId: incomingCall.callerId, 
        acceptorId: myUserId, 
        roomId: incomingCall.roomId 
    });

    launchNativeJitsi(incomingCall.roomId);
    setIncomingCall(null);
  };

  const declineCall = () => {
    setIncomingCall(null);
    // Optional: Emit "reject-call" to server
  };

  // --- NATIVE JITSI LAUNCHER ---
  const launchNativeJitsi = (roomId: string) => {
    const url = `https://meet.jit.si/${roomId}`;
    
    setTimeout(() => {
        JitsiMeet.call(url, {
            userInfo: { 
                displayName: myUserId, 
                email: "user@fync.com" 
            },
            meetOptions: {
                videoMuted: false,
                audioMuted: false
            }
        });
    }, 500);
  };

  return (
    <View className="flex-1 bg-black p-5">
      <Text className="text-white text-2xl font-bold mb-5">
        Lobby <Text className="text-blue-500">({onlineUsers.length} Online)</Text>
      </Text>

      <FlatList
        data={onlineUsers}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <View className="flex-row justify-between items-center bg-gray-800 p-4 rounded-xl mb-3 border border-white/10">
            <View>
                <Text className="text-white text-base font-bold">{item.userId}</Text>
                <View className="flex-row items-center mt-1">
                    <View className={`w-2 h-2 rounded-full mr-2 ${item.status === 'busy' ? 'bg-red-500' : 'bg-green-500'}`} />
                    <Text className={item.status === 'busy' ? 'text-red-400 text-xs' : 'text-green-400 text-xs'}>
                        {item.status === 'busy' ? 'Busy' : 'Available'}
                    </Text>
                </View>
            </View>

            {item.status === 'available' ? (
                <TouchableOpacity 
                    className="bg-blue-600 px-4 py-2 rounded-lg active:bg-blue-700"
                    onPress={() => startCall(item.userId)}
                >
                    <Text className="text-white font-bold text-sm">Video Call</Text>
                </TouchableOpacity>
            ) : (
                <View className="bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/30">
                    <Text className="text-red-500 font-bold text-xs">In Call</Text>
                </View>
            )}
          </View>
        )}
        ListEmptyComponent={
            <Text className="text-gray-500 text-center mt-10 italic">No other users online.</Text>
        }
      />

      {/* --- INCOMING CALL MODAL --- */}
      <Modal visible={!!incomingCall} transparent animationType="fade">
        <View className="flex-1 bg-black/80 justify-center items-center">
          <View className="w-[85%] bg-gray-900 p-6 rounded-3xl border border-white/10 items-center shadow-lg shadow-black">
            <View className="w-16 h-16 bg-blue-500/20 rounded-full items-center justify-center mb-4">
                <Text className="text-3xl">📞</Text>
            </View>
            
            <Text className="text-white text-xl font-bold mb-2">Incoming Call</Text>
            <Text className="text-gray-400 mb-8 text-center">
              <Text className="text-white font-bold">{incomingCall?.callerId}</Text> is requesting a video call.
            </Text>
            
            <View className="flex-row w-full gap-4 justify-center">
                <TouchableOpacity 
                    onPress={declineCall} 
                    className="bg-red-500/20 py-3 px-8 rounded-full border border-red-500/50 active:bg-red-500/40"
                >
                    <Text className="text-red-500 font-bold text-base">Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={answerCall} 
                    className="bg-green-500 py-3 px-8 rounded-full shadow-lg shadow-green-500/30 active:bg-green-600"
                >
                    <Text className="text-white font-bold text-base">Accept</Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}