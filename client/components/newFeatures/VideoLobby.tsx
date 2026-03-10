import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Alert,
    StyleSheet,
    ActivityIndicator,
    Platform,
    Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socket from '../../utils/socket';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { WebView } from 'react-native-webview';
// Use Camera from expo-camera for permissions in Expo Go
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoLobby'>;

export default function VideoLobby({ route, navigation }: Props) {
    const myUserId = route.params?.myUserId || "";
    const myUserName = route.params?.myUserName || "Unknown User";
    const myAvatar = route.params?.myAvatar || "";
    const myRealUsername = route.params?.myRealUsername || "";

    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [hasPermissions, setHasPermissions] = useState<boolean>(false);
    const [activeCallRoom, setActiveCallRoom] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            // 1. You MUST ask for Expo Go permissions first before the WebView opens
            const cameraStatus = await Camera.requestCameraPermissionsAsync();
            const audioStatus = await Audio.requestPermissionsAsync();

            if (cameraStatus.status === 'granted' && audioStatus.status === 'granted') {
                setHasPermissions(true);
            } else {
                Alert.alert("Permissions Required", "Camera and microphone permissions are required for video calls.");
                navigation.goBack();
            }
        })();
    }, []);

    useEffect(() => {
        if (!myUserId) {
            Alert.alert("Error", "User ID is missing.");
            navigation.goBack();
            return;
        }
        if (!socket.connected) socket.connect();
        socket.emit("join-lobby", { userId: myUserId, userName: myUserName, myAvatar, myRealUsername });
        socket.on("update-user-list", (users: any) => {
            setOnlineUsers(users.filter((u: any) => u.userId !== myUserId));
        });

        // Simple signaling for Jitsi Room invites 
        socket.on("incoming-jitsi-call", (data: { callerId: string, callerName: string, roomId: string }) => {
            Alert.alert(
                "Incoming Video Call 📹",
                `${data.callerName || data.callerId} is calling you!`,
                [
                    { text: "Decline", style: "cancel", onPress: () => socket.emit('set-status', { userId: myUserId, status: 'available' }) },
                    {
                        text: "Accept", onPress: () => {
                            socket.emit('set-status', { userId: myUserId, status: 'busy' });
                            setActiveCallRoom(data.roomId);
                        }
                    }
                ]
            );
        });

        // Listen for remote call cut
        socket.on("call-ended", (data: { roomId: string }) => {
            setActiveCallRoom((currentRoom) => {
                if (currentRoom === data.roomId) {
                    socket.emit('set-status', { userId: myUserId, status: 'available' });
                    return null;
                }
                return currentRoom;
            });
        });

        return () => {
            socket.emit("leave-lobby", myUserId);
            socket.off("update-user-list");
            socket.off("incoming-jitsi-call");
            socket.off("call-ended");
        };
    }, [myUserId]);

    const initiateCall = (targetUserId: string) => {
        if (!hasPermissions) {
            Alert.alert("Error", "Missing permissions.");
            return;
        }
        const roomId = `FyncRoom_${Date.now()}_${myUserId}`;
        socket.emit('set-status', { userId: myUserId, status: 'busy' });

        // You would typically add a backend socket emitter for "call-user" here.
        // For now we'll broadcast it if you have a routing file for it, or we rely on the generic lobby events.
        socket.emit("call-user", { targetUserId, callerId: myUserId, callerName: myUserName, roomId });
        setActiveCallRoom(roomId);
    };

    const renderUser = ({ item }: { item: any }) => {
        const isBusy = item.status === 'busy';

        return (
            <View style={styles.card}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: item.userId })}>
                        <Image
                            source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.userName || item.userId}&background=random&color=fff` }}
                            style={{ width: 50, height: 50, borderRadius: 25, marginRight: 15 }}
                        />
                    </TouchableOpacity>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={styles.userName} numberOfLines={1}>{item.userName || item.userId}</Text>
                        <Text style={styles.statusText} numberOfLines={1}>
                            {item.userUsername ? `@${item.userUsername} • ` : ""}
                            {isBusy ? "In another call" : "Available"}
                        </Text>
                    </View>
                </View>

                {isBusy ? (
                    <TouchableOpacity
                        style={[styles.btn, { backgroundColor: '#374151' }]}
                        onPress={() => Alert.alert("Busy", `${item.userName || item.userId} is currently in another call.`)}
                    >
                        <Ionicons name="videocam-off" size={22} color="#9ca3af" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.btn, { backgroundColor: '#25D366' }]} // WhatsApp Green
                        onPress={() => initiateCall(item.userId)}
                    >
                        <Ionicons name="videocam" size={24} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // If active call is ongoing, render WebView instead of list
    if (activeCallRoom) {
        if (!hasPermissions) {
            return (
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={{ color: '#fff', marginTop: 10 }}>Getting Permissions...</Text>
                </View>
            )
        }
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                {/* Custom Header to Leave Call */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Fync Secure Video 🔒</Text>
                    <TouchableOpacity onPress={() => {
                        socket.emit('end-call', { roomId: activeCallRoom });
                        socket.emit('set-status', { userId: myUserId, status: 'available' });
                        setActiveCallRoom(null);
                    }} style={{ backgroundColor: '#ef4444', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 }}>
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>End Call</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
                    <WebView
                        source={{ uri: `https://meet.ffmuc.net/${activeCallRoom}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&userInfo.displayName="${encodeURIComponent(myUserName)}"` }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        allowsInlineMediaPlayback={true} // Crucial for iOS video
                        mediaPlaybackRequiresUserAction={false} // Crucial for autoplay
                        style={{ flex: 1, backgroundColor: '#000' }}
                    />
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.header}>Lobby ({onlineUsers.length} Online)</Text>
            <FlatList
                data={onlineUsers}
                keyExtractor={(item) => item.userId}
                renderItem={renderUser}
                ListEmptyComponent={
                    <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>
                        No one else is online right now.
                    </Text>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111827', padding: 15 },
    header: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 25, marginTop: Platform.OS === 'android' ? 10 : 0 },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
    userName: { color: '#f3f4f6', fontSize: 17, fontWeight: '600', marginBottom: 2 },
    statusText: { color: '#9ca3af', fontSize: 14 },
    btn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#9ca3af', fontWeight: 'bold' }
});