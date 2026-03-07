import React, { useEffect, useState, useRef } from "react";
import {
    View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView,
    Platform, Image, ActivityIndicator, Alert, Linking, TouchableOpacity
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import axios from "../../context/axiosConfig";
import socket from "../../utils/socket";
import { useAuth } from "../../context/auth.context";

const CollegeChatScreen = ({ navigation }: any) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sendingMedia, setSendingMedia] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        loadMessages();

        // Socket stuff
        socket.emit("join_college_room", { collegeName: user?.college });

        const handleNewMessage = (msg: any) => {
            setMessages((prev) => {
                if (prev.find((m) => m._id === msg._id)) return prev;
                // Avoid duplicating optimistic messages that haven't updated _id yet somehow
                if (msg.senderId._id === user._id && prev.find((m) => m.content === msg.content && new Date(msg.createdAt).getTime() - new Date(m.createdAt).getTime() < 3000)) return prev;
                return [msg, ...prev]; // Since inverted list
            });
        };

        const handleDeleteMessage = (msgId: string) => {
            setMessages((prev) => prev.filter(m => m._id !== msgId));
        };

        socket.on("new_college_message", handleNewMessage);
        socket.on("delete_college_message", handleDeleteMessage);

        return () => {
            socket.emit("leave_college_room", { collegeName: user?.college });
            socket.off("new_college_message", handleNewMessage);
            socket.off("delete_college_message", handleDeleteMessage);
            if (sound) sound.unloadAsync();
        };
    }, [user]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/college-chat/messages");
            if (res.data.success) {
                // FlatList is inverted, so newest should be first
                const sorted = res.data.messages.sort(
                    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setMessages(sorted);
            }
        } catch (e) {
            console.log("Failed to load college chat messages", e);
        } finally {
            setLoading(false);
        }
    };

    const uploadMedia = async (uri: string, type: "image/jpeg" | "video/mp4" | "application/pdf" | "audio/m4a" | "application/octet-stream" | string, msgType: string) => {
        const tempId = "temp_" + Date.now();
        const tempMessage = {
            _id: tempId,
            senderId: user,
            messageType: msgType,
            mediaUrl: uri,
            content: "",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            pending: true,
        };
        setMessages((prev) => [tempMessage, ...prev]);

        try {
            const formData = new FormData();
            formData.append("messageType", msgType);
            formData.append("media", { uri, name: `upload_${Date.now()}`, type } as any);

            const res = await axios.post("/college-chat/send", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (res.data.success) setMessages((prev) => prev.map(m => m._id === tempId ? res.data.chat : m));
        } catch (error) {
            console.error("Upload error", error);
            Alert.alert("Error", "Failed to upload file.");
            setMessages((prev) => prev.filter(m => m._id !== tempId));
        }
    };

    const handleSendText = async () => {
        if (!text.trim()) return;
        const msg = text;
        setText("");
        const tempId = "temp_" + Date.now();
        const tempMessage = {
            _id: tempId,
            senderId: user,
            messageType: "text",
            content: msg,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            pending: true,
        };
        setMessages((prev) => [tempMessage, ...prev]);
        try {
            const res = await axios.post("/college-chat/send", { messageType: "text", content: msg });
            if (res.data.success) setMessages((prev) => prev.map(m => m._id === tempId ? res.data.chat : m));
        } catch (e) {
            console.log("Error sending txt", e);
            setMessages((prev) => prev.filter(m => m._id !== tempId));
        }
    };

    const handlePickImage = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.5,
        });
        if (!res.canceled) {
            const asset = res.assets[0];
            const isVideo = asset.type === "video";
            uploadMedia(asset.uri, isVideo ? "video/mp4" : "image/jpeg", isVideo ? "video" : "image");
        }
    };

    const handlePickDocument = async () => {
        const res = await DocumentPicker.getDocumentAsync({
            type: "*/*",
            copyToCacheDirectory: true,
        });
        if (!res.canceled && res.assets && res.assets.length > 0) {
            const asset = res.assets[0];
            uploadMedia(asset.uri, asset.mimeType as any || "application/octet-stream", "file");
        }
    };

    const startRecording = async () => {
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(recording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        if (!recording) return;
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (uri) {
            uploadMedia(uri, "audio/m4a", "voice");
        }
    };

    const playSound = async (uri: string) => {
        try {
            const { sound } = await Audio.Sound.createAsync({ uri });
            setSound(sound);
            await sound.playAsync();
        } catch (e) {
            Alert.alert("Error playing audio");
        }
    };

    const deleteMessage = async (id: string, senderId: string) => {
        if (senderId !== user?._id) return;
        Alert.alert("Delete Message", "Delete this message for everyone?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        await axios.delete(`/college-chat/${id}`);
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
        ])
    }

    const renderItem = ({ item }: { item: any }) => {
        const isMe = item.senderId?._id === user?._id;
        const timeLeft = item.expiresAt ? formatDistanceToNowStrict(new Date(item.expiresAt)) : "";

        return (
            <View className={`flex-row w-full ${isMe ? "justify-end" : "justify-start"} items-end pb-4`}>
                {!isMe && (
                    <Image
                        source={{ uri: item.senderId?.avatar || `https://ui-avatars.com/api/?name=${item.senderId?.username}` }}
                        className="h-8 w-8 rounded-full mr-2"
                    />
                )}
                <View className={isMe ? "items-end" : "items-start"}>
                    {!isMe && <Text className="text-xs text-gray-500 ml-1 mb-1">{item.senderId?.name}</Text>}
                    <Pressable
                        onLongPress={() => deleteMessage(item._id, item.senderId?._id)}
                        className={`max-w-[280px] p-3 rounded-2xl ${isMe ? "bg-blue-600 rounded-br-none" : "bg-gray-200 rounded-bl-none"} ${item.pending ? 'opacity-70' : ''}`}
                    >
                        {item.messageType === "text" && (
                            <Text className={`${isMe ? "text-white" : "text-black"} text-base`}>{item.content}</Text>
                        )}
                        {item.messageType === "image" && (
                            <Image source={{ uri: item.mediaUrl }} className="w-48 h-48 rounded-lg" resizeMode="cover" blurRadius={item.pending ? 10 : 0} />
                        )}
                        {item.messageType === "video" && (
                            <View className="w-48 h-32 bg-black rounded-lg items-center justify-center">
                                <Ionicons name="play-circle" size={40} color="white" />
                                <Text className="text-white text-xs mt-1">Video File</Text>
                                {item.pending && <ActivityIndicator size="small" color="white" style={{ position: 'absolute' }} />}
                            </View>
                        )}
                        {item.messageType === "file" && (
                            <TouchableOpacity onPress={() => Linking.openURL(item.mediaUrl)} className="flex-row items-center bg-white/20 p-2 rounded-lg">
                                <Ionicons name="document" size={24} color={isMe ? "white" : "black"} />
                                <Text className={`ml-2 font-semibold ${isMe ? "text-white" : "text-black"}`}>View Document</Text>
                            </TouchableOpacity>
                        )}
                        {item.messageType === "voice" && (
                            <TouchableOpacity onPress={() => playSound(item.mediaUrl)} className="flex-row items-center bg-white/20 p-2 rounded-lg w-32">
                                <Ionicons name="play" size={24} color={isMe ? "white" : "black"} />
                                <View className="flex-1 h-1 bg-gray-400 opacity-50 ml-2 rounded mx-1" />
                                <Text className={`ml-1 text-xs font-semibold ${isMe ? "text-white" : "text-black"}`}>Audio</Text>
                            </TouchableOpacity>
                        )}
                    </Pressable>

                    <View className="flex-row items-center mt-1">
                        <Text className="text-[10px] text-gray-500 mr-2">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {item.pending ? (
                            <ActivityIndicator size="small" color="gray" style={{ transform: [{ scale: 0.5 }] }} />
                        ) : (
                            <Ionicons name="time-outline" size={10} color="gray" />
                        )}
                        <Text className="text-[10px] text-gray-400 ml-1">{item.pending ? "Sending..." : `Expires in ${timeLeft}`}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-row items-center justify-between px-4 pb-3 pt-2 border-b border-gray-100 shadow-sm bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={() => navigation.goBack()} className="mr-3">
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </Pressable>
                    <View>
                        <Text className="font-bold text-lg text-gray-900">{user?.college} Chat</Text>
                        <Text className="text-xs text-gray-500 flex-row items-center">
                            <Ionicons name="shield-checkmark" size={12} color="green" /> Matches 24hr Expiry Rule
                        </Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#3b82f6" />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        inverted
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: 12 }}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <View className="border-t border-gray-200 bg-white px-2 py-3 pb-6">
                    <View className="flex-row items-center justify-between bg-gray-100 rounded-3xl px-3 py-1">
                        <Pressable onPress={handlePickImage} className="mr-2">
                            <Ionicons name="image" size={22} color="#4b5563" />
                        </Pressable>
                        <Pressable onPress={handlePickDocument} className="mr-2">
                            <Ionicons name="document-attach" size={22} color="#4b5563" />
                        </Pressable>

                        <TextInput
                            value={text}
                            onChangeText={setText}
                            placeholder="Message your college..."
                            className="flex-1 bg-transparent py-3 px-2 text-base text-gray-800"
                            multiline
                        />

                        {text.trim().length > 0 ? (
                            <Pressable onPress={handleSendText} className="bg-blue-600 p-2.5 rounded-full shadow-sm">
                                <Ionicons name="send" size={18} color="white" />
                            </Pressable>
                        ) : (
                            <Pressable
                                onPressIn={startRecording}
                                onPressOut={stopRecording}
                                className={`${isRecording ? 'bg-red-500' : 'bg-gray-200'} p-2.5 rounded-full items-center justify-center shadow-sm`}
                            >
                                <Ionicons name="mic" size={20} color={isRecording ? "white" : "#4b5563"} />
                            </Pressable>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default CollegeChatScreen;
