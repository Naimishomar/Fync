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
    const [replyTo, setReplyTo] = useState<any>(null);
    const recordingTaskRef = useRef(false);

    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        loadMessages();

        // Socket stuff
        socket.emit("join_college_room", { collegeName: user?.college });

        const handleNewMessage = (msg: any) => {
            setMessages((prev) => {
                // 1. Check if the exact message ID already exists (normal duplicate prevention)
                if (prev.find((m) => m._id === msg._id)) return prev;

                // 2. Check for optimistic duplicates (temp ID replaced by real ID)
                // If the incoming message has the same content and sender as a pending message, 
                // we should let the request callback handle the replacement, not the socket.
                const isOptimisticDuplicate = prev.some(m =>
                    m.pending &&
                    m.content === msg.content &&
                    m.senderId?._id === msg.senderId?._id
                );

                if (isOptimisticDuplicate) return prev;

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
            const res = await axios.get("/college-chat/messages", { params: { noCache: true } });
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

    const uploadMedia = async (uri: string, mimeType: string, msgType: string) => {
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

            let fileName = `upload_${Date.now()}`;
            if (msgType === 'image') fileName += ".jpg";
            else if (msgType === 'video') fileName += ".mp4";
            else if (msgType === 'voice') fileName += ".m4a";
            else fileName += ".bin";

            formData.append("media", {
                uri,
                name: fileName,
                type: mimeType || 'application/octet-stream',
            } as any);

            const res = await axios.post("/college-chat/send", formData, {
                headers: {
                    'Accept': 'application/json',
                    // Let axios/browser set the Content-Type with boundary automatically
                },
            });

            if (res.data?.success) {
                setMessages((prev) => prev.map(m => m._id === tempId ? res.data.chat : m));
                setReplyTo(null);
            } else {
                throw new Error("Upload failed on server");
            }
        } catch (error: any) {
            console.error("Upload error:", error?.message || "Unknown Error");
            Alert.alert("Upload Failed", "Please check your network connection and try again.");
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
            const res = await axios.post("/college-chat/send", {
                messageType: "text",
                content: msg,
                replyTo: replyTo?._id || null
            });
            if (res.data.success) {
                setMessages((prev) => prev.map(m => m._id === tempId ? res.data.chat : m));
                setReplyTo(null);
            }
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
            if (recordingTaskRef.current) {
                console.log("Start task already running");
                return;
            }
            recordingTaskRef.current = true;

            // If we are already recording, we must stop first
            if (isRecording || recording) {
                console.log("Existing recording found, attempting to cleanup first");
                if (recording) {
                    try { await recording.stopAndUnloadAsync(); } catch (e) { }
                }
                setRecording(null);
                setIsRecording(false);
            }

            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(newRecording);
            setIsRecording(true);
            console.log("Recording started successfully");
        } catch (err) {
            console.error('Failed to start recording', err);
            setRecording(null);
            setIsRecording(false);
        } finally {
            recordingTaskRef.current = false;
        }
    };

    const stopRecording = async () => {
        if (!recording) {
            setIsRecording(false);
            return;
        }

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            if (uri) {
                uploadMedia(uri, "audio/m4a", "voice");
            }
        } catch (err) {
            console.error("Error stopping recording", err);
        } finally {
            setRecording(null);
            setIsRecording(false);
            recordingTaskRef.current = false;
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
                    {!isMe && <Text className="text-xs text-gray-400 ml-1 mb-1 font-bold">@{item.senderId?.username}</Text>}

                    {item.replyTo && (
                        <View className={`max-w-[240px] px-3 py-1 bg-black/5 rounded-t-xl border-l-4 border-blue-500 mb-[-8px] z-0 opacity-80`}>
                            <Text className="text-[10px] text-blue-600 font-black uppercase">reply to @{item.replyTo.senderId?.username || 'user'}</Text>
                            <Text className="text-[10px] text-gray-500 " numberOfLines={1}>{item.replyTo.content || '[Media]'}</Text>
                        </View>
                    )}

                    <Pressable
                        onLongPress={() => deleteMessage(item._id, item.senderId?._id)}
                        onPress={() => setReplyTo(item)}
                        className={`max-w-[280px] p-3 rounded-2xl ${isMe ? "bg-blue-600 rounded-br-none" : "bg-gray-100 rounded-bl-none"} ${item.pending ? 'opacity-70' : ''} z-10`}
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

                <View className="border-t border-gray-200 bg-white">
                    {replyTo && (
                        <View className="flex-row items-center justify-between bg-gray-50 px-4 py-2 border-l-4 border-blue-500">
                            <View className="flex-1">
                                <Text className="text-xs text-blue-600 font-bold">Replying to @{replyTo.senderId?.username}</Text>
                                <Text className="text-xs text-gray-500 " numberOfLines={1}>{replyTo.content || '[Media]'}</Text>
                            </View>
                            <Pressable onPress={() => setReplyTo(null)}>
                                <Ionicons name="close-circle" size={20} color="#6b7280" />
                            </Pressable>
                        </View>
                    )}
                    <View className="px-2 py-3 pb-6">
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
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default CollegeChatScreen;
