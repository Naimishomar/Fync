import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  SafeAreaView, 
  ActivityIndicator,
  Platform // ✅ Import Platform
} from 'react-native';
import socket from '../../utils/socket'; 
import ZegoUIKitPrebuiltCallService, { 
  ZegoSendCallInvitationButton,
} from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZIM from 'zego-zim-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

// 🔥 FIX 1: Polyfill Platform globally for any Zego dependency that forgot to import it
if (Platform) {
    (global as any).Platform = Platform;
}

type Props = NativeStackScreenProps<RootStackParamList, 'VideoLobby'>;

const APP_ID = 1870753423; 
const APP_SIGN = "0c687e01e1e38767ccdd1fa77993629c0fc3a6392df1e6175cce7d3cc36e76c7";

export default function VideoLobby({ route, navigation }: Props) {
  const myUserId = route.params?.myUserId || ""; 
  const myUserName = route.params?.myUserName || "Unknown User";
  
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isZegoReady, setIsZegoReady] = useState(false);

  useEffect(() => {
    // Safety check
    if (!myUserId) {
        Alert.alert("Error", "User ID is missing.");
        navigation.goBack();
        return;
    }

    // 1. Initialize Zego
    initZego();

    // 2. Connect Socket
    if (!socket.connected) socket.connect();
    socket.emit("join-lobby", myUserId);

    socket.on("update-user-list", (users: any) => {
      // Filter out myself
      setOnlineUsers(users.filter((u: any) => u.userId !== myUserId));
    });

    return () => {
      // Cleanup
      socket.emit("leave-lobby", myUserId);
      socket.off("update-user-list");
      
      // 🔥 FIX 2: Always uninit when leaving the screen
      ZegoUIKitPrebuiltCallService.uninit();
    };
  }, [myUserId]); 

const initZego = async () => {
    try {
      await ZegoUIKitPrebuiltCallService.uninit();

      await ZegoUIKitPrebuiltCallService.init(
        APP_ID,
        APP_SIGN,
        myUserId,
        myUserName,
        [ZIM],
        {      
          onCallInvitationEvent: (event: any, data: any) => {
            console.log("ZEGO EVENT:", event);
            if (event === 'OutgoingCallAccepted' || event === 'IncomingCallAccepted') {
              socket.emit('set-status', { userId: myUserId, status: 'busy' });
            }
            if (event === 'CallEnded' || event === 'OutgoingCallRejected') {
              socket.emit('set-status', { userId: myUserId, status: 'available' });
            }
          }
        }
      );
      setIsZegoReady(true);
      console.log("✅ Zego Service Initialized");
    } catch (error) {
      console.error("❌ Zego Init Error:", error);
    }
  };

  const renderUser = ({ item }: { item: any }) => {
    const isBusy = item.status === 'busy';

    return (
      <View style={styles.card}>
        <View>
          <Text style={styles.userName}>{item.userId}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: isBusy ? 'red' : '#22c55e' }]} />
            <Text style={styles.statusText}>{isBusy ? "In a Call" : "Online"}</Text>
          </View>
        </View>

        {isBusy ? (
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#374151' }]} 
            onPress={() => Alert.alert("Busy", "User is currently in another call.")}
          >
            <Text style={styles.btnText}>Busy</Text>
          </TouchableOpacity>
        ) : (
          // Only show call button if Zego is ready
          isZegoReady ? (
            <ZegoSendCallInvitationButton
              invitees={[{ userID: item.userId, userName: item.userId }]}
              isVideoCall={true}
              resourceID={"zego_call"} 
              backgroundColor={'#2563eb'}
              textColor={'#fff'}
              width={100}
              height={40}
              borderRadius={8}
              text={"Video Call"}
              onPressed={(errorCode: any, errorMessage: any) => {
                  if(errorCode) {
                      console.error("Call Failed:", errorMessage);
                      Alert.alert("Call Error", errorMessage);
                  }
              }}
            />
          ) : (
            <ActivityIndicator color="#2563eb" />
          )
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Lobby ({onlineUsers.length} Online)</Text>
      <FlatList
        data={onlineUsers}
        keyExtractor={(item) => item.userId}
        renderItem={renderUser}
        ListEmptyComponent={
            <Text style={{color: '#666', textAlign: 'center', marginTop: 20}}>
                No one else is online right now.
            </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  header: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: Platform.OS === 'android' ? 40 : 0 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1f2937', padding: 15, borderRadius: 12, marginBottom: 10 },
  userName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { color: '#9ca3af', fontSize: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  btnText: { color: '#9ca3af', fontWeight: 'bold' }
});