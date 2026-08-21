import React, { useEffect, useState, useRef } from "react";
import {View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView, Keyboard, Platform, Image, ActivityIndicator, Linking, TouchableOpacity, Modal} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio, Video, ResizeMode } from "expo-av";
import { formatDistanceToNowStrict } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import axios from "../../context/axiosConfig";
import socket from "../../utils/socket";
import { useAuth } from "../../context/auth.context";
import { Alert } from '../ui/AlertModal';

const CollegeChatScreen = ({ navigation }: any) => {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [replyTo, setReplyTo] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState("23:59:59");
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);

    // Keyboard Listeners
    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // Countdown Logic
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const hours = 23 - now.getHours();
            const mins = 59 - now.getMinutes();
            const secs = 59 - now.getSeconds();
            setTimeLeft(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        loadMessages();
        socket.emit("join_college_room", { collegeName: user?.college });

        const handleNewMessage = (msg: any) => {
            setMessages((prev) => {
                if (prev.find((m) => m._id === msg._id)) return prev;
                const isOptimisticDuplicate = prev.some(m =>
                    m.pending && m.content === msg.content && m.senderId?._id === msg.senderId?._id
                );
                if (isOptimisticDuplicate) return prev;
                return [msg, ...prev];
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
        };
    }, [user]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/college-chat/messages", { params: { noCache: true } });
            if (res.data.success) {
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

    const uploadMedia = async (uri: string, mimeType: string, msgType: string, fileName?: string) => {
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
            
            let finalFileName = fileName || `upload_${Date.now()}`;
            if (!fileName) {
                if (msgType === 'image') finalFileName += ".jpg";
                else if (msgType === 'video') finalFileName += ".mp4";
                else if (msgType === 'voice') finalFileName += ".m4a";
                else finalFileName += ".bin";
            }

            formData.append("media", {
                uri,
                name: finalFileName,
                type: mimeType || 'application/octet-stream',
            } as any);

            const res = await axios.post("/college-chat/send", formData, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                transformRequest: (data) => data, // Crucial for some RN versions
            });

            if (res.data?.success) {
                setMessages((prev) => prev.map(m => m._id === tempId ? res.data.chat : m));
                setReplyTo(null);
            } else {
                throw new Error("Upload failed on server");
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            setMessages((prev) => prev.filter(m => m._id !== tempId));
            Alert.alert("Upload Failed", "Please check your network and try again.");
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
            quality: 0.8,
        });
        if (!res.canceled) {
            const asset = res.assets[0];
            const sizeInMb = (asset.fileSize || 0) / (1024 * 1024);

            if (sizeInMb > 20) {
                Alert.alert("File Too Large", "Please select a media file under 20MB.");
                return;
            }

            const isVideo = asset.type === "video";
            uploadMedia(asset.uri, isVideo ? "video/mp4" : "image/jpeg", isVideo ? "video" : "image", asset.fileName || `media_${Date.now()}`);
        }
    };

    const handlePickDocument = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({ 
                type: "application/pdf", // PDF Only
                copyToCacheDirectory: true 
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                const asset = res.assets[0];
                
                // Double check mime type
                if (asset.mimeType !== 'application/pdf') {
                    Alert.alert("Invalid File", "Only PDF documents are allowed in the campus loop.");
                    return;
                }

                const sizeInMb = (asset.size || 0) / (1024 * 1024);
                if (sizeInMb > 20) {
                    Alert.alert("File Too Large", "Please select a file under 20MB.");
                    return;
                }

                uploadMedia(asset.uri, "application/pdf", "file", asset.name);
            }
        } catch (error) {
            console.error("Document picking error:", error);
        }
    };

    const deleteMessage = async (id: string, senderId: string) => {
        if (senderId !== user?._id) return;
        Alert.alert("Delete Message?", "Delete this message from the campus loop?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    // Optimistic update
                    setMessages((prev) => prev.filter(m => m._id !== id));
                    try { 
                        await axios.delete(`/college-chat/${id}`); 
                    } catch (e) { 
                        console.log(e); 
                        // Note: If it fails, the socket or a reload would ideally fix it, 
                        // but usually, deletions are reliable.
                    }
                }
            }
        ])
    };

    const renderItem = ({ item }: { item: any }) => {
        const isMe = item.senderId?._id === user?._id;

        return (
            <View className={`w-full ${isMe ? "items-end" : "items-start"} mb-2`}>
                <View className={`flex-row items-end ${isMe ? "flex-row-reverse" : "flex-row"} max-w-[85%]`}>
                    <View className={`${isMe ? "ml-2 mb-5" : "mr-2 mb-5"}`}>
                        <View className="w-8 h-8 rounded-full border-2 border-white shadow-hair overflow-hidden bg-paper-2">
                            <Image
                                source={{ uri: item.senderId?.avatar || `https://ui-avatars.com/api/?name=${item.senderId?.username}&background=f97316&color=fff` }}
                                className="w-full h-full"
                            />
                        </View>
                    </View>

                    <View className={`${isMe ? "items-end" : "items-start"} flex-1`}>
                        {!isMe && (
                            <Text className="text-label text-accent-text font-display mb-1 ml-1 uppercase">
                                @{item.senderId?.username}
                            </Text>
                        )}

                        {item.replyTo && (
                            <View className={`px-3 py-2 bg-brand-50/50 rounded-t-sheet border-l-2 border-brand-500 mb-[-8px] z-0 opacity-80 ${isMe ? "items-end" : "items-start"}`}>
                                <Text className="text-label text-accent-text font-display uppercase">REF: @{item.replyTo.senderId?.username || 'user'}</Text>
                                <Text className="text-label text-ink-3 font-medium" numberOfLines={1}>{item.replyTo.content || '[Media]'}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            activeOpacity={0.9}
                            onLongPress={() => {
                                Alert.alert(
                                    "Message Options",
                                    "Choose an action",
                                    [
                                        { text: "Reply", onPress: () => setReplyTo(item) },
                                        { text: "Delete", onPress: () => deleteMessage(item._id, item.senderId?._id), style: 'destructive' },
                                        { text: "Cancel", style: 'cancel' }
                                    ]
                                );
                            }}
                            delayLongPress={400}
                            style={{
                                borderTopLeftRadius: isMe ? 16 : 6,
                                borderBottomLeftRadius: isMe ? 16 : 6,
                                borderTopRightRadius: isMe ? 6 : 16,
                                borderBottomRightRadius: isMe ? 6 : 16,
                            }}
                            className={`px-4 py-2.5 ${isMe ? "bg-ink shadow-hair " : "bg-card border border-line shadow-hair"} ${item.pending ? 'opacity-70' : ''}`}
                        >
                            {item.messageType === "text" && (
                                <Text className={`text-sm leading-5 font-semibold ${isMe ? "text-white" : "text-ink"}`}>{item.content}</Text>
                            )}
                            {item.messageType === "image" && (
                                <TouchableOpacity onPress={() => setSelectedImage(item.mediaUrl)}>
                                    <Image source={{ uri: item.mediaUrl }} className="w-48 h-48 rounded-xl" resizeMode="cover" blurRadius={item.pending ? 10 : 0} />
                                </TouchableOpacity>
                            )}
                            {item.messageType === "video" && (
                                <Pressable 
                                    onPress={(e) => e.stopPropagation()} 
                                    onLongPress={(e) => e.stopPropagation()} 
                                    className="w-64 h-40 bg-ink rounded-xl overflow-hidden shadow-hair"
                                >
                                    <Video
                                        source={{ uri: item.mediaUrl }}
                                        rate={1.0}
                                        volume={1.0}
                                        isMuted={false}
                                        resizeMode={ResizeMode.CONTAIN}
                                        shouldPlay={false}
                                        isLooping={false}
                                        useNativeControls
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                    {item.pending && (
                                        <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                            <ActivityIndicator size="small" color="white" />
                                        </View>
                                    )}
                                </Pressable>
                            )}
                            {item.messageType === "file" && (
                                <Pressable 
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        Linking.openURL(item.mediaUrl);
                                    }}
                                    onLongPress={(e) => e.stopPropagation()}
                                    className={`flex-row items-center p-3 rounded-xl ${isMe ? 'bg-card/10' : 'bg-black/5'}`}
                                >
                                    <View className={`w-10 h-10 rounded-lg items-center justify-center ${isMe ? 'bg-ink' : 'bg-brand-100'}`}>
                                        <Ionicons name="document-text" size={24} color={isMe ? "white" : "#F97316"} />
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className={`text-sm font-semibold ${isMe ? "text-white" : "text-ink"}`} numberOfLines={1}>
                                            {item.content || 'Shared Document'}
                                        </Text>
                                        <Text className={`${isMe ? "text-ink-3" : "text-ink-3"} text-label uppercase font-semibold`}>Tap to view file</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={isMe ? "white" : "#C4BEB6"} />
                                </Pressable>
                            )}
                        </TouchableOpacity>

                        <View className={`flex-row items-center mt-1.5 ${isMe ? "justify-end" : "justify-start"}`}>
                            <Text className="text-label text-ink-3 font-display uppercase">
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F5F2EC' }}>
            {/* SOLAR GLOW */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 350, zIndex: -1 }} pointerEvents="none">
                <LinearGradient colors={['#EDE8E0', 'rgba(255, 247, 237, 0)']} style={{ flex: 1 }} />
            </View>

            {/* HEADER */}
            <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(249, 115, 22, 0.1)' }}>
                {/* Standard app bar: the back chevron sits in a 44px touch box that
                    overhangs by 11px, so the GLYPH lands on the 20px gutter rather
                    than the box edge. */}
                <View className="flex-row items-center px-gutter pt-2 pb-3" style={{ gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        className="w-11 h-11 items-center justify-center rounded-xl"
                        style={{ marginLeft: -11 }}
                    >
                        <Ionicons name="chevron-back" size={22} color="#12100E" />
                    </TouchableOpacity>
                    <View className="flex-1 min-w-0">
                        <Text className="font-display text-h2 text-ink" numberOfLines={1}>{user?.college} Hub</Text>
                        <Text className="font-sans text-sm text-ink-3" numberOfLines={1}>Vanish every 24h · Keep it real</Text>
                    </View>
                </View>

                {/* The countdown is the point of this room, so it gets a strip of
                    its own rather than a chip fighting the title for width. */}
                <View className="flex-row items-center justify-center bg-brand-50 py-2.5" style={{ gap: 8 }}>
                    <Ionicons name="timer-outline" size={15} color="#EA580C" />
                    <Text className="font-display text-label text-brand-700 uppercase">Expires in {timeLeft}</Text>
                </View>
            </SafeAreaView>

            <KeyboardAvoidingView
                behavior="padding"
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
            >
                <View style={{ flex: 1 }}>


                    {/* MESSAGES */}
                    <View className="flex-1 bg-paper shadow-hair overflow-hidden border-t border-line">
                        {loading ? (
                            <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#F97316" /></View>
                        ) : (
                            <FlatList
                                ref={flatListRef}
                                data={messages}
                                inverted
                                keyExtractor={(item) => item._id}
                                renderItem={renderItem}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 10 }}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                                ListHeaderComponent={() => <View className="h-0" />}
                            />
                        )}
                    </View>

                    {/* INPUT AREA */}
                    <View className="bg-card">
                        {replyTo && (
                            <View className="flex-row items-center justify-between bg-brand-50 px-6 py-2 border-l-4 border-brand-500">
                                <View className="flex-1">
                                    <Text className="text-label text-accent-text font-semibold uppercase">Replying to @{replyTo.senderId?.username}</Text>
                                    <Text className="text-xs text-ink-3" numberOfLines={1}>{replyTo.content || '[Media]'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setReplyTo(null)}><Ionicons name="close-circle" size={20} color="#F97316" /></TouchableOpacity>
                            </View>
                        )}
                        <View
                            style={{
                                marginBottom: isKeyboardVisible ? 20 : Math.max(insets.bottom, 12)
                            }}
                            className="px-6 pt-2 flex-row items-center"
                        >
                            <View className="flex-row items-center bg-paper-2 flex-1 p-1 border border-line rounded-md">
                                <TouchableOpacity onPress={handlePickImage} className="w-9 h-9 items-center justify-center rounded-full bg-brand-50/50 ml-1" hitSlop={4}>
                                    <Ionicons name="image" size={18} color="#F97316" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handlePickDocument} className="w-9 h-9 items-center justify-center rounded-full bg-brand-50/50 ml-1" hitSlop={4}>
                                    <Ionicons name="document-attach" size={18} color="#F97316" />
                                </TouchableOpacity>
                                <TextInput
                                    value={text}
                                    onChangeText={setText}
                                    onFocus={() => setIsKeyboardVisible(true)}
                                    onBlur={() => setIsKeyboardVisible(false)}
                                    placeholder="Broadcast to campus..."
                                    placeholderTextColor="#8B857E"
                                    className="flex-1 px-3 text-ink font-semibold text-sm py-2"
                                    multiline
                                />
                            </View>
                             <View className="ml-2">
                                {text.trim().length > 0 && (
                                    <TouchableOpacity onPress={handleSendText} className="w-12 h-12 bg-brand-600 items-center justify-center rounded-full shadow-hair">
                                        <Ionicons name="send" size={20} color="white" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
            {/* FULL SCREEN IMAGE MODAL */}
            <Modal visible={!!selectedImage} transparent={true} animationType="fade">
                <View className="flex-1 bg-black/95 justify-center items-center">
                    <TouchableOpacity
                        onPress={() => setSelectedImage(null)}
                        className="absolute top-12 right-6 w-10 h-10 bg-card/10 rounded-full items-center justify-center z-50"
                    >
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage }}
                            className="w-full h-[80%]"
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
};

export default CollegeChatScreen;
